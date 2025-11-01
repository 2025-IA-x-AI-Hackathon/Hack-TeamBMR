from __future__ import annotations
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="allow",
    )

    # Infrastructure
    mongodb_uri: str = Field(alias="MONGODB_URI")
    mongodb_db_name: str = Field(default="teambmr", alias="MONGODB_DB_NAME")

    aws_access_key_id: str = Field(alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str = Field(alias="AWS_SECRET_ACCESS_KEY")
    aws_region: str = Field(default="ap-northeast-2", alias="AWS_REGION")
    aws_s3_bucket: str = Field(alias="AWS_S3_BUCKET")
    aws_presign_expires: int = Field(default=3600, alias="AWS_PRESIGN_EXPIRES")

    # STT / RTC
    google_application_credentials: Optional[Path] = Field(
        default=None,
        alias="GOOGLE_APPLICATION_CREDENTIALS",
    )
    rtc_sample_rate: int = Field(default=48_000, alias="RTC_SAMPLE_RATE")
    stt_sample_rate: int = Field(default=48_000, alias="STT_SAMPLE_RATE")
    rtc_language: str = Field(default="ko-KR", alias="RTC_LANGUAGE")
    stt_model: str = Field(default="default", alias="STT_MODEL")
    stt_use_enhanced: bool = Field(default=True, alias="STT_USE_ENHANCED")

    # Storage / logging
    storage_dir: Path = Field(default=Path("./data/recordings"), alias="STORAGE_DIR")
    analysis_dir: Path = Field(default=Path("./data/analysis"), alias="ANALYSIS_DIR")
    logs_dir: Path = Field(default=Path("./data/logs"), alias="LOGS_DIR")

    # Q&A parameters
    qa_time_window_sec: int = Field(default=15, alias="QA_TIME_WINDOW_SEC")
    qa_sentence_window: int = Field(default=3, alias="QA_SENTENCE_WINDOW")

    # Misc
    frontend_url: str = Field(default="http://localhost:3000", alias="FRONTEND_URL")
    debug: bool = Field(default=False, alias="DEBUG")

    def model_post_init(self, __context: Any) -> None:  # type: ignore[override]
        if self.google_application_credentials:
            os.environ.setdefault(
                "GOOGLE_APPLICATION_CREDENTIALS",
                str(self.google_application_credentials),
            )

        for directory in (self.storage_dir, self.analysis_dir, self.logs_dir):
            Path(directory).mkdir(parents=True, exist_ok=True)

    # Backwards compatibility for legacy settings access
    @property
    def MONGODB_URI(self) -> str:  # noqa: N802 - keep legacy attribute name
        return self.mongodb_uri

    @property
    def MONGODB_DB_NAME(self) -> str:  # noqa: N802
        return self.mongodb_db_name

    @property
    def AWS_ACCESS_KEY_ID(self) -> str:  # noqa: N802
        return self.aws_access_key_id

    @property
    def AWS_SECRET_ACCESS_KEY(self) -> str:  # noqa: N802
        return self.aws_secret_access_key

    @property
    def AWS_REGION(self) -> str:  # noqa: N802
        return self.aws_region

    @property
    def AWS_S3_BUCKET(self) -> str:  # noqa: N802
        return self.aws_s3_bucket

    @property
    def AWS_PRESIGN_EXPIRES(self) -> int:  # noqa: N802
        return self.aws_presign_expires

    @property
    def FRONTEND_URL(self) -> str:  # noqa: N802
        return self.frontend_url

    @property
    def DEBUG(self) -> bool:  # noqa: N802
        return self.debug


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    return settings
