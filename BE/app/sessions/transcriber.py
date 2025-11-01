from __future__ import annotations

import asyncio
import logging
import time
from typing import Iterable, Optional, TYPE_CHECKING

from google.api_core import exceptions as google_exceptions
from google.cloud import speech_v1 as speech
from google.cloud.speech_v1 import types as speech_types
from google.cloud.speech_v1.types import StreamingRecognizeResponse, SpeechRecognitionResult
from google.auth.exceptions import DefaultCredentialsError
from google.oauth2 import service_account

from app.core.config import Settings
from app.models import QAPair, TranscriptSegment
from app.sessions import events
from app.sessions.diarization import Segment
from app.sessions.qa_extractor import QAExtractor
from app.use_cases import get_stt_use_case

if TYPE_CHECKING:
    from app.sessions.audio_pipeline import AudioPipeline


logger = logging.getLogger(__name__)


class Transcriber:
    def __init__(
        self,
        session_id: str,
        settings: Settings,
        websocket,
        audio_queue: asyncio.Queue[Optional[bytes]],
        audio_pipeline: 'AudioPipeline' | None = None,
    ) -> None:
        self._session_id = session_id
        self._settings = settings
        self._websocket = websocket
        self._audio_queue = audio_queue
        self._audio_pipeline = audio_pipeline

        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._task: Optional[asyncio.Task[None]] = None
        self._stop_event = asyncio.Event()
        self._partial_text: str = ""
        self._final_count = 0
        self._partial_count = 0
        self._started_at: float = 0.0

        self._qa_extractor = QAExtractor(settings)
        self._qa_pairs: list[QAPair] = []
        self._qa_pair_keys: set[str] = set()
        self._transcript_segments: list[TranscriptSegment] = []
        self._segment_keys: set[str] = set()
        self._last_final_transcript: str = ""
        self._room_id: Optional[str] = None

    async def start(self) -> None:
        if self._task is not None:
            logger.debug("Transcriber already running for session %s", self._session_id)
            return
        self._loop = asyncio.get_running_loop()
        self._stop_event.clear()
        self._started_at = time.monotonic()
        self._qa_extractor = QAExtractor(self._settings)
        self._qa_pairs = []
        self._qa_pair_keys = set()
        self._transcript_segments = []
        self._segment_keys = set()
        self._last_final_transcript = ""
        self._task = asyncio.create_task(self._run())
        logger.debug("Transcriber started for session %s", self._session_id)

    async def stop(self) -> None:
        if self._task is None:
            logger.debug("Transcriber stop called but task missing for session %s", self._session_id)
            return

        self._stop_event.set()
        try:
            self._audio_queue.put_nowait(None)
        except asyncio.QueueFull:
            pass

        logger.debug("Awaiting transcriber task shutdown for session %s", self._session_id)
        try:
            await self._task
        except Exception as exc:  # pragma: no cover - diagnostics
            logger.exception("Transcriber task raised during stop for session %s: %s", self._session_id, exc)
        finally:
            if self._loop:
                await events.emit_qa_pairs(
                    self._websocket,
                    [pair.model_dump() for pair in self._qa_pairs],
                    final=True,
                )
            await self._persist_results()
            logger.debug("Transcriber task finished for session %s", self._session_id)
            self._task = None

    def set_room_id(self, room_id: Optional[str]) -> None:
        if room_id:
            self._room_id = room_id

    async def _run(self) -> None:
        try:
            logger.debug("Transcriber run loop starting for session %s", self._session_id)
            await asyncio.to_thread(self._streaming_recognize)
        except DefaultCredentialsError as exc:
            logger.error("Google credentials not configured for session %s: %s", self._session_id, exc)
            if self._loop:
                await events.emit_error(self._websocket, "GOOGLE_AUTH_MISSING", str(exc))
        except Exception as exc:  # pragma: no cover - fallback reporting
            logger.exception("Transcriber run failed for session %s: %s", self._session_id, exc)
            if self._loop:
                await events.emit_error(self._websocket, "UPSTREAM_FAIL", str(exc))
        finally:
            logger.debug("Transcriber run loop finished for session %s", self._session_id)

    def _streaming_recognize(self) -> None:
        logger.debug("Session %s streaming_recognize begin", self._session_id)
        if self._settings.google_application_credentials:
            try:
                credentials = service_account.Credentials.from_service_account_file(
                    str(self._settings.google_application_credentials),
                )
                client = speech.SpeechClient(credentials=credentials)
            except FileNotFoundError as exc:
                raise DefaultCredentialsError(str(exc)) from exc
        else:
            client = speech.SpeechClient()
        config = speech_types.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=self._settings.stt_sample_rate,
            audio_channel_count=1,
            language_code=self._settings.rtc_language,
            enable_automatic_punctuation=True,
            enable_word_time_offsets=True,
            use_enhanced=self._settings.stt_use_enhanced,
            model=self._settings.stt_model,
        )

        streaming_config = speech_types.StreamingRecognitionConfig(
            config=config,
            interim_results=True,
            single_utterance=False,
        )

        logger.debug("Session %s streaming_recognize start", self._session_id)

        request_iterator = self._request_generator(streaming_config)
        try:
            responses = client.streaming_recognize(requests=request_iterator, config=streaming_config)
            for response in responses:
                self._handle_response(response)
        except google_exceptions.GoogleAPICallError as exc:
            logger.warning("Session %s Google STT error: %s", self._session_id, exc)
            if self._loop:
                asyncio.run_coroutine_threadsafe(
                    events.emit_error(self._websocket, "UPSTREAM_FAIL", str(exc)),
                    self._loop,
                )
        finally:
            duration = max(time.monotonic() - self._started_at, 0.0)
            logger.debug(
                "Transcriber streaming finished for session %s after %.2fs (finals=%d)",
                self._session_id,
                duration,
                self._final_count,
            )

    def _request_generator(self, streaming_config: speech_types.StreamingRecognitionConfig):
        while not self._stop_event.is_set():
            if self._loop is None:
                break
            future = asyncio.run_coroutine_threadsafe(self._audio_queue.get(), self._loop)
            try:
                chunk = future.result()
            except Exception as exc:
                logger.warning("request_generator future exception for session %s: %s", self._session_id, exc)
                break
            if chunk is None:
                logger.debug("Session %s request_generator received sentinel", self._session_id)
                break
            if not chunk:
                continue
            logger.debug(
                "Session %s request_generator sending chunk size=%d",
                self._session_id,
                len(chunk),
            )
            yield speech_types.StreamingRecognizeRequest(audio_content=chunk)

    def _handle_response(self, response: StreamingRecognizeResponse) -> None:
        if not self._loop:
            return

        for result in response.results:
            if not result.alternatives:
                continue

            transcript = result.alternatives[0].transcript.strip()
            if not transcript:
                continue

            if not result.is_final:
                if transcript != self._partial_text:
                    self._partial_text = transcript
                    self._partial_count += 1
                    asyncio.run_coroutine_threadsafe(
                        events.emit_partial(self._websocket, transcript),
                        self._loop,
                    )
                continue

            self._partial_text = ""
            new_text = self._extract_new_text(transcript)
            if not new_text:
                continue

            segment = self._build_segment(result, new_text)
            if segment is None:
                continue

            asyncio.run_coroutine_threadsafe(
                events.emit_final_segments(
                    self._websocket,
                    [segment.to_dict()],
                ),
                self._loop,
            )
            self._append_transcript_segment(segment)

            qa_payloads = self._qa_extractor.append_segments([segment])
            new_pairs = self._register_qa_pairs(qa_payloads)
            if new_pairs:
                asyncio.run_coroutine_threadsafe(
                    events.emit_qa_pairs(
                        self._websocket,
                        [pair.model_dump() for pair in new_pairs],
                        final=False,
                    ),
                    self._loop,
                )

            self._final_count += 1
            self._last_final_transcript = transcript

            if self._loop:
                stats = {
                    "partials": self._partial_count,
                    "finals": self._final_count,
                    "bytes": 0,
                    "chunks": 0,
                }
                if self._audio_pipeline:
                    pipeline_stats = self._audio_pipeline.get_stats()
                    stats["bytes"] = pipeline_stats.get("bytes", 0)
                    stats["chunks"] = pipeline_stats.get("chunks", 0)

                asyncio.run_coroutine_threadsafe(
                    events.emit_stats(self._websocket, stats),
                    self._loop,
                )

    def _extract_new_text(self, transcript: str) -> str:
        if not transcript:
            return ""
        if self._last_final_transcript and transcript.startswith(self._last_final_transcript):
            diff = transcript[len(self._last_final_transcript):]
            return diff.strip()
        return transcript

    def _build_segment(self, result: SpeechRecognitionResult, text: str) -> Optional[Segment]:
        if not result.alternatives:
            return None

        alternative = result.alternatives[0]
        words = list(getattr(alternative, "words", []))
        if words:
            start = self._duration_to_seconds(getattr(words[0], "start_time", None))
            end = self._duration_to_seconds(getattr(words[-1], "end_time", None))
        else:
            start = self._transcript_segments[-1].end if self._transcript_segments else 0.0
            end = self._duration_to_seconds(getattr(result, "result_end_time", None))
            if end < start:
                end = start

        return Segment(speaker=None, text=text, start=start, end=end)

    def _append_transcript_segment(self, segment: Segment) -> None:
        transcript_segment = TranscriptSegment.from_values(
            segment.speaker,
            segment.start,
            segment.end,
            segment.text,
        )
        if transcript_segment.segment_key in self._segment_keys:
            return
        self._segment_keys.add(transcript_segment.segment_key)
        self._transcript_segments.append(transcript_segment)

    def _register_qa_pairs(self, pairs: Iterable[dict]) -> list[QAPair]:
        new_pairs: list[QAPair] = []
        for payload in pairs or []:
            key = f"{payload.get('q_text')}|{payload.get('a_text')}|{payload.get('a_time')}"
            if key in self._qa_pair_keys:
                continue
            self._qa_pair_keys.add(key)
            pair = QAPair.model_validate(payload)
            self._qa_pairs.append(pair)
            new_pairs.append(pair)
        return new_pairs

    async def _persist_results(self) -> None:
        if not self._room_id:
            return
        if not self._qa_pairs and not self._transcript_segments:
            return

        try:
            use_case = get_stt_use_case()
            await use_case.persist_session_result(self._room_id, self._qa_pairs, self._transcript_segments)
        except Exception as exc:  # pragma: no cover - diagnostics
            logger.exception(
                "Failed to persist STT results for session %s (room=%s): %s",
                self._session_id,
                self._room_id,
                exc,
            )

    @staticmethod
    def _duration_to_seconds(duration) -> float:
        if duration is None:
            return 0.0
        if hasattr(duration, "total_seconds"):
            return float(duration.total_seconds())
        seconds = getattr(duration, "seconds", 0.0)
        nanos = getattr(duration, "nanos", 0)
        return float(seconds) + float(nanos) / 1_000_000_000
