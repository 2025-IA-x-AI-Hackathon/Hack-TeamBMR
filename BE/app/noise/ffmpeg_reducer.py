from __future__ import annotations

import logging
import shutil
import subprocess
from threading import Lock
from typing import Optional


logger = logging.getLogger(__name__)


class FFmpegNoiseReducer:
    def __init__(self, sample_rate: int) -> None:
        self.sample_rate = sample_rate
        self._available = shutil.which("ffmpeg") is not None
        self._process: Optional[subprocess.Popen[bytes]] = None
        self._lock = Lock()

        if not self._available:
            logger.warning("FFmpeg not found on PATH. Noise reduction will be bypassed.")

    def _spawn(self) -> None:
        if not self._available or self._process is not None:
            return

        command = [
            "ffmpeg",
            "-loglevel",
            "error",
            "-f",
            "s16le",
            "-ac",
            "1",
            "-ar",
            str(self.sample_rate),
            "-i",
            "pipe:0",
            "-af",
            "afftdn=nr=12:nt=w:om=o,highpass=f=200,speechnorm",
            "-f",
            "s16le",
            "-ac",
            "1",
            "-ar",
            str(self.sample_rate),
            "pipe:1",
        ]

        try:
            self._process = subprocess.Popen(
                command,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
        except FileNotFoundError:
            self._available = False
            logger.warning("FFmpeg execution failed. Noise reduction will be bypassed.")

    def process(self, chunk: bytes) -> bytes:
        if not self._available or not chunk:
            return chunk

        with self._lock:
            self._spawn()
            if self._process is None or self._process.stdin is None or self._process.stdout is None:
                return chunk

            try:
                self._process.stdin.write(chunk)
                self._process.stdin.flush()
                processed = self._process.stdout.read(len(chunk))
                return processed if processed else chunk
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("FFmpeg noise reduction failed: %s", exc)
                self.close()
                self._available = False
                return chunk

    def close(self) -> None:
        with self._lock:
            if self._process:
                try:
                    if self._process.stdin:
                        self._process.stdin.close()
                    if self._process.stdout:
                        self._process.stdout.close()
                    if self._process.stderr:
                        self._process.stderr.close()
                    self._process.terminate()
                finally:
                    self._process = None
