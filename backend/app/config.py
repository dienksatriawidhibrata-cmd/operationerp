from functools import lru_cache
import os

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field(default="Bagi Kopi Ops API", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_host: str = Field(default="127.0.0.1", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    app_cors_origins: str = Field(default="http://localhost:5173,http://localhost:5174", alias="APP_CORS_ORIGINS")

    supabase_url: str = Field(default_factory=lambda: os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or "", alias="SUPABASE_URL")
    supabase_key: str = Field(default_factory=lambda: os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "", alias="SUPABASE_KEY")
    google_service_account_json: str | None = Field(default=None, alias="GOOGLE_SERVICE_ACCOUNT_JSON")
    google_service_account_file: str | None = Field(default=None, alias="GOOGLE_SERVICE_ACCOUNT_FILE")
    google_sop_folder_id: str | None = Field(default=None, alias="GOOGLE_SOP_FOLDER_ID")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.app_cors_origins.split(",") if origin.strip()]

    @property
    def resolved_google_sop_folder_id(self) -> str | None:
        return self.google_sop_folder_id or os.getenv("VITE_GOOGLE_SOP_FOLDER_ID")


@lru_cache
def get_settings() -> Settings:
    return Settings()
