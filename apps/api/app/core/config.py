"""Application settings loaded from environment configuration."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

ENVIRONMENT_DEV = "dev"
ENVIRONMENT_QA = "qa"
ENVIRONMENT_PROD = "prod"


class Settings(BaseSettings):
    """Typed application configuration for the dev/qa/prod profiles."""

    model_config = SettingsConfigDict(
        env_prefix="CAREEROS_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    environment: str = ENVIRONMENT_DEV
    log_level: str = "INFO"

    cors_origins: list[str] = [
        "http://localhost:8081",
        "http://localhost:19006",
    ]

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_db_password: str = ""

    gemini_api_key: str = ""
    gemini_model: str = ""

    @property
    def is_prod(self) -> bool:
        return self.environment == ENVIRONMENT_PROD


@lru_cache
def get_settings() -> Settings:
    return Settings()
