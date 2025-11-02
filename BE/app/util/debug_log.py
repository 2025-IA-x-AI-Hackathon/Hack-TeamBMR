from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional


def append_debug_log(base_dir: Path, message: str, filename: str = "stt_debug.log") -> None:
    try:
        base_dir.mkdir(parents=True, exist_ok=True)
        log_path = base_dir / filename
        timestamp = datetime.utcnow().isoformat()
        with log_path.open("a", encoding="utf-8") as fp:
            fp.write(f"[{timestamp}] {message}\n")
    except Exception:
        # 파일 로그에서의 예외는 애플리케이션 플로우에 영향 주지 않도록 무시
        pass
