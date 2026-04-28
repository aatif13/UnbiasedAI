"""Application settings loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the FastAPI service."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "UnbiasedAI API"
    cors_origins: str = "http://localhost:3000"
    upload_dir: str = "data/uploads"
    demo_mode: bool = False
    redis_url: str | None = None
    rate_limit_audits_per_hour: int = 10


@lru_cache
def get_settings() -> Settings:
    """Return cached settings singleton."""

    return Settings()
