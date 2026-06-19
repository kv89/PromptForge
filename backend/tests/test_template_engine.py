"""Unit tests for the prompt template engine."""

from __future__ import annotations

import pytest

from app.core.exceptions import InvalidVariableError
from app.core.template_engine import extract_variables, render_prompt


def test_extract_variables_returns_unique_names_in_order() -> None:
    template = "Hi {{name}}, your order {{order_id}} for {{name}} is ready."
    assert extract_variables(template) == ["name", "order_id"]


def test_extract_variables_handles_whitespace_and_empty() -> None:
    assert extract_variables("{{  spaced_name  }}") == ["spaced_name"]
    assert extract_variables("no variables here") == []


def test_render_prompt_substitutes_all_occurrences() -> None:
    template = "Hello {{name}}! Bye {{name}}."
    assert render_prompt(template, {"name": "Ada"}) == "Hello Ada! Bye Ada."


def test_render_prompt_ignores_extra_variables() -> None:
    result = render_prompt("Hi {{name}}", {"name": "Ada", "unused": "x"})
    assert result == "Hi Ada"


def test_render_prompt_raises_on_missing_variable() -> None:
    with pytest.raises(InvalidVariableError) as exc_info:
        render_prompt("Hello {{name}} from {{city}}", {"name": "Ada"})
    assert exc_info.value.variable_name == "city"
