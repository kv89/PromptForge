"""Data models for prompt evaluation — rubrics, scores, and feedback."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class RubricCriterion(BaseModel):
    """A single scoring criterion in a rubric."""
    name: str           # e.g. "relevance"
    label: str          # e.g. "Relevance"
    description: str    # what the judge checks
    weight: float       # 0.0–1.0, must sum to 1.0 across all criteria


class Rubric(BaseModel):
    """A named set of criteria used to evaluate prompt outputs."""
    model_config = ConfigDict(use_enum_values=True)

    id: str | None = None
    name: str
    description: str = ""
    use_case_id: str | None = None   # None = default rubric (applies to all)
    criteria: list[RubricCriterion]
    created_by: str = ""
    created_at: datetime = datetime.utcnow()
    is_default: bool = False


class RubricCreate(BaseModel):
    """Request body for creating a rubric."""
    name: str
    description: str = ""
    use_case_id: str | None = None
    criteria: list[RubricCriterion]


class CriterionScore(BaseModel):
    """Judge's score for a single criterion."""
    name: str
    label: str
    score: float          # 0–10
    weight: float
    weighted_score: float # score * weight * 10 (contribution to 0-100)
    rationale: str        # why this score was given
    suggestions: list[str] = []  # concrete improvements


class EvalResult(BaseModel):
    """Full evaluation result stored alongside a run."""
    model_config = ConfigDict(use_enum_values=True)

    id: str | None = None
    run_id: str
    prompt_id: str
    version_number: int
    rubric_id: str
    rubric_name: str
    judge_model: str
    overall_score: float          # 0–100 weighted average
    passed: bool                  # overall_score >= pass_threshold
    pass_threshold: float = 75.0
    criterion_scores: list[CriterionScore]
    summary: str                  # 2-3 sentence overall verdict
    top_improvements: list[str]   # top 3 actionable prompt changes
    latency_ms: float             # time taken for judge call
    created_at: datetime
    owner_uid: str


class EvalResultResponse(EvalResult):
    """EvalResult with id always present."""
    id: str


class EvalRequest(BaseModel):
    """Request body for manually triggering evaluation."""
    run_id: str
    rubric_id: str | None = None    # None = use default or use-case rubric
    pass_threshold: float = 75.0