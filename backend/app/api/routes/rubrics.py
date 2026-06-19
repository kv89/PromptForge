"""Rubric management API routes."""

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.models.eval import EvalResult, Rubric, RubricCreate
from app.models.user import User
from app.services.eval_service import DEFAULT_RUBRIC
from app.services.firestore_service import get_firestore_service

router = APIRouter(prefix="/rubrics", tags=["rubrics"])


@router.get("", response_model=list[Rubric])
async def list_rubrics(
    use_case_id: str | None = None,
    current_user: User = Depends(get_current_user),
):
    """List all rubrics. Includes the default rubric first."""
    firestore = get_firestore_service()
    rubrics = await firestore.list_rubrics(use_case_id)
    # Always prepend the default rubric
    return [DEFAULT_RUBRIC] + rubrics


@router.post("", response_model=Rubric, status_code=201)
async def create_rubric(
    data: RubricCreate,
    current_user: User = Depends(get_current_user),
):
    """Create a custom rubric, optionally tied to a use case."""
    # Validate weights sum to 1.0
    total = sum(c.weight for c in data.criteria)
    if not (0.99 <= total <= 1.01):
        raise HTTPException(
            status_code=400,
            detail=f"Criterion weights must sum to 1.0 (got {round(total, 3)})",
        )
    firestore = get_firestore_service()
    return await firestore.create_rubric(data, current_user.uid)


@router.get("/{rubric_id}", response_model=Rubric)
async def get_rubric(
    rubric_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get a specific rubric by ID. Returns default rubric for id='default'."""
    if rubric_id == "default":
        return DEFAULT_RUBRIC
    firestore = get_firestore_service()
    return await firestore.get_rubric(rubric_id)