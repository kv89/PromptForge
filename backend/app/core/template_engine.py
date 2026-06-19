"""Prompt template rendering and variable extraction.

Variables are written as ``{{variable_name}}`` inside a prompt template, matching
the convention used by the frontend editor. Names may contain letters, digits and
underscores, with optional surrounding whitespace inside the braces.
"""

from __future__ import annotations

import re

from app.core.exceptions import InvalidVariableError

# Matches {{ name }} / {{name}} capturing the bare variable name.
_VARIABLE_PATTERN = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


def extract_variables(template: str) -> list[str]:
    """Return the unique variable names referenced in a template, in order."""
    seen: dict[str, None] = {}
    for match in _VARIABLE_PATTERN.finditer(template):
        seen.setdefault(match.group(1), None)
    return list(seen)


def render_prompt(template: str, variables: dict[str, str]) -> str:
    """Substitute every ``{{name}}`` placeholder with its value from ``variables``.

    Raises:
        InvalidVariableError: if the template references a variable that is not
            present in ``variables``.
    """

    def _replace(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in variables:
            raise InvalidVariableError(name)
        return str(variables[name])

    return _VARIABLE_PATTERN.sub(_replace, template)
