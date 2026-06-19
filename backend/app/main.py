"""PromptForge FastAPI application entrypoint.

Wires together configuration, middleware, routers, Firebase initialisation, and
global exception handling into a single ASGI application.
"""

from __future__ import annotations

import json
import logging
import sys
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import auth, health, prompts, use_cases
from app.config import get_settings
from app.api.routes import runs
from app.api.routes import rubrics

API_PREFIX = "/api/v1"

# Frontend dev servers that must always be allowed when running locally.
DEV_CORS_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]


def _resolve_cors_origins(settings) -> list[str]:
    """Compute allowed CORS origins, guaranteeing the dev origins in dev mode."""
    origins = list(settings.cors_origins)
    if settings.environment == "dev":
        for origin in DEV_CORS_ORIGINS:
            if origin not in origins:
                origins.append(origin)
    return origins

logger = logging.getLogger("promptforge")
if not logger.handlers:
    _handler = logging.StreamHandler(sys.stdout)
    _handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


def _error_response(code: int, message: str) -> JSONResponse:
    """Build a JSON error response with the platform-wide error envelope."""
    return JSONResponse(status_code=code, content={"error": {"code": code, "message": message}})


def create_app() -> FastAPI:
    """Construct and configure the FastAPI application instance."""
    settings = get_settings()

    app = FastAPI(title="PromptForge API", version=settings.app_version)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_resolve_cors_origins(settings),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        """Emit a structured JSON access log line for every request."""
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.info(
            json.dumps(
                {
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                }
            )
        )
        return response

    app.include_router(health.router, prefix=API_PREFIX)
    app.include_router(prompts.router, prefix=API_PREFIX)
    app.include_router(use_cases.router, prefix=API_PREFIX)
    app.include_router(auth.router, prefix=API_PREFIX)
    app.include_router(runs.router, prefix="/api/v1")
    app.include_router(rubrics.router, prefix="/api/v1")

    prompts.register_exception_handlers(app)

    @app.on_event("startup")
    async def init_firebase() -> None:
        """Initialise the Firebase Admin SDK once at startup.

        Uses the service-account credentials path from settings when provided,
        otherwise falls back to application default credentials. Initialisation
        is idempotent and tolerant of a missing/invalid credentials file so the
        app can still boot (e.g. in local/health-check scenarios).
        """
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:
            return

        cred_path = settings.google_application_credentials
        try:
            if cred_path:
                cred = credentials.Certificate(cred_path)
            else:
                cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(
                cred,
                {"projectId": settings.firebase_project_id} if settings.firebase_project_id else None,
            )
            logger.info(json.dumps({"event": "firebase_initialised", "using_cert": bool(cred_path)}))
        except Exception as exc:  # noqa: BLE001 - never block startup on auth setup
            logger.warning(json.dumps({"event": "firebase_init_failed", "detail": str(exc)}))

    @app.exception_handler(ValueError)
    async def handle_value_error(request: Request, exc: ValueError) -> JSONResponse:
        return _error_response(400, str(exc))

    @app.exception_handler(PermissionError)
    async def handle_permission_error(request: Request, exc: PermissionError) -> JSONResponse:
        return _error_response(403, str(exc))

    @app.exception_handler(FileNotFoundError)
    async def handle_not_found_error(request: Request, exc: FileNotFoundError) -> JSONResponse:
        return _error_response(404, str(exc))

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.error(json.dumps({"event": "unhandled_exception", "detail": str(exc)}))
        return _error_response(500, "Internal server error")

    return app


app = create_app()
