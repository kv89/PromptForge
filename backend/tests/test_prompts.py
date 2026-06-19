"""Tests for the prompt endpoints using a mocked FirestoreService."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.core.exceptions import PromptNotFoundError
from app.dependencies import get_current_user
from app.main import app
from app.models.prompt import Prompt, PromptStatus, PromptVersion
from app.models.user import User, UserRole
from app.services.firestore_service import get_firestore_service

FAKE_UID = "user-123"
FAKE_EMAIL = "tester@example.com"


def _fake_user() -> User:
    return User(
        uid=FAKE_UID,
        email=FAKE_EMAIL,
        display_name="Tester",
        role=UserRole.EDITOR,
        created_at=datetime.now(timezone.utc),
    )


def _make_prompt(owner_uid: str = FAKE_UID, prompt_id: str = "p1") -> Prompt:
    now = datetime.now(timezone.utc)
    return Prompt(
        id=prompt_id,
        name="Example prompt",
        description="A test prompt",
        use_case_id="uc1",
        use_case_slug="example-use-case",
        use_case_name="Example Use Case",
        status=PromptStatus.DRAFT,
        current_version=1,
        versions=[
            PromptVersion(
                version_number=1,
                content="Hello {{name}}",
                variables=[],
                created_at=now,
                created_by=FAKE_EMAIL,
            )
        ],
        owner_uid=owner_uid,
        owner_email=FAKE_EMAIL,
        created_at=now,
        updated_at=now,
    )


@pytest.fixture
def mock_service() -> Iterator[AsyncMock]:
    """Override auth + Firestore dependencies with a mocked async service."""
    service = AsyncMock()
    app.dependency_overrides[get_current_user] = _fake_user
    app.dependency_overrides[get_firestore_service] = lambda: service
    yield service
    app.dependency_overrides.clear()


async def test_create_prompt_returns_201(
    client: AsyncClient, mock_service: AsyncMock
) -> None:
    mock_service.create_prompt.return_value = _make_prompt()

    response = await client.post(
        "/api/v1/prompts",
        json={
            "name": "Example prompt",
            "description": "A test prompt",
            "use_case_id": "uc1",
            "initial_content": "Hello {{name}}",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == "p1"
    assert body["owner_uid"] == FAKE_UID
    assert body["status"] == "DRAFT"
    mock_service.create_prompt.assert_awaited_once()


async def test_list_prompts_returns_200_list(
    client: AsyncClient, mock_service: AsyncMock
) -> None:
    mock_service.list_prompts.return_value = [_make_prompt()]

    response = await client.get("/api/v1/prompts")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 1
    assert body[0]["id"] == "p1"


async def test_get_prompt_returns_404_when_missing(
    client: AsyncClient, mock_service: AsyncMock
) -> None:
    mock_service.get_prompt.side_effect = PromptNotFoundError("missing")

    response = await client.get("/api/v1/prompts/missing")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == 404


async def test_get_prompt_returns_403_for_non_owner(
    client: AsyncClient, mock_service: AsyncMock
) -> None:
    mock_service.get_prompt.return_value = _make_prompt(owner_uid="someone-else")

    response = await client.get("/api/v1/prompts/p1")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == 403
