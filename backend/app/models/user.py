"""Pydantic v2 data models for PromptForge users and access roles."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class UserRole(str, Enum):
    """Access role determining a user's permissions within PromptForge."""

    ADMIN = "ADMIN"
    EDITOR = "EDITOR"
    VIEWER = "VIEWER"


class User(BaseModel):
    """A PromptForge user, backed by Firebase Auth."""

    uid: str = Field(description="Firebase Auth user UID.")
    email: str
    display_name: str
    role: UserRole = UserRole.EDITOR
    created_at: datetime
