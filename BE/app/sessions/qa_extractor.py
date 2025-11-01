from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple

from app.core.config import Settings
from app.sessions.diarization import Segment


QUESTION_PATTERN = re.compile(
    r"(?:\?|요\??|까\??|나요\??|니|냐|나\??|죠\??|지요\??|습니까\??|습니까요\??|아니야)\s*$",
    re.IGNORECASE,
)


@dataclass
class Sentence:
    text: str
    speaker: Optional[int]
    start: float
    end: float


class QAExtractor:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._segments: List[Segment] = []
        self._emitted: set[Tuple[str, str, float]] = set()

    def append_segments(self, segments: List[Segment]) -> List[dict]:
        self._segments.extend(segments)
        sentences = self._segments_to_sentences(self._segments)
        return self._extract(sentences)

    def _segments_to_sentences(self, segments: List[Segment]) -> List[Sentence]:
        sentences: List[Sentence] = []
        for segment in segments:
            parts = re.split(r"(?<=[\.\?\!])\s+", segment.text.strip())
            cursor = segment.start
            duration = max(segment.end - segment.start, 0.001)
            per_sentence = duration / max(len(parts), 1)
            for part in parts:
                cleaned = part.strip()
                if not cleaned:
                    continue
                sentence = Sentence(
                    text=cleaned,
                    speaker=segment.speaker,
                    start=cursor,
                    end=cursor + per_sentence,
                )
                sentences.append(sentence)
                cursor += per_sentence
        return sentences

    def _extract(self, sentences: List[Sentence]) -> List[dict]:
        pairs: List[dict] = []
        for idx, question in enumerate(sentences):
            if not QUESTION_PATTERN.search(question.text):
                continue

            answer = self._find_answer(idx, question, sentences)
            if not answer:
                continue

            key = (question.text, answer.text, answer.start)
            if key in self._emitted:
                continue

            self._emitted.add(key)
            confidence = self._calculate_confidence(question, answer)
            pairs.append(
                {
                    "q_text": question.text,
                    "q_speaker": question.speaker,
                    "q_time": question.end,
                    "a_text": answer.text,
                    "a_speaker": answer.speaker,
                    "a_time": answer.start,
                    "confidence": confidence,
                },
            )
        return pairs

    def _find_answer(self, idx: int, question: Sentence, sentences: List[Sentence]) -> Optional[Sentence]:
        max_time = question.end + self._settings.qa_time_window_sec
        limit = idx + self._settings.qa_sentence_window

        candidate: Optional[Sentence] = None
        for j in range(idx + 1, min(len(sentences), limit + 1)):
            sentence = sentences[j]
            if sentence.start > max_time:
                break
            if sentence.text.strip() == "":
                continue
            if candidate is None:
                candidate = sentence
                if sentence.speaker != question.speaker:
                    break
            elif candidate.speaker == question.speaker and sentence.speaker != question.speaker:
                candidate = sentence
                break
        return candidate

    def _calculate_confidence(self, question: Sentence, answer: Sentence) -> float:
        score = 0.5
        if answer.speaker is not None and answer.speaker != question.speaker:
            score += 0.25

        time_delta = max(0.0, answer.start - question.end)
        if time_delta < self._settings.qa_time_window_sec:
            score += 0.2 * (1 - time_delta / max(self._settings.qa_time_window_sec, 1))

        if answer.text.endswith('.'):
            score += 0.05

        return min(round(score, 2), 0.99)
