from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        protected_namespaces=("settings_",)
    )

    # GCP
    gcp_project_id: str
    firebase_project_id: str
    google_application_credentials: str
    firestore_database: str = "promptforge"

    # App
    environment: str = "dev"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    app_name: str = "PromptForge"
    app_version: str = "0.1.0"

    # Model provider
    model_provider: str = "ollama"              # "ollama" | "vertexai"
    ollama_base_url: str = "http://localhost:11434"
    ollama_default_model: str = "mistral:7b"
    vertexai_location: str = "us-central1"
    vertexai_default_model: str = "gemini-1.5-flash-002"

    judge_model: str = "mistral:7b"   # configurable judge model
    auto_evaluate: bool = True         # auto-evaluate every run
    eval_pass_threshold: float = 75.0  # score >= this = passed

    # Vertex AI
    vertexai_location: str = "us-central1"
    vertexai_default_model: str = "gemini-2.0-flash"
    vertexai_judge_model: str = "gemini-2.0-flash"
    gemini_api_key: str = ""              # Google AI Studio API key

    # Judge config — works for both Ollama and Vertex AI
    judge_model: str = "mistral:7b"          # overridden per provider below
    judge_provider: str = "ollama"            # "ollama" | "vertexai"


@lru_cache
def get_settings() -> Settings:
    return Settings()