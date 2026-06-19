"""
Eval Engine — AI judge that scores a prompt run against a rubric.
Uses the same Ollama provider as the run engine, but with a
separate judge model configured via JUDGE_MODEL in .env.
"""

import json
import time
import re
from datetime import datetime

from app.config import get_settings
from app.models.eval import (
    CriterionScore,
    EvalRequest,
    EvalResult,
    Rubric,
    RubricCriterion,
)
from app.models.run import Run
from app.services.model_provider import ModelProvider


# ── Default rubric ────────────────────────────────────────────────────────────

DEFAULT_RUBRIC = Rubric(
    id="default",
    name="Default Quality Rubric",
    description="General purpose rubric for evaluating any prompt output",
    use_case_id=None,
    is_default=True,
    criteria=[
        RubricCriterion(
            name="relevance",
            label="Relevance",
            description="The output directly addresses what the prompt asked for. "
                        "It does not go off-topic or answer a different question.",
            weight=0.25,
        ),
        RubricCriterion(
            name="accuracy",
            label="Accuracy",
            description="Facts, logic, and technical details in the output are correct. "
                        "There are no factual errors or misleading statements.",
            weight=0.25,
        ),
        RubricCriterion(
            name="completeness",
            label="Completeness",
            description="All parts of the prompt request are addressed. "
                        "Nothing important is missing or skipped.",
            weight=0.20,
        ),
        RubricCriterion(
            name="clarity",
            label="Clarity",
            description="The output is clearly written and easy to understand. "
                        "It is well organised and free of unnecessary repetition.",
            weight=0.15,
        ),
        RubricCriterion(
            name="format",
            label="Format",
            description="The output follows the format requested in the prompt "
                        "(e.g. JSON, HCL, markdown, bullet points). "
                        "Structure and syntax are correct.",
            weight=0.15,
        ),
    ],
    created_by="system",
)


# ── Judge system prompt ───────────────────────────────────────────────────────

JUDGE_SYSTEM_PROMPT = ""


# ── Core judge function ───────────────────────────────────────────────────────

def _build_judge_prompt(
    original_prompt: str,
    model_output: str,
    rubric: Rubric,
) -> str:
    criteria_text = "\n".join(
        f"{c.name}({c.weight:.0%}):{c.description[:80]}"
        for c in rubric.criteria
    )
    # Aggressive truncation — judge only needs enough to score
    truncated_output = model_output[:2000] if len(model_output) > 2000 else model_output
    truncated_prompt = original_prompt[:500] if len(original_prompt) > 500 else original_prompt

    return f"""PROMPT:{truncated_prompt}

OUTPUT:{truncated_output}

RUBRIC:{criteria_text}

Return single-line minified JSON only."""


def _parse_judge_response(raw: str) -> dict:
    """
    Extract and parse JSON from judge response.
    Handles markdown fences, trailing commas, and truncated responses.
    """
    import logging
    logger = logging.getLogger("promptforge")

    # Strip all markdown code fences variants
    clean = re.sub(r"```(?:json)?", "", raw).strip()

    # Find outermost JSON object
    start = clean.find("{")
    end = clean.rfind("}") + 1

    if start == -1 or end == 0:
        logger.error(f"No JSON object found in judge response: {raw[:300]}")
        return {
            "criterion_scores": [],
            "summary": "Evaluation failed — judge returned no valid JSON.",
            "top_improvements": ["Re-run evaluation with higher max_tokens for the judge."],
        }

    json_str = clean[start:end]

    # Fix common model JSON issues
    # 1. Trailing commas before } or ]
    json_str = re.sub(r",\s*([}\]])", r"\1", json_str)
    # 2. Single quotes instead of double quotes
    json_str = json_str.replace("'", '"')

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse failed: {e}. Raw (first 500): {raw[:500]}")
        # Last resort — extract summary at minimum
        summary_match = re.search(r'"summary"\s*:\s*"([^"]*)"', json_str)
        return {
            "criterion_scores": [],
            "summary": summary_match.group(1) if summary_match else "Evaluation parsing failed.",
            "top_improvements": ["Re-run evaluation — judge response was truncated or malformed."],
        }


def _compute_criterion_scores(
    raw_scores: list[dict],
    rubric: Rubric,
) -> tuple[list[CriterionScore], float]:
    weight_map = {c.name: c for c in rubric.criteria}
    criterion_scores = []
    overall = 0.0

    for raw in raw_scores:
        name = raw["name"]
        criterion = weight_map.get(name)
        if not criterion:
            continue

        # Clamp score to 0-10 regardless of what the judge returns
        raw_score = float(raw["score"])
        score = max(0.0, min(10.0, raw_score))

        weighted = round(score * criterion.weight * 10, 2)
        overall += weighted
        criterion_scores.append(CriterionScore(
            name=name,
            label=criterion.label,
            score=score,
            weight=criterion.weight,
            weighted_score=weighted,
            rationale=raw.get("rationale", ""),
            suggestions=raw.get("suggestions", []),
        ))

    return criterion_scores, round(min(overall, 100.0), 1)


async def evaluate_run(
    run: Run,
    rubric: Rubric,
    provider: ModelProvider,
    pass_threshold: float,
    owner_uid: str,
    judge_model: str | None = None,
) -> EvalResult:
    if run.output is None:
        raise ValueError("Cannot evaluate a run with no output")

    from app.services.model_provider import VertexAIProvider, get_judge_provider
    judge = get_judge_provider()

    # Truncate aggressively — judge only needs enough context to score
    truncated_output = run.output[:3000] if len(run.output) > 3000 else run.output
    truncated_prompt = run.rendered_prompt[:800] if len(run.rendered_prompt) > 800 else run.rendered_prompt

    criteria_text = "\n".join(
        f"- {c.name} (weight {c.weight:.0%}): {c.description}"
        for c in rubric.criteria
    )

    judge_prompt = f"""You are an expert evaluator. Score this AI output against the rubric.

ORIGINAL PROMPT (excerpt):
{truncated_prompt}

MODEL OUTPUT (excerpt):
{truncated_output}

RUBRIC CRITERIA (score each 0-10):
{criteria_text}

RULES:
- Score MUST be 0 to 10. Never higher than 10.
- Use EXACT criterion names from the rubric above.
- rationale: max 10 words
- suggestions: max 1 item, max 8 words
- summary: max 20 words
- top_improvements: exactly 3 items, max 10 words each

Return ONLY this JSON, single line, no markdown:
{{"criterion_scores":[{{"name":"<exact name from rubric>","score":<0-10>,"rationale":"<10 words>","suggestions":["<8 words>"]}}],"summary":"<20 words>","top_improvements":["<10 words>","<10 words>","<10 words>"]}}"""


    import logging
    logging.getLogger("promptforge").info(
        f"EVAL DEBUG — rubric: '{rubric.name}' | "
        f"criteria: {[c.name for c in rubric.criteria]} | "
        f"run_id: {run.run_id if hasattr(run, 'run_id') else run.id}"
    )
    start = time.perf_counter()
    result = await judge.generate(
        prompt=judge_prompt,
        temperature=0.1,
        max_tokens=6500,
    )
    latency_ms = round((time.perf_counter() - start) * 1000, 2)

    raw = _parse_judge_response(result.content)
    criterion_scores, overall_score = _compute_criterion_scores(
        raw.get("criterion_scores", []),
        rubric,
    )

    # If no criterion scores matched, return a meaningful failure
    if not criterion_scores:
        import logging
        logging.getLogger("promptforge").error(
            f"No criterion scores matched. "
            f"Rubric names: {[c.name for c in rubric.criteria]}. "
            f"Raw scores: {[r.get('name') for r in raw.get('criterion_scores', [])]}"
        )

    return EvalResult(
        run_id=run.id,
        prompt_id=run.prompt_id,
        version_number=run.version_number,
        rubric_id=rubric.id or "default",
        rubric_name=rubric.name,
        judge_model=judge.default_model(),
        overall_score=overall_score,
        passed=overall_score >= pass_threshold,
        pass_threshold=pass_threshold,
        criterion_scores=criterion_scores,
        summary=raw.get("summary", ""),
        top_improvements=raw.get("top_improvements", []),
        latency_ms=latency_ms,
        created_at=datetime.utcnow(),
        owner_uid=owner_uid,
    )