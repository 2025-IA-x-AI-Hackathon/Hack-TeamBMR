from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    MONGODB_URI: str
    MONGODB_DB_NAME: str = "teambmr"
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str = "ap-northeast-2"
    AWS_S3_BUCKET: str
    AWS_PRESIGN_EXPIRES: int = 3600
    FRONTEND_URL: str = "http://localhost:3000"
    DEBUG: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRES: int = 3600

    class Config:
        env_file = ".env"

settings = Settings()
