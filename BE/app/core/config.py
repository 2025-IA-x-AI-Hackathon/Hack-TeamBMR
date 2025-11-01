from __future__ import annotations

import os
import json
import logging
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

    # ----- Infrastructure (current 구조 유지, incoming 기본값 반영) -----
    mongodb_uri: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URI")
    mongodb_db_name: str = Field(default="teambmr", alias="MONGODB_DB_NAME")

    aws_access_key_id: str = Field(default="local", alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str = Field(default="local", alias="AWS_SECRET_ACCESS_KEY")
    aws_region: str = Field(default="ap-northeast-2", alias="AWS_REGION")
    aws_s3_bucket: str = Field(default="local-bucket", alias="AWS_S3_BUCKET")
    aws_presign_expires: int = Field(default=3600, alias="AWS_PRESIGN_EXPIRES")

    # ----- STT / RTC -----
    google_application_credentials: Optional[Path] = Field(
        default=None,
        alias="GOOGLE_APPLICATION_CREDENTIALS",
    )
    # 기본은 WebRTC 입력 48k일 수 있지만, STT는 16k가 일반적. 실제 파이프라인에 맞게 조정.
    rtc_sample_rate: int = Field(default=48000, alias="RTC_SAMPLE_RATE")
    stt_sample_rate: int = Field(default=16000, alias="STT_SAMPLE_RATE")

    rtc_language: str = Field(default="ko-KR", alias="RTC_LANGUAGE")
    stt_model: str = Field(default="default", alias="STT_MODEL")
    stt_use_enhanced: bool = Field(default=True, alias="STT_USE_ENHANCED")

    ice_servers_json: Optional[str] = Field(default=None, alias="ICE_SERVERS_JSON")
    ice_servers: list[dict[str, Any]] = Field(
        default_factory=lambda: [{"urls": ["stun:stun.l.google.com:19302"]}],
    )

    # ----- Storage / logging -----
    storage_dir: Path = Field(default=Path("./data/recordings"), alias="STORAGE_DIR")
    analysis_dir: Path = Field(default=Path("./data/analysis"), alias="ANALYSIS_DIR")
    logs_dir: Path = Field(default=Path("./data/logs"), alias="LOGS_DIR")

    # ----- Q&A parameters -----
    qa_time_window_sec: int = Field(default=15, alias="QA_TIME_WINDOW_SEC")
    qa_sentence_window: int = Field(default=3, alias="QA_SENTENCE_WINDOW")

    # ----- App / Auth (incoming에서 추가된 항목들) -----
    frontend_url: str = Field(default="http://localhost:3000", alias="FRONTEND_URL")
    debug: bool = Field(default=True, alias="DEBUG")  # incoming 기본값 True 반영

    secret_key: str = Field(default="local-secret-key", alias="SECRET_KEY")
    algorithm: str = Field(default="HS256", alias="ALGORITHM")
    access_token_expires: int = Field(default=3600, alias="ACCESS_TOKEN_EXPIRES")

    # ----- External APIs (incoming에서 추가) -----
    upstage_api_url: str = Field(
        default="https://api.upstage.ai/v1/document-digitization",
        alias="UPSTAGE_API_URL",
    )
    upstage_api_key: Optional[str] = Field(default=None, alias="UPSTAGE_API_KEY")

    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o-mini", alias="OPENAI_MODEL")

    def model_post_init(self, __context: Any) -> None:  # type: ignore[override]
        # GOOGLE_APPLICATION_CREDENTIALS 정규화 및 환경변수 설정
        if self.google_application_credentials:
            credentials_path = Path(self.google_application_credentials)
            if not credentials_path.is_absolute():
                credentials_path = Path.cwd() | credentials_path  # Python 3.12 Path union
            # 만약 3.11 이하라면: credentials_path = (Path.cwd() / credentials_path)
            if not credentials_path.is_absolute():
                credentials_path = Path.cwd() / credentials_path

            self.google_application_credentials = credentials_path
            if credentials_path.exists():
                os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", str(credentials_path))
            else:
                logging.getLogger(__name__).warning(
                    "Google credentials file not found at %s", credentials_path
                )

        # ICE 서버 JSON 파싱
        if self.ice_servers_json:
            try:
                parsed = json.loads(self.ice_servers_json)
                if isinstance(parsed, list):
                    normalized: list[dict[str, Any]] = []
                    for entry in parsed:
                        if isinstance(entry, str):
                            normalized.append({"urls": entry})
                        elif isinstance(entry, dict) and "urls" in entry:
                            normalized.append(entry)
                        else:
                            logging.getLogger(__name__).warning(
                                "Ignoring invalid ICE server entry: %s", entry
                            )
                    if normalized:
                        self.ice_servers = normalized
            except json.JSONDecodeError:
                logging.getLogger(__name__).warning(
                    "Failed to parse ICE_SERVERS_JSON. Falling back to defaults."
                )

        # 디렉토리 보장
        for directory in (self.storage_dir, self.analysis_dir, self.logs_dir):
            Path(directory).mkdir(parents=True, exist_ok=True)

        # OpenAI/Upstage 키가 없으면 경고만 (개발 편의)
        if not self.openai_api_key:
            logging.getLogger(__name__).warning("OPENAI_API_KEY is not set.")
        if not self.upstage_api_key:
            logging.getLogger(__name__).warning("UPSTAGE_API_KEY is not set.")

    # ----- Backwards compatibility (대문자 접근자 유지) -----
    @property
    def MONGODB_URI(self) -> str:  # noqa: N802
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

    @property
    def SECRET_KEY(self) -> str:  # noqa: N802
        return self.secret_key

    @property
    def ALGORITHM(self) -> str:  # noqa: N802
        return self.algorithm

    @property
    def ACCESS_TOKEN_EXPIRES(self) -> int:  # noqa: N802
        return self.access_token_expires

    @property
    def UPSTAGE_API_URL(self) -> str:  # noqa: N802
        return self.upstage_api_url

    @property
    def UPSTAGE_API_KEY(self) -> Optional[str]:  # noqa: N802
        return self.upstage_api_key

    @property
    def OPENAI_API_KEY(self) -> Optional[str]:  # noqa: N802
        return self.openai_api_key

    @property
    def OPENAI_MODEL(self) -> str:  # noqa: N802
        return self.openai_model


@lru_cache()
def get_settings() -> Settings:
    return Settings()