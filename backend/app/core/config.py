from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "DaoYou API"
    app_env: str = "local"
    app_debug: bool = True
    api_prefix: str = "/api"
    database_url: str = "postgresql+psycopg://daoyou:daoyou@localhost:5432/daoyou"
    default_user_id: int = 1
    upload_dir: str = "uploads"
    max_upload_size_mb: int = 10

    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()

