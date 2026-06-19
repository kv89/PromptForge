"""Data models for prompt runs."""

from datetime import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict


class RunStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class RunRequest(BaseModel):
    """Request body for POST /runs."""
    prompt_id: str
    version_number: int
    variables: dict[str, str] = {}
    temperature: float = 0.7
    max_tokens: int = 2048
    model: str | None = None


class Run(BaseModel):
    """A single prompt run stored in Firestore."""
    model_config = ConfigDict(use_enum_values=True)

    id: str | None = None
    prompt_id: str
    prompt_name: str
    version_number: int
    rendered_prompt: str
    variables: dict[str, str]
    model: str
    temperature: float
    max_tokens: int
    status: RunStatus = RunStatus.PENDING
    output: str | None = None
    error: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0
    created_at: datetime
    completed_at: datetime | None = None
    owner_uid: str
    overall_score: float | None = None   # populated after evaluation


class RunResponse(Run):
    """Run model with id always present."""
    id: str


class RunSummary(BaseModel):
    """Lightweight run model for list views."""
    id: str
    prompt_id: str
    prompt_name: str
    version_number: int
    model: str
    status: RunStatus
    overall_score: float | None = None
    latency_ms: float
    total_tokens: int
    created_at: datetime

class StabilityResult(BaseModel):
    """Result of a stability test — N runs of the same prompt."""
    prompt_id: str
    version_number: int
    runs: int
    scores: list[float]
    avg_score: float
    std_dev: float
    stability_index: float    # 0-100, higher = more stable
    min_score: float
    max_score: float
    is_stable: bool           # True if std_dev < 5.0
    run_ids: list[str]