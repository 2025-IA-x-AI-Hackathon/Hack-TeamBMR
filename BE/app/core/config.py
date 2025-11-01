from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "teambmr"
    AWS_ACCESS_KEY_ID: str = "local"
    AWS_SECRET_ACCESS_KEY: str = "local"
    AWS_REGION: str = "ap-northeast-2"
    AWS_S3_BUCKET: str = "local-bucket"
    AWS_PRESIGN_EXPIRES: int = 3600
    FRONTEND_URL: str = "http://localhost:3000"
    DEBUG: bool = True
    SECRET_KEY: str = "local-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRES: int = 3600
    UPSTAGE_API_URL: str = "https://api.upstage.ai/v1/document-digitization"
    UPSTAGE_API_KEY: str
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-mini"

settings = Settings()
