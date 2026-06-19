"""Prompt management REST endpoints.

All routes require authentication. Ownership is enforced per-prompt: a user may
only read or mutate prompts whose ``owner_uid`` matches their own UID.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, FastAPI, Request, Response, status
from fastapi.responses import JSONResponse

from app.core.exceptions import PromptNotFoundError, PromptPermissionError
from app.dependencies import get_current_user
from app.models.prompt import (
    PromptCreate,
    PromptResponse,
    PromptUpdate,
    PromptVersion,
)
from app.models.user import User
from app.services.firestore_service import FirestoreService, get_firestore_service

router = APIRouter(prefix="/prompts", tags=["prompts"])


def _error_response(code: int, message: str) -> JSONResponse:
    """Build the platform-wide JSON error envelope."""
    return JSONResponse(status_code=code, content={"error": {"code": code, "message": message}})


async def _prompt_not_found_handler(request: Request, exc: PromptNotFoundError) -> JSONResponse:
    """Map :class:`PromptNotFoundError` to an HTTP 404 response."""
    return _error_response(status.HTTP_404_NOT_FOUND, str(exc))


async def _prompt_permission_handler(request: Request, exc: PromptPermissionError) -> JSONResponse:
    """Map :class:`PromptPermissionError` to an HTTP 403 response."""
    return _error_response(status.HTTP_403_FORBIDDEN, str(exc))


def register_exception_handlers(app: FastAPI) -> None:
    """Register prompt-domain exception handlers on the application.

    FastAPI exception handlers must live on the app rather than an ``APIRouter``,
    so this helper keeps the mapping co-located with the prompt routes while
    wiring it in from :mod:`app.main`.
    """
    app.add_exception_handler(PromptNotFoundError, _prompt_not_found_handler)
    app.add_exception_handler(PromptPermissionError, _prompt_permission_handler)


@router.post(
    "",
    response_model=PromptResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a prompt",
    responses={
        201: {"description": "Prompt created with its initial version."},
        401: {"description": "Authentication required."},
        404: {"description": "The referenced use case does not exist."},
    },
)
async def create_prompt(
    data: PromptCreate,
    current_user: User = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service),
) -> PromptResponse:
    """Create a new prompt owned by the current user under a given use case."""
    return await firestore_service.create_prompt(data, current_user.uid, current_user.email)


@router.get(
    "",
    response_model=list[PromptResponse],
    summary="List the current user's prompts",
    responses={
        200: {"description": "Prompts owned by the user, newest first."},
        401: {"description": "Authentication required."},
    },
)
async def list_prompts(
    use_case_slug: str | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service),
) -> list[PromptResponse]:
    """List prompts owned by the current user, optionally filtered."""
    return await firestore_service.list_prompts(current_user.uid, use_case_slug, status)


@router.get(
    "/{prompt_id}",
    response_model=PromptResponse,
    summary="Get a single prompt",
    responses={
        200: {"description": "The requested prompt."},
        401: {"description": "Authentication required."},
        403: {"description": "The prompt is owned by another user."},
        404: {"description": "No prompt exists with the given ID."},
    },
)
async def get_prompt(
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service),
) -> PromptResponse:
    """Fetch a prompt the current user owns."""
    prompt = await firestore_service.get_prompt(prompt_id)
    if prompt.owner_uid != current_user.uid:
        raise PromptPermissionError(current_user.email)
    return prompt


@router.post(
    "/{prompt_id}/versions",
    response_model=PromptResponse,
    summary="Save a new prompt version",
    responses={
        200: {"description": "A new version was appended to the prompt."},
        401: {"description": "Authentication required."},
        403: {"description": "The prompt is owned by another user."},
        404: {"description": "No prompt exists with the given ID."},
    },
)
async def create_version(
    prompt_id: str,
    data: PromptUpdate,
    current_user: User = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service),
) -> PromptResponse:
    """Append a new version to an existing prompt owned by the current user."""
    prompt = await firestore_service.get_prompt(prompt_id)
    if prompt.owner_uid != current_user.uid:
        raise PromptPermissionError(current_user.email)
    return await firestore_service.update_prompt(prompt_id, data, current_user.email)


@router.get(
    "/{prompt_id}/versions",
    response_model=list[PromptVersion],
    summary="List a prompt's versions",
    responses={
        200: {"description": "All versions of the prompt, ordered ascending."},
        401: {"description": "Authentication required."},
        403: {"description": "The prompt is owned by another user."},
        404: {"description": "No prompt exists with the given ID."},
    },
)
async def list_versions(
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service),
) -> list[PromptVersion]:
    """Return every saved version of a prompt the current user owns."""
    prompt = await firestore_service.get_prompt(prompt_id)
    if prompt.owner_uid != current_user.uid:
        raise PromptPermissionError(current_user.email)
    return await firestore_service.get_versions(prompt_id)


@router.post(
    "/{prompt_id}/versions/{version_number}/promote",
    response_model=PromptResponse,
    summary="Promote a version to stable",
    responses={
        200: {"description": "The version was marked stable and the prompt activated."},
        401: {"description": "Authentication required."},
        403: {"description": "The prompt is owned by another user."},
        404: {"description": "No such prompt or version."},
    },
)
async def promote_version(
    prompt_id: str,
    version_number: int,
    current_user: User = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service),
) -> PromptResponse:
    """Mark a specific version stable and set the prompt status to ACTIVE."""
    prompt = await firestore_service.get_prompt(prompt_id)
    if prompt.owner_uid != current_user.uid:
        raise PromptPermissionError(current_user.email)
    return await firestore_service.promote_to_stable(prompt_id, version_number)


@router.delete(
    "/{prompt_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archive a prompt",
    responses={
        204: {"description": "The prompt was archived."},
        401: {"description": "Authentication required."},
        403: {"description": "The prompt is owned by another user."},
        404: {"description": "No prompt exists with the given ID."},
    },
)
async def archive_prompt(
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    firestore_service: FirestoreService = Depends(get_firestore_service),
) -> Response:
    """Archive a prompt the current user owns (soft delete)."""
    prompt = await firestore_service.get_prompt(prompt_id)
    if prompt.owner_uid != current_user.uid:
        raise PromptPermissionError(current_user.email)
    await firestore_service.archive_prompt(prompt_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

class ImprovePromptRequest(BaseModel):
    prompt_id: str
    version_number: int
    selected_improvements: list[str]
    mode: str = "surgical"  # "surgical" | "holistic"

class ImprovePromptResponse(BaseModel):
    rewritten_prompt: str
    mode: str

@router.post("/{prompt_id}/improve", response_model=ImprovePromptResponse)
async def improve_prompt(
    prompt_id: str,
    request: ImprovePromptRequest,
    current_user: User = Depends(get_current_user),
):
    """Use the model to rewrite a prompt incorporating selected improvements."""
    firestore = get_firestore_service()
    prompt = await firestore.get_prompt(prompt_id)

    if prompt.owner_uid != current_user.uid:
        raise HTTPException(status_code=403, detail="Access denied")

    version = next(
        (v for v in prompt.versions if v.version_number == request.version_number),
        None,
    )
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    improvements_text = "\n".join(
        f"- {imp}" for imp in request.selected_improvements
    )

    if request.mode == "surgical":
        rewrite_instruction = (
            "Rewrite ONLY the parts of the prompt needed to address the selected improvements. "
            "Preserve everything else exactly — structure, tone, variables, and intent must remain unchanged."
        )
    else:
        rewrite_instruction = (
            "Rewrite the entire prompt to incorporate the selected improvements. "
            "You may restructure and rephrase for clarity, but preserve all {{variable}} placeholders exactly."
        )

    rewrite_prompt = f"""You are an expert prompt engineer working on a general-purpose AI prompt.

ORIGINAL PROMPT:
{version.content}

SELECTED IMPROVEMENTS TO APPLY:
{improvements_text}

INSTRUCTION:
{rewrite_instruction}

Important rules:
- Preserve all {{{{variable}}}} placeholders exactly as they appear
- Output ONLY the rewritten prompt text
- Do not add explanations, preamble, or commentary
- Do not wrap in quotes or code blocks"""

    from app.services.model_provider import get_model_provider
    provider = get_model_provider()

    try:
        result = await provider.generate(
            prompt=rewrite_prompt,
            temperature=0.3,
            max_tokens=2048,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return ImprovePromptResponse(
        rewritten_prompt=result.content.strip(),
        mode=request.mode,
    )