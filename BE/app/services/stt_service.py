from __future__ import annotations

from typing import Iterable

from app.database.mongodb import get_stt_collection
from app.models import QAPair, STTResult, TranscriptSegment
from app.repositories import STTRepository
from typing import Any, Dict, Iterable, List


class STTService:
    """Business logic for storing STT session artefacts."""

    def __init__(self, repository: STTRepository) -> None:
        self._repository = repository

    async def save_result(
        self,
        room_id: str,
        qa_pairs: Iterable[QAPair],
        transcript_segments: Iterable[TranscriptSegment],
    ) -> None:
        result = STTResult(
            room_id=room_id,
            qa=list(qa_pairs),
            transcript=list(transcript_segments),
        )
        await self._repository.upsert_result(result)

    async def get_transcript_triplets(self, room_id: str) -> List[Dict[str, Any]]:
        segments = await self._repository.get_transcript_segments(room_id)
        return [{"sid": idx,"t0": s.start, "t1": s.end, "text": s.text} for idx, s in enumerate(segments)]


def get_stt_service() -> STTService:
    repository = STTRepository(get_stt_collection())
    return STTService(repository)
