"""
Run execution orchestrator.
Ties together: Firestore + template engine + model provider + eval engine.
"""

from app.config import get_settings
from app.core.exceptions import PromptNotFoundError
from app.core.template_engine import render_prompt
from app.models.run import Run, RunRequest
from app.services.eval_service import DEFAULT_RUBRIC, evaluate_run
from app.services.firestore_service import FirestoreService
from app.services.model_provider import ModelProvider


def get_default_model(provider: ModelProvider) -> str:
    """Return the default model name for the given provider."""
    return provider.default_model()


async def _resolve_rubric(
    firestore: FirestoreService,
    use_case_id: str,
    rubric_id: str | None,
):
    """
    Resolve the rubric to use for evaluation.
    Priority:
    1. Explicit rubric_id if provided
    2. Custom rubric for the use case if one exists
    3. DEFAULT_RUBRIC
    """
    if rubric_id:
        return await firestore.get_rubric(rubric_id)
    custom = await firestore.get_rubric_for_use_case(use_case_id)
    return custom or DEFAULT_RUBRIC


async def execute_run(
    request: RunRequest,
    owner_uid: str,
    firestore: FirestoreService,
    provider: ModelProvider,
    auto_evaluate: bool | None = None,
    rubric_id: str | None = None,
) -> tuple[Run, object]:
    """
    Full run lifecycle:
    1. Fetch prompt + version from Firestore
    2. Render prompt with variables
    3. Create a PENDING run record
    4. Call the model provider
    5. Save COMPLETED or FAILED result
    6. Auto-evaluate if enabled
    7. Return (Run, EvalResult | None)
    """
    settings = get_settings()

    # Determine if auto-evaluate is on
    should_evaluate = (
        auto_evaluate if auto_evaluate is not None
        else settings.auto_evaluate
    )

    # Step 1 — fetch prompt
    prompt = await firestore.get_prompt(request.prompt_id)

    # Step 2 — find the requested version
    version = next(
        (v for v in prompt.versions if v.version_number == request.version_number),
        None,
    )
    if version is None:
        raise ValueError(
            f"Version {request.version_number} not found "
            f"on prompt {request.prompt_id}"
        )

    # Step 3 — render prompt
    rendered = render_prompt(version.content, request.variables)

    # Step 4 — determine model
    model = request.model or get_default_model(provider)

    # Step 5 — create PENDING run in Firestore
    run = await firestore.create_run(
        data=request,
        owner_uid=owner_uid,
        rendered_prompt=rendered,
        prompt_name=prompt.name,
        model=model,
    )

    # Step 6 — call model provider
    eval_result = None
    try:
        result = await provider.generate(
            prompt=rendered,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
        run = await firestore.update_run_completed(
            run_id=run.id,
            output=result.content,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            latency_ms=result.latency_ms,
        )
    except Exception as exc:
        run = await firestore.update_run_failed(
            run_id=run.id,
            error=str(exc),
        )
        raise

    # Step 7 — auto-evaluate
    if should_evaluate and run.output:
        try:
            rubric = await _resolve_rubric(
                firestore, prompt.use_case_id, rubric_id
            )
            eval_result = await evaluate_run(
                run=run,
                rubric=rubric,
                provider=provider,
                pass_threshold=settings.eval_pass_threshold,
                owner_uid=owner_uid,
                judge_model=settings.judge_model,
            )
            eval_result = await firestore.save_eval_result(eval_result)
            # Denormalise score onto run for list views
            await firestore.update_run_score(run.id, eval_result.overall_score)
            run.overall_score = eval_result.overall_score
        except Exception as eval_exc:
            # Eval failure must never break the run response
            import logging
            logging.getLogger("promptforge").error(
                f"Auto-eval failed: {type(eval_exc).__name__}: {eval_exc}"
            )

    return run, eval_result