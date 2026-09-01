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

    # Adzuna job search API credentials and default country code.
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""
    adzuna_country: str = "gb"

    # Firebase Cloud Messaging service-account credentials.
    # Provide either a JSON string (FIREBASE_CREDENTIALS_JSON) or a filesystem
    # path (FIREBASE_CREDENTIALS_PATH) to the service-account key file.
    firebase_credentials_json: str = ""
    firebase_credentials_path: str = ""

    @property
    def is_prod(self) -> bool:
        return self.environment == ENVIRONMENT_PROD


@lru_cache
def get_settings() -> Settings:
    return Settings()
