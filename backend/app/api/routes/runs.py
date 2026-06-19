"""
Run management API routes.
POST /runs                          — execute a prompt run
GET  /runs                          — list runs
GET  /runs/:id                      — get a single run
GET  /runs/:id/eval                 — get eval result for a run
POST /runs/:id/eval                 — manually trigger evaluation
GET  /prompts/:id/runs              — list runs for a prompt
GET  /prompts/:id/evals             — list evals for a prompt
POST /prompts/:id/stability/start   — start a background stability test
GET  /stability/:job_id             — poll stability test progress
"""

import asyncio
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Body, Depends, HTTPException

from app.core.exceptions import InvalidVariableError, PromptNotFoundError
from app.dependencies import get_current_user
from app.models.eval import EvalRequest, EvalResultResponse
from app.models.run import RunRequest, RunResponse, RunSummary, StabilityResult
from app.models.user import User
from app.services.eval_service import DEFAULT_RUBRIC, evaluate_run
from app.services.firestore_service import get_firestore_service
from app.services.model_provider import get_model_provider
from app.services.run_service import execute_run

router = APIRouter(tags=["runs"])


# ── File-based job store (survives uvicorn --reload) ──────────────────────────

JOBS_DIR = Path("/tmp/promptforge_jobs")
JOBS_DIR.mkdir(exist_ok=True)


def _write_job(job_id: str, data: dict) -> None:
    (JOBS_DIR / f"{job_id}.json").write_text(json.dumps(data))


def _read_job(job_id: str) -> dict | None:
    p = JOBS_DIR / f"{job_id}.json"
    if not p.exists():
        return None
    return json.loads(p.read_text())


# ── Run endpoints ─────────────────────────────────────────────────────────────

class RunWithEval(RunResponse):
    """Run response that includes eval result if available."""
    eval_result: EvalResultResponse | None = None


@router.post("/runs", response_model=RunWithEval, status_code=201)
async def create_run(
    request: RunRequest,
    auto_evaluate: bool = True,
    rubric_id: str | None = None,
    current_user: User = Depends(get_current_user),
):
    firestore = get_firestore_service()
    provider = get_model_provider()
    try:
        run, eval_result = await execute_run(
            request=request,
            owner_uid=current_user.uid,
            firestore=firestore,
            provider=provider,
            auto_evaluate=auto_evaluate,
            rubric_id=rubric_id,
        )
        # Sanity check — score must be 0-100
        if eval_result and eval_result.overall_score > 100:
            import logging
            logging.getLogger("promptforge").error(
                f"Score out of range: {eval_result.overall_score} — clamping to 100"
            )
            eval_result.overall_score = 100.0
            
        return RunWithEval(
            **run.model_dump(),
            eval_result=EvalResultResponse(**eval_result.model_dump()) if eval_result else None,
        )
    except InvalidVariableError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Missing variable: {e.variable_name}. "
                   f"Provide it in the variables field.",
        )
    except PromptNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/runs", response_model=list[RunSummary])
async def list_runs(
    prompt_id: str | None = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    firestore = get_firestore_service()
    return await firestore.list_runs(current_user.uid, prompt_id, limit)


@router.get("/runs/{run_id}", response_model=RunWithEval)
async def get_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
):
    firestore = get_firestore_service()
    run = await firestore.get_run(run_id)
    if run.owner_uid != current_user.uid:
        raise HTTPException(status_code=403, detail="Access denied")
    eval_result = await firestore.get_eval_for_run(run_id)
    return RunWithEval(
        **run.model_dump(),
        eval_result=EvalResultResponse(**eval_result.model_dump()) if eval_result else None,
    )


@router.get("/runs/{run_id}/eval", response_model=EvalResultResponse)
async def get_run_eval(
    run_id: str,
    current_user: User = Depends(get_current_user),
):
    firestore = get_firestore_service()
    run = await firestore.get_run(run_id)
    if run.owner_uid != current_user.uid:
        raise HTTPException(status_code=403, detail="Access denied")
    result = await firestore.get_eval_for_run(run_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail="No evaluation found for this run",
        )
    return result


@router.post("/runs/{run_id}/eval", response_model=EvalResultResponse)
async def manually_evaluate_run(
    run_id: str,
    request: EvalRequest,
    current_user: User = Depends(get_current_user),
):
    """Manually trigger evaluation for an existing run."""
    firestore = get_firestore_service()
    provider = get_model_provider()
    run = await firestore.get_run(run_id)
    if run.owner_uid != current_user.uid:
        raise HTTPException(status_code=403, detail="Access denied")
    if not run.output:
        raise HTTPException(
            status_code=400,
            detail="Cannot evaluate a run with no output",
        )
    if request.rubric_id:
        rubric = await firestore.get_rubric(request.rubric_id)
    else:
        rubric = DEFAULT_RUBRIC
    from app.config import get_settings
    settings = get_settings()
    result = await evaluate_run(
        run=run,
        rubric=rubric,
        provider=provider,
        pass_threshold=request.pass_threshold,
        owner_uid=current_user.uid,
        judge_model=settings.judge_model,
    )
    result = await firestore.save_eval_result(result)
    await firestore.update_run_score(run_id, result.overall_score)
    return result


@router.get("/prompts/{prompt_id}/runs", response_model=list[RunSummary])
async def list_runs_for_prompt(
    prompt_id: str,
    current_user: User = Depends(get_current_user),
):
    firestore = get_firestore_service()
    return await firestore.list_runs_for_prompt(prompt_id, current_user.uid)


@router.get(
    "/prompts/{prompt_id}/evals",
    response_model=list[EvalResultResponse],
)
async def list_evals_for_prompt(
    prompt_id: str,
    current_user: User = Depends(get_current_user),
):
    firestore = get_firestore_service()
    return await firestore.list_evals_for_prompt(prompt_id, current_user.uid)


# ── Stability test endpoints ───────────────────────────────────────────────────

@router.post("/prompts/{prompt_id}/stability/start", response_model=dict)
async def start_stability_test(
    prompt_id: str,
    version_number: int = 1,
    n: int = 3,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    variables: dict[str, str] = Body(default={}),
    current_user: User = Depends(get_current_user),
):
    """Start a stability test in the background. Poll /stability/{job_id} for results."""
    if n < 2 or n > 10:
        raise HTTPException(status_code=400, detail="n must be between 2 and 10")

    job_id = str(uuid.uuid4())
    _write_job(job_id, {"status": "running", "progress": 0, "n": n})

    async def run_stability():
        import logging
        logger = logging.getLogger("promptforge")

        # Create fresh instances — do NOT use cached singletons
        # The lru_cache instances are bound to a different context
        from app.config import get_settings
        from app.services.firestore_service import FirestoreService
        from app.services.model_provider import OllamaProvider

        settings = get_settings()
        from app.services.model_provider import OllamaProvider, VertexAIProvider
        firestore = FirestoreService(project_id=settings.gcp_project_id)
        provider = (
            VertexAIProvider()
            if settings.model_provider == "vertexai"
            else OllamaProvider()
        )

        scores = []
        run_ids = []

        for i in range(n):
            request = RunRequest(
                prompt_id=prompt_id,
                version_number=version_number,
                variables=variables,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            try:
                run, eval_result = await execute_run(
                    request=request,
                    owner_uid=current_user.uid,
                    firestore=firestore,
                    provider=provider,
                    auto_evaluate=True,
                )
                run_ids.append(run.id)
                if eval_result:
                    scores.append(eval_result.overall_score)
                _write_job(job_id, {
                    "status": "running",
                    "progress": i + 1,
                    "n": n,
                })
                logger.info(f"Stability job {job_id}: run {i+1}/{n} complete, score={eval_result.overall_score if eval_result else 'N/A'}")
            except Exception as e:
                import traceback
                logger.error(
                    f"Stability run {i+1} failed: {type(e).__name__}: {e}\n"
                    f"{traceback.format_exc()}"
                )

        if not scores:
            _write_job(job_id, {
                "status": "failed",
                "error": "No scores returned — eval may have failed",
            })
            return

        avg = round(sum(scores) / len(scores), 1)
        variance = sum((s - avg) ** 2 for s in scores) / len(scores)
        std_dev = round(variance ** 0.5, 2)
        stability = round(max(0.0, 100 - (std_dev * 4)), 1)

        _write_job(job_id, {
            "status": "completed",
            "result": StabilityResult(
                prompt_id=prompt_id,
                version_number=version_number,
                runs=len(scores),
                scores=scores,
                avg_score=avg,
                std_dev=std_dev,
                stability_index=stability,
                min_score=min(scores),
                max_score=max(scores),
                is_stable=std_dev < 5.0,
                run_ids=run_ids,
            ).model_dump(),
        })
        logger.info(f"Stability job {job_id}: completed, stability_index={stability}")

    # Run on uvicorn's own event loop — no thread needed
    asyncio.create_task(run_stability())

    return {"job_id": job_id, "status": "running", "n": n}

@router.get("/stability/{job_id}", response_model=dict)
async def get_stability_result(
    job_id: str,
    current_user: User = Depends(get_current_user),
):
    """Poll this endpoint to check stability test progress."""
    result = _read_job(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Job not found")
    return result


@router.get("/stability/{job_id}/debug")
async def debug_stability(job_id: str):
    """Debug endpoint — shows raw job file content."""
    return _read_job(job_id) or {"error": "not found"}