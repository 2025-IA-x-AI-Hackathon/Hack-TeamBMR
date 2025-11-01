from __future__ import annotations

import asyncio
import logging
import time
from typing import Iterable, Optional

from google.api_core import exceptions as google_exceptions
from google.cloud import speech_v1 as speech
from google.cloud.speech_v1 import types as speech_types
from google.cloud.speech_v1.types import StreamingRecognizeResponse
from google.auth.exceptions import DefaultCredentialsError
from google.oauth2 import service_account

from app.core.config import Settings
from app.sessions import events
from app.sessions.diarization import DiarizationProcessor, Segment
from app.sessions.qa_extractor import QAExtractor


logger = logging.getLogger(__name__)


class Transcriber:
    def __init__(
        self,
        session_id: str,
        settings: Settings,
        websocket,
        audio_queue: asyncio.Queue[Optional[bytes]],
    ) -> None:
        self._session_id = session_id
        self._settings = settings
        self._websocket = websocket
        self._audio_queue = audio_queue

        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._task: Optional[asyncio.Task[None]] = None
        self._stop_event = asyncio.Event()
        self._partial_text: str = ""
        self._final_count = 0
        self._partial_count = 0
        self._started_at: float = 0.0

        self._diarizer = DiarizationProcessor(settings.logs_dir)
        self._qa_extractor = QAExtractor(settings)

    async def start(self) -> None:
        if self._task is not None:
            logger.debug("Transcriber already running for session %s", self._session_id)
            return
        self._loop = asyncio.get_running_loop()
        self._stop_event.clear()
        self._started_at = time.monotonic()
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
        await self._task
        logger.debug("Transcriber task finished for session %s", self._session_id)
        self._task = None

    async def _run(self) -> None:
        try:
            await asyncio.to_thread(self._streaming_recognize)
        except DefaultCredentialsError as exc:
            logger.error("Google credentials not configured for session %s: %s", self._session_id, exc)
            if self._loop:
                await events.emit_error(self._websocket, "GOOGLE_AUTH_MISSING", str(exc))
        except Exception as exc:  # pragma: no cover - fallback reporting
            logger.exception("Transcriber run failed for session %s: %s", self._session_id, exc)
            if self._loop:
                await events.emit_error(self._websocket, "UPSTREAM_FAIL", str(exc))

    def _streaming_recognize(self) -> None:
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
            use_enhanced=self._settings.stt_use_enhanced,
            model=self._settings.stt_model,
            enable_speaker_diarization=True,
            diarization_speaker_count=4,
        )

        streaming_config = speech_types.StreamingRecognitionConfig(
            config=config,
            interim_results=True,
            single_utterance=False,
        )

        try:
            responses = client.streaming_recognize(self._request_generator(streaming_config))
            for response in responses:
                self._handle_response(response)
        except google_exceptions.GoogleAPICallError as exc:
            logger.warning("Google STT error: %s", exc)
            if self._loop:
                asyncio.run_coroutine_threadsafe(
                    events.emit_error(self._websocket, "UPSTREAM_FAIL", str(exc)),
                    self._loop,
                )
        finally:
            duration = max(time.monotonic() - self._started_at, 0.0)
            if self._loop:
                asyncio.run_coroutine_threadsafe(
                    events.emit_done(self._websocket, self._final_count, duration),
                    self._loop,
                )

    def _request_generator(self, streaming_config: speech_types.StreamingRecognitionConfig):
        yield speech_types.StreamingRecognizeRequest(streaming_config=streaming_config)
        while not self._stop_event.is_set():
            if self._loop is None:
                break
            future = asyncio.run_coroutine_threadsafe(self._audio_queue.get(), self._loop)
            chunk = future.result()
            if chunk is None:
                break
            if not chunk:
                continue
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
            diarized = self._diarizer.build_segments(result)
            if diarized:
                asyncio.run_coroutine_threadsafe(
                    events.emit_final_segments(
                        self._websocket,
                        [segment.to_dict() for segment in diarized],
                    ),
                    self._loop,
                )
                qa_pairs = self._qa_extractor.append_segments(diarized)
                if qa_pairs:
                    asyncio.run_coroutine_threadsafe(
                        events.emit_qa(self._websocket, qa_pairs),
                        self._loop,
                    )
            else:
                asyncio.run_coroutine_threadsafe(
                    events.emit_final_segments(
                        self._websocket,
                        [
                            {
                                "speaker": None,
                                "text": transcript,
                                "start": 0.0,
                                "end": 0.0,
                            }
                        ],
                    ),
                    self._loop,
                )

            self._final_count += 1

            if self._loop:
                asyncio.run_coroutine_threadsafe(
                    events.emit_stats(
                        self._websocket,
                        {
                            "partials": self._partial_count,
                            "finals": self._final_count,
                        },
                    ),
                    self._loop,
                )
