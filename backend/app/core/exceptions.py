"""Domain-specific exceptions for the PromptForge service.

These exceptions carry semantic meaning and are mapped to HTTP responses by the
global exception handlers registered in :mod:`app.main`.
"""

from __future__ import annotations


class PromptForgeError(Exception):
    """Base class for all PromptForge domain errors."""


class PromptNotFoundError(PromptForgeError):
    """Raised when a prompt cannot be located by its identifier."""

    def __init__(self, prompt_id: str) -> None:
        self.prompt_id = prompt_id
        super().__init__(f"Prompt {prompt_id} not found")


class PromptPermissionError(PromptForgeError):
    """Raised when a user attempts to modify a prompt they do not own."""

    def __init__(self, user_email: str) -> None:
        self.user_email = user_email
        super().__init__(
            f"User {user_email} does not have permission to modify this prompt"
        )


class FirestoreWriteError(PromptForgeError):
    """Raised when a write to Firestore fails."""

    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class InvalidVariableError(PromptForgeError):
    """Raised when a prompt references a variable that is invalid or undefined."""

    def __init__(self, variable_name: str) -> None:
        self.variable_name = variable_name
        super().__init__(f"Invalid prompt variable: {variable_name}")
