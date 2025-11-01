from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    google_application_credentials: Optional[str] = None

    rtc_sample_rate: int = 48_000
    stt_sample_rate: int = 48_000
    rtc_language: str = "ko-KR"
    stt_model: str = "default"
    stt_use_enhanced: bool = True

    storage_dir: Path = Path("./data/recordings")
    analysis_dir: Path = Path("./data/analysis")
    logs_dir: Path = Path("./data/logs")

    qa_time_window_sec: int = 15
    qa_sentence_window: int = 3

    frontend_url: str = "http://localhost:3000"
    debug: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = False

    def ensure_directories(self) -> None:
        for directory in (self.storage_dir, self.analysis_dir, self.logs_dir):
            Path(directory).mkdir(parents=True, exist_ok=True)


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_directories()
    return settings
