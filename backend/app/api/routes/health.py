import httpx
from fastapi import APIRouter
from app.config import get_settings
from app.services.firestore_service import get_firestore_service

router = APIRouter(tags=["health"])
settings = get_settings()


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "version": settings.app_version,
        "environment": settings.environment,
    }


@router.get("/health/firestore")
async def health_firestore():
    try:
        svc = get_firestore_service()
        await svc._db.collection("_health").document("ping").get()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@router.get("/health/ollama")
async def health_ollama():
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.ollama_base_url}/api/tags")
            response.raise_for_status()
            data = response.json()
            models = [m["name"] for m in data.get("models", [])]
            return {"status": "ok", "models": models}
    except Exception:
        return {
            "status": "error",
            "detail": "Ollama is not running. Start it with: docker start ollama",
        }

@router.get("/health/gemini")
async def health_gemini():
    """Check Gemini API connectivity."""
    settings = get_settings()
    if settings.model_provider != "vertexai":
        return {"status": "not_configured", "detail": "MODEL_PROVIDER is not vertexai"}
    if not settings.gemini_api_key:
        return {"status": "error", "detail": "GEMINI_API_KEY is not set"}
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.vertexai_default_model)
        # Minimal test call
        response = await model.generate_content_async("Say 'ok' in one word.")
        return {
            "status": "ok",
            "model": settings.vertexai_default_model,
            "response": response.text.strip()[:20],
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}