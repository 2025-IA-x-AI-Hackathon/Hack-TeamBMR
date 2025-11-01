from __future__ import annotations

from datetime import datetime
from hashlib import sha1
from typing import List, Optional

from pydantic import BaseModel, Field


class QAPair(BaseModel):
    q_text: str = Field(..., description="질문 문장")
    q_speaker: Optional[int] = Field(default=None, description="질문 화자 ID")
    q_time: float = Field(..., description="질문 종료 시각(초)")
    a_text: str = Field(..., description="답변 문장")
    a_speaker: Optional[int] = Field(default=None, description="답변 화자 ID")
    a_time: float = Field(..., description="답변 시작 시각(초)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="QA 매칭 신뢰도")


class TranscriptSegment(BaseModel):
    speaker: Optional[int] = Field(default=None, description="화자 ID, 미지정 시 None")
    start: float = Field(..., description="세그먼트 시작 시각(초)")
    end: float = Field(..., description="세그먼트 종료 시각(초)")
    text: str = Field(..., description="세그먼트 텍스트")
    segment_key: str = Field(..., description="세그먼트 고유 식별 해시")

    @classmethod
    def from_values(cls, speaker: Optional[int], start: float, end: float, text: str) -> "TranscriptSegment":
        key_source = f"{speaker}|{start:.3f}|{end:.3f}|{text}"
        segment_key = sha1(key_source.encode("utf-8")).hexdigest()
        return cls(
            speaker=speaker,
            start=start,
            end=end,
            text=text,
            segment_key=segment_key,
        )


class STTResult(BaseModel):
    room_id: str = Field(..., description="결과가 속한 방 ID")
    qa: List[QAPair] = Field(default_factory=list, description="질문/답변 페어 목록")
    transcript: List[TranscriptSegment] = Field(default_factory=list, description="STT 세그먼트 목록")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="생성 시각")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="마지막 갱신 시각")
