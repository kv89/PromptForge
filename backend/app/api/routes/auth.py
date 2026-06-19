"""Authentication endpoints.

This module currently exposes only the router scaffold; concrete auth endpoints
(e.g. current-user lookup, session exchange) are implemented in a later step.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["auth"])
