"""Use case REST endpoints.

Use cases are global to the platform (shared across all users). Listing is
public; creation requires authentication.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.models.prompt import UseCaseCreate, UseCaseResponse
from app.models.user import User
from app.services.firestore_service import FirestoreService, get_firestore_service

router = APIRouter(prefix="/use-cases", tags=["use-cases"])


@router.post(
    "",
    response_model=UseCaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a use case",
    responses={
        201: {"description": "Use case created successfully."},
        401: {"description": "Authentication required."},
        409: {"description": "A use case with the derived slug already exists."},
    },
)
async def create_use_case(
    data: UseCaseCreate,
    current_user: User = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service),
) -> UseCaseResponse:
    """Create a new, globally-shared use case owned by the current user."""
    try:
        return await firestore_service.create_use_case(data, current_user.uid)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get(
    "",
    response_model=list[UseCaseResponse],
    summary="List all use cases",
    responses={200: {"description": "All use cases, ordered by name ascending."}},
)
async def list_use_cases(
    firestore_service: FirestoreService = Depends(get_firestore_service),
) -> list[UseCaseResponse]:
    """List every use case on the platform. No authentication required."""
    return await firestore_service.list_use_cases()
