"""
Model provider abstraction layer.
Swap between Ollama (local) and Vertex AI (production) via config.

To switch to Vertex AI:
  MODEL_PROVIDER=vertexai
  VERTEXAI_DEFAULT_MODEL=gemini-2.0-flash
  VERTEXAI_JUDGE_MODEL=gemini-2.0-flash
  GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
"""

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from functools import lru_cache

import httpx

from app.config import get_settings


@dataclass
class ModelResult:
    """Result returned by any model provider."""
    content: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    latency_ms: float


class ModelProvider(ABC):
    """Abstract base class for model providers."""

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        temperature: float,
        max_tokens: int,
    ) -> ModelResult:
        """Call the model and return a ModelResult."""
        ...

    @abstractmethod
    def default_model(self) -> str:
        """Return the default model name for this provider."""
        ...


# ── Ollama ────────────────────────────────────────────────────────────────────

class OllamaProvider(ModelProvider):
    """Calls a locally running Ollama server."""

    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.ollama_base_url
        self.model_name = settings.ollama_default_model

    def default_model(self) -> str:
        return self.model_name

    async def generate(
        self,
        prompt: str,
        temperature: float,
        max_tokens: int,
    ) -> ModelResult:
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        start = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json=payload,
                )
                response.raise_for_status()
        except httpx.ConnectError:
            raise RuntimeError(
                "Ollama is not running. Start it with: docker start ollama"
            )
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"Ollama returned an error: {e.response.text}")

        latency_ms = (time.perf_counter() - start) * 1000
        data = response.json()

        return ModelResult(
            content=data.get("response", ""),
            model=self.model_name,
            prompt_tokens=data.get("prompt_eval_count", 0),
            completion_tokens=data.get("eval_count", 0),
            latency_ms=round(latency_ms, 2),
        )


# ── Vertex AI ─────────────────────────────────────────────────────────────────

class VertexAIProvider(ModelProvider):
    """
    Calls Google Gemini models via the Gemini API (Google AI Studio).

    Requirements:
    - google-generativeai installed
    - GEMINI_API_KEY set to your Google AI Studio API key
      Get one at: https://aistudio.google.com/apikey

    To switch to this provider:
      MODEL_PROVIDER=vertexai
      GEMINI_API_KEY=your-key-here
      VERTEXAI_DEFAULT_MODEL=gemini-2.0-flash
    """

    def __init__(self, model_name: str | None = None) -> None:
        settings = get_settings()
        self.model_name = model_name or settings.vertexai_default_model
        self.api_key = settings.gemini_api_key

        if not self.api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. "
                "Get one at https://aistudio.google.com/apikey "
                "and add it to backend/.env"
            )

    def default_model(self) -> str:
        return self.model_name

    async def generate(
        self,
        prompt: str,
        temperature: float,
        max_tokens: int,
    ) -> ModelResult:
        try:
            import google.generativeai as genai
        except ImportError:
            raise RuntimeError(
                "google-generativeai is not installed. "
                "Run: pip install google-generativeai==0.7.2"
            )

        genai.configure(api_key=self.api_key)
        model = genai.GenerativeModel(self.model_name)

        generation_config = genai.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        start = time.perf_counter()
        try:
            response = await model.generate_content_async(
                prompt,
                generation_config=generation_config,
            )
        except Exception as e:
            raise RuntimeError(f"Gemini API call failed: {str(e)}")

        latency_ms = (time.perf_counter() - start) * 1000

        # Extract token counts
        usage = getattr(response, "usage_metadata", None)
        prompt_tokens = getattr(usage, "prompt_token_count", 0) or 0
        completion_tokens = getattr(usage, "candidates_token_count", 0) or 0

        return ModelResult(
            content=response.text,
            model=self.model_name,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=round(latency_ms, 2),
        )


# ── Factory ───────────────────────────────────────────────────────────────────

@lru_cache
def get_model_provider() -> ModelProvider:
    """Factory — returns the configured model provider singleton."""
    settings = get_settings()
    if settings.model_provider == "ollama":
        return OllamaProvider()
    if settings.model_provider == "vertexai":
        return VertexAIProvider()
    raise ValueError(f"Unknown model_provider: '{settings.model_provider}'")


def get_judge_provider() -> ModelProvider:
    """
    Returns the provider to use for AI judging.
    Configured independently from the executor provider via JUDGE_PROVIDER.
    """
    settings = get_settings()
    judge_provider = settings.judge_provider

    if judge_provider == "vertexai":
        return VertexAIProvider(model_name=settings.vertexai_judge_model)

    # Default: Ollama with the configured judge model
    provider = OllamaProvider()
    provider.model_name = settings.judge_model
    return provider