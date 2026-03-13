import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/sarvam_bot")

    # OpenAI
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # Sarvam AI
    SARVAM_API_KEY: str = os.getenv("SARVAM_API_KEY", "")

    # Groq
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    # TURN Server (WebRTC)
    TURN_URL: str = os.getenv("TURN_URL", "")
    TURN_USERNAME: str = os.getenv("TURN_USERNAME", "")
    TURN_CREDENTIAL: str = os.getenv("TURN_CREDENTIAL", "")

    # App
    APP_ENV: str = os.getenv("APP_ENV", "development")
    APP_HOST: str = os.getenv("APP_HOST", "0.0.0.0")
    APP_PORT: int = int(os.getenv("PORT", "8000"))
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-change-in-production")

    # Sarvam AI endpoints
    SARVAM_STT_URL: str = "https://api.sarvam.ai/speech-to-text"
    SARVAM_TTS_URL: str = "https://api.sarvam.ai/text-to-speech"

    # Groq API base
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"

    # Defaults
    DEFAULT_LLM_MODEL: str = "llama-3.3-70b-versatile"
    DEFAULT_LANGUAGE: str = "hindi"

    class Config:
        env_file = ".env"
        extra = "ignore"

    def get_async_db_url(self) -> str:
        """Ensure the DB URL uses asyncpg driver."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url


settings = Settings()
