from __future__ import annotations

from pathlib import Path
from typing import BinaryIO, Optional

import wave


class AnalysisWriter:
    def __init__(self, path: Path, sample_rate: int) -> None:
        self._path = path
        self._sample_rate = sample_rate
        self._wave_file: Optional[BinaryIO] = None

    def open(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        wave_file = wave.open(str(self._path), "wb")
        wave_file.setnchannels(1)
        wave_file.setsampwidth(2)
        wave_file.setframerate(self._sample_rate)
        self._wave_file = wave_file

    def append(self, chunk: bytes) -> None:
        if self._wave_file is None:
            return
        self._wave_file.writeframes(chunk)

    def close(self) -> None:
        if self._wave_file:
            self._wave_file.close()
            self._wave_file = None
