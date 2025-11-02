from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Optional

import av
from av.audio.resampler import AudioResampler

from app.core.config import Settings
from app.noise.ffmpeg_reducer import FFmpegNoiseReducer
from app.util.analysis_writer import AnalysisWriter
logger = logging.getLogger(__name__)


class AudioPipeline:
    def __init__(
        self,
        session_id: str,
        settings: Settings,
        output_queue: asyncio.Queue[Optional[bytes]],
    ) -> None:
        self._session_id = session_id
        self._settings = settings
        self._output_queue = output_queue
        self._bytes_sent = 0
        self._chunks_sent = 0

        self._resampler = AudioResampler(
            format="s16",
            layout="mono",
            rate=settings.stt_sample_rate,
        )

        self._noise_reducer = None
        # try:
        #     self._noise_reducer = FFmpegNoiseReducer(sample_rate=settings.stt_sample_rate)
        # except Exception as exc:  # pragma: no cover - defensive
        #     logger.warning("Noise reducer initialization failed: %s", exc)
        #     self._noise_reducer = None

        self._logs_dir = settings.logs_dir
        self._recording_path = Path(settings.storage_dir) / f"{session_id}.wav"
        self._recording_writer = AnalysisWriter(self._recording_path, sample_rate=settings.stt_sample_rate)
        try:
            self._recording_writer.open()
        except Exception as exc:  # pragma: no cover - best-effort
            logger.warning("Failed to open recording writer: %s", exc)
            self._recording_writer = None

        analysis_path = Path(settings.analysis_dir) / f"{session_id}.wav"
        if analysis_path != self._recording_path:
            analysis_writer = AnalysisWriter(analysis_path, sample_rate=settings.stt_sample_rate)
            try:
                analysis_writer.open()
            except Exception as exc:  # pragma: no cover - best-effort
                logger.warning("Failed to open analysis writer: %s", exc)
                analysis_writer = None
            self._analysis_writer = analysis_writer
        else:
            self._analysis_writer = self._recording_writer

    async def handle_frame(self, frame: av.AudioFrame) -> None:
        pcm_chunks = self._to_pcm_bytes(frame)
        for chunk in pcm_chunks:
            reduced = self._apply_noise_reduction(chunk)
            await self._push_chunk(reduced)
            if self._recording_writer:
                self._recording_writer.append(reduced)
            if self._analysis_writer and self._analysis_writer is not self._recording_writer:
                self._analysis_writer.append(reduced)

    def _to_pcm_bytes(self, frame: av.AudioFrame) -> list[bytes]:
        frames = self._resampler.resample(frame)
        result: list[bytes] = []
        for resampled in frames:
            ndarray = resampled.to_ndarray()
            if ndarray is None:
                continue
            if ndarray.ndim == 1:
                result.append(ndarray.tobytes())
            else:
                for channel_data in ndarray:
                    result.append(channel_data.tobytes())
        return result

    def _apply_noise_reduction(self, chunk: bytes) -> bytes:
        if not self._noise_reducer:
            return chunk
        return self._noise_reducer.process(chunk)

    async def _push_chunk(self, chunk: bytes) -> None:
        try:
            self._output_queue.put_nowait(chunk)
            self._bytes_sent += len(chunk)
            self._chunks_sent += 1
            if self._chunks_sent <= 5 or self._chunks_sent % 20 == 0:
                logger.debug(
                    "Session %s queued audio chunk size=%d total_bytes=%d chunks=%d",
                    self._session_id,
                    len(chunk),
                    self._bytes_sent,
                    self._chunks_sent,
                )
        except asyncio.QueueFull:
            logger.debug("Audio queue full. Dropping chunk.")

    def close(self) -> None:
        if self._noise_reducer:
            self._noise_reducer.close()
        if self._recording_writer:
            self._recording_writer.close()
        if self._analysis_writer and self._analysis_writer is not self._recording_writer:
            self._analysis_writer.close()

    @property
    def recording_path(self) -> Path:
        return self._recording_path

    def get_stats(self) -> dict[str, int]:
        return {
            "bytes": self._bytes_sent,
            "chunks": self._chunks_sent,
        }
