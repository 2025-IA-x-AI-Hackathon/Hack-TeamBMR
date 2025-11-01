from __future__ import annotations

import logging
import subprocess
import threading
import time
from typing import Optional

import ffmpeg


logger = logging.getLogger(__name__)


class FFmpegNoiseReducer:
    """Streaming FFmpeg noise reducer using python-ffmpeg."""

    def __init__(self, sample_rate: int, timeout: float = 0.02) -> None:
        self.sample_rate = sample_rate
        self._timeout = timeout
        self._process: Optional[subprocess.Popen[bytes]] = None
        self._stdout_thread: Optional[threading.Thread] = None
        self._stderr_thread: Optional[threading.Thread] = None
        self._buffer = bytearray()
        self._lock = threading.Lock()
        self._closed = False
        self._available = True

    def _spawn(self) -> None:
        if not self._available or self._process is not None:
            return

        try:
            self._process = (
                ffmpeg
                .input("pipe:0", format="s16le", ac=1, ar=self.sample_rate)
                .filter("afftdn", nf="-25")
                .filter("highpass", f=100)
                .filter("speechnorm", e=6, l=1)
                .output("pipe:1", format="s16le", ac=1, ar=self.sample_rate)
                .global_args("-hide_banner", "-loglevel", "error")
                .run_async(
                    pipe_stdin=True,
                    pipe_stdout=True,
                    pipe_stderr=True,
                )
            )

        except ffmpeg.Error as exc:
            self._available = False
            message = exc.stderr.decode("utf-8", errors="ignore") if exc.stderr else str(exc)
            logger.warning("Failed to launch ffmpeg noise reducer: %s", message)
            return
        except FileNotFoundError:
            self._available = False
            logger.warning("ffmpeg binary not found on PATH. Noise reduction disabled.")
            return

        self._closed = False
        self._stdout_thread = threading.Thread(target=self._stdout_loop, name="ffmpeg-nr-stdout", daemon=True)
        self._stdout_thread.start()
        self._stderr_thread = threading.Thread(target=self._stderr_loop, name="ffmpeg-nr-stderr", daemon=True)
        self._stderr_thread.start()

    def process(self, chunk: bytes) -> bytes:
        if not self._available or not chunk:
            return chunk

        self._spawn()
        if self._process is None or self._process.stdin is None:
            return chunk

        ready = self._pop_buffer(len(chunk), timeout=0.0)
        output: Optional[bytes] = None
        if len(ready) >= len(chunk):
            output = ready[: len(chunk)]
            remainder = ready[len(chunk):]
            if remainder:
                self._prepend_buffer(remainder)
        elif ready:
            self._prepend_buffer(ready)

        if not self._feed(chunk):
            return chunk

        if output is not None:
            return output

        processed = self._pop_buffer(len(chunk), timeout=self._timeout)
        if len(processed) >= len(chunk):
            result = processed[: len(chunk)]
            remainder = processed[len(chunk):]
            if remainder:
                self._prepend_buffer(remainder)
            return result

        if processed:
            self._prepend_buffer(processed)

        return chunk

    def close(self) -> None:
        self._closed = True
        with self._lock:
            if self._process:
                try:
                    if self._process.stdin:
                        self._process.stdin.close()
                except Exception:
                    pass
            process = self._process
            self._process = None

        if process:
            try:
                if process.stdout:
                    process.stdout.close()
                if process.stderr:
                    process.stderr.close()
                process.terminate()
                process.wait(timeout=0.2)
            except Exception:
                try:
                    process.kill()
                    process.wait(timeout=0.2)
                except Exception as exc:
                    logger.warning("Failed to kill ffmpeg process during cleanup: %s", exc)

        if self._stdout_thread and self._stdout_thread.is_alive():
            self._stdout_thread.join(timeout=0.2)
        if self._stderr_thread and self._stderr_thread.is_alive():
            self._stderr_thread.join(timeout=0.2)
        self._stdout_thread = None
        self._stderr_thread = None

        with self._lock:
            self._buffer.clear()

    def _stdout_loop(self) -> None:
        assert self._process is not None
        stdout = self._process.stdout
        if stdout is None:
            return
        while not self._closed:
            try:
                data = stdout.read1(4096)  # type: ignore[attr-defined]
            except AttributeError:
                data = stdout.read(4096)
            except Exception:
                break
            if not data:
                break
            with self._lock:
                self._buffer.extend(data)

    def _stderr_loop(self) -> None:
        assert self._process is not None
        stderr = self._process.stderr
        if stderr is None:
            return
        try:
            for line in iter(stderr.readline, b""):
                if not line:
                    break
                logger.debug("ffmpeg noise reducer: %s", line.decode("utf-8", errors="ignore").strip())
        except Exception as exc:
            logger.warning("Exception in ffmpeg noise reducer stderr thread: %s", exc)

    def _feed(self, chunk: bytes) -> bool:
        if self._process is None or self._process.stdin is None:
            return False
        try:
            self._process.stdin.write(chunk)
            self._process.stdin.flush()
            return True
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Failed to feed ffmpeg noise reducer: %s", exc)
            self.close()
            self._available = False
            return False

    def _pop_buffer(self, expected: int, timeout: float) -> bytes:
        if expected <= 0:
            return b""
        deadline = time.monotonic() + max(timeout, 0.0)
        collected = bytearray()
        while len(collected) < expected and not self._closed:
            with self._lock:
                if self._buffer:
                    take = min(expected - len(collected), len(self._buffer))
                    collected.extend(self._buffer[:take])
                    del self._buffer[:take]
            if len(collected) >= expected or timeout == 0:
                break
            if time.monotonic() >= deadline:
                break
            time.sleep(0.001)
        return bytes(collected)

    def _prepend_buffer(self, data: bytes) -> None:
        if not data:
            return
        with self._lock:
            self._buffer = bytearray(data) + self._buffer
