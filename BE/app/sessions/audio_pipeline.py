from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Optional

import av
from av.audio.resampler import AudioResampler

from app.config import Settings
from app.noise.ffmpeg_reducer import FFmpegNoiseReducer
from app.util.analysis_writer import AnalysisWriter


logger = logging.getLogger(__name__)


class AudioPipeline:
    def __init__(
        self,
        session_id: str,
        settings: Settings,
        output_queue: asyncio.Queue[bytes],
    ) -> None:
        self._session_id = session_id
        self._settings = settings
        self._output_queue = output_queue

        self._resampler = AudioResampler(
            format="s16",
            layout="mono",
            rate=settings.stt_sample_rate,
        )
        self._noise_reducer = FFmpegNoiseReducer(sample_rate=settings.stt_sample_rate)

        analysis_path = Path(settings.analysis_dir) / f"{session_id}.wav"
        self._analysis_writer = AnalysisWriter(analysis_path, sample_rate=settings.stt_sample_rate)
        try:
            self._analysis_writer.open()
        except Exception as exc:  # pragma: no cover - best-effort
            logger.warning("Failed to open analysis writer: %s", exc)
            self._analysis_writer = None

    async def handle_frame(self, frame: av.AudioFrame) -> None:
        pcm_chunks = self._to_pcm_bytes(frame)
        for chunk in pcm_chunks:
            reduced = self._noise_reducer.process(chunk)
            await self._push_chunk(reduced)
            if self._analysis_writer:
                self._analysis_writer.append(reduced)

    def _to_pcm_bytes(self, frame: av.AudioFrame) -> list[bytes]:
        frames = self._resampler.resample(frame)
        result: list[bytes] = []
        for resampled in frames:
            buffer = resampled.planes[0].to_bytes()
            if buffer:
                result.append(bytes(buffer))
        return result

    async def _push_chunk(self, chunk: bytes) -> None:
        try:
            self._output_queue.put_nowait(chunk)
        except asyncio.QueueFull:
            logger.debug("Audio queue full. Dropping chunk.")

    def close(self) -> None:
        self._noise_reducer.close()
        if self._analysis_writer:
            self._analysis_writer.close()
