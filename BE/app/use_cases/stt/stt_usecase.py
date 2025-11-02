from __future__ import annotations

from typing import Iterable

from app.models import QAPair, TranscriptSegment
from app.services.stt_service import STTService, get_stt_service


class STTSessionResultUseCase:
    """Coordinates persistence for STT session artefacts."""

    def __init__(self, service: STTService) -> None:
        self._service = service

    async def persist_session_result(
        self,
        room_id: str,
        qa_pairs: Iterable[QAPair],
        transcript_segments: Iterable[TranscriptSegment],
    ) -> None:
        if not room_id:
            raise ValueError("room_id is required to persist STT results")

        await self._service.save_result(room_id, qa_pairs, transcript_segments)


def get_stt_use_case() -> STTSessionResultUseCase:
    return STTSessionResultUseCase(get_stt_service())
