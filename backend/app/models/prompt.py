"""Pydantic v2 data models for the PromptForge prompt management system.

PromptForge is a general-purpose, domain-agnostic prompt evaluation platform.
Use cases are user-defined strings (e.g. "TF Code Generation", "Invoice Parser")
stored as their own Firestore collection so they can be managed, listed, and
reused across prompts. Each prompt keeps a versioned history in Firestore.
"""

from __future__ import annotations

import re
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _slugify(value: str) -> str:
    """Derive a stable, URL-safe slug from an arbitrary label."""
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


class PromptVariable(BaseModel):
    """An injectable variable referenced as ``{{name}}`` inside a prompt template."""

    name: str
    description: str
    example_value: str
    required: bool = True


class PromptVersion(BaseModel):
    """A single saved, immutable version of a prompt's content and variables."""

    version_number: int
    content: str = Field(description="Raw prompt text with {{variable}} placeholders.")
    variables: list[PromptVariable]
    created_at: datetime
    created_by: str = Field(description="Email of the user who created this version.")
    change_note: str | None = Field(default=None, description="What changed in this version.")
    is_stable: bool = Field(default=False, description="Promoted to stable by the user.")
    tags: list[str] = Field(default_factory=list)


class PromptStatus(str, Enum):
    """Lifecycle status of a prompt."""

    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"
    DEPRECATED = "DEPRECATED"


class UseCase(BaseModel):
    """A user-defined use case, stored as its own Firestore document.

    Use cases are not a fixed enum; any user can create any use case. The
    ``slug`` is auto-derived from ``name`` and acts as a stable identifier for
    queries and URL params.
    """

    id: str | None = Field(default=None, description="Firestore document ID.")
    name: str = Field(description='User-defined label, e.g. "TF Code Generation".')
    slug: str = Field(
        default="",
        validate_default=True,
        description='Auto-derived from name, lowercase + hyphens, e.g. "tf-code-generation".',
    )
    description: str | None = None
    icon: str | None = Field(default=None, description="Optional emoji or icon name chosen by user.")
    created_by: str = Field(description="Owner UID.")
    created_at: datetime
    prompt_count: int = Field(
        default=0,
        description="Denormalised count, updated on prompt create/archive.",
    )

    @field_validator("slug", mode="before")
    @classmethod
    def _derive_slug(cls, value: str | None, info) -> str:
        """Auto-derive the slug from ``name`` when one is not explicitly provided."""
        if value:
            return value
        name = info.data.get("name")
        return _slugify(name) if name else ""


class Prompt(BaseModel):
    """The main prompt document model, persisted in Firestore.

    Carries denormalised use case fields (``use_case_slug`` and
    ``use_case_name``) so prompts can be filtered and rendered without joining
    against the use cases collection.
    """

    model_config = ConfigDict(use_enum_values=True)

    id: str | None = Field(default=None, description="Firestore document ID, None before first save.")
    name: str
    description: str
    use_case_id: str = Field(description="Firestore document ID of the UseCase document.")
    use_case_slug: str = Field(description="Denormalised slug for fast filtering without a join.")
    use_case_name: str = Field(description="Denormalised display name for rendering without a join.")
    status: PromptStatus = PromptStatus.DRAFT
    current_version: int = 1
    versions: list[PromptVersion]
    owner_uid: str = Field(description="Firebase Auth user UID.")
    owner_email: str
    created_at: datetime
    updated_at: datetime


class PromptCreate(BaseModel):
    """Request body for creating a new prompt with its initial version."""

    name: str
    description: str
    use_case_id: str
    initial_content: str
    variables: list[PromptVariable] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class PromptUpdate(BaseModel):
    """Request body for saving a new version of an existing prompt."""

    content: str
    variables: list[PromptVariable] = Field(default_factory=list)
    change_note: str | None = None
    tags: list[str] = Field(default_factory=list)


class PromptResponse(Prompt):
    """Response model for a prompt; ``id`` is always populated."""

    id: str = Field(description="Firestore document ID.")


class UseCaseCreate(BaseModel):
    """Request body for creating a use case."""

    name: str
    description: str | None = None
    icon: str | None = None


class UseCaseResponse(UseCase):
    """Response model for a use case; ``id`` is always populated."""

    id: str = Field(description="Firestore document ID.")
