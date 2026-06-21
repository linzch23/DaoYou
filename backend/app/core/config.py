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
    llm_provider: str = "openai"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_timeout_seconds: float = 20.0
    vivo_app_id: str = ""
    vivo_app_key: str = ""
    vivo_base_url: str = "https://api-ai.vivo.com.cn"
    vivo_completions_uri: str = "/vivogpt/completions"
    vivo_model: str = "vivo-BlueLM-TB"
    amap_api_key: str = ""
    amap_base_url: str = "https://restapi.amap.com"
    amap_timeout_seconds: float = 10.0
    vision_provider: str = "mock"
    qwen_api_key: str = ""
    qwen_base_url: str = "https://dashscope.aliyuncs.com"
    qwen_vision_model: str = "qwen-vl-plus"
    qwen_timeout_seconds: float = 30.0
    ocr_provider: str = "mock"
    vivo_ocr_uri: str = "/ocr/general_recognition"
    vivo_ocr_timeout_seconds: float = 20.0

    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()

