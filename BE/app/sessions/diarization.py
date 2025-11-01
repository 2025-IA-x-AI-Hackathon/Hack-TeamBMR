from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, List, Optional, Set, Tuple

from google.cloud.speech_v1.types import SpeechRecognitionAlternative, SpeechRecognitionResult, WordInfo


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Segment:
    speaker: Optional[int]
    text: str
    start: float
    end: float

    def to_dict(self) -> dict:
        return {
            "speaker": self.speaker,
            "text": self.text,
            "start": self.start,
            "end": self.end,
        }


def _time_to_seconds(time_info: WordInfo) -> Tuple[float, float]:
    def _convert(maybe) -> float:
        if maybe is None:
            return 0.0
        if hasattr(maybe, "total_seconds"):  # datetime.timedelta
            return maybe.total_seconds()
        seconds = getattr(maybe, "seconds", 0.0)
        nanos = getattr(maybe, "nanos", 0)
        return float(seconds) + float(nanos) / 1_000_000_000

    return _convert(time_info.start_time), _convert(time_info.end_time)


class DiarizationProcessor:
    def __init__(self, logs_dir: Path) -> None:
        self._log_path = Path(logs_dir) / "diarization_latest.json"
        self.reset()

    def reset(self) -> None:
        self._seen_keys: Set[Tuple[Optional[int], float, float, str]] = set()
        self._last_word_end: float = 0.0
        self._last_transcript: str = ""
        self._last_emitted_transcript: str = ""

    def build_segments(self, result: SpeechRecognitionResult) -> List[Segment]:
        if not result.alternatives:
            return []

        alternative = result.alternatives[0]
        text = alternative.transcript.strip()
        if not text:
            return []

        segments = self._segments_from_words(alternative, text)
        if not segments:
            diff = self._diff_transcript(text)
            if not diff:
                self._last_transcript = text
                return []
            segments = [Segment(speaker=None, text=diff, start=0.0, end=0.0)]

        unique_segments = self._deduplicate(segments)
        if not unique_segments:
            diff = self._diff_transcript(text)
            if diff and diff != self._last_emitted_transcript:
                fallback = Segment(speaker=None, text=diff, start=0.0, end=0.0)
                unique_segments = [fallback]

        if unique_segments:
            self._last_emitted_transcript = text

        self._write_log(unique_segments)
        self._last_transcript = text
        return unique_segments

    def _segments_from_words(self, alternative: SpeechRecognitionAlternative, transcript: str) -> List[Segment]:
        words = getattr(alternative, "words", [])
        if not words:
            return []

        segments_meta: List[dict[str, Any]] = []
        current_words: List[str] = []
        current_speaker: Optional[int] = None
        current_start: Optional[float] = None
        current_end: Optional[float] = None
        max_end = self._last_word_end
        epsilon = 1e-3

        for word in words:
            speaker_tag = word.speaker_tag or None
            word_start, word_end = _time_to_seconds(word)
            if word_end <= self._last_word_end + epsilon:
                continue

            if current_speaker != speaker_tag and current_words:
                segments_meta.append(
                    {
                        "speaker": current_speaker,
                        "words": current_words[:],
                        "start": current_start or 0.0,
                        "end": current_end or word_end,
                    },
                )
                current_words = []
                current_start = None

            current_words.append(word.word)
            current_speaker = speaker_tag
            current_start = current_start or word_start
            current_end = word_end
            if word_end > max_end:
                max_end = word_end

        if current_words:
            segments_meta.append(
                {
                    "speaker": current_speaker,
                    "words": current_words[:],
                    "start": current_start or 0.0,
                    "end": current_end or 0.0,
                },
            )

        if segments_meta:
            self._last_word_end = max_end

        return self._assemble_segments(segments_meta, transcript)

    @staticmethod
    def _finalize_text(words: Iterable[str]) -> str:
        text = " ".join(words)
        return text.replace("  ", " ").strip()

    def _deduplicate(self, segments: Iterable[Segment]) -> List[Segment]:
        deduped: List[Segment] = []
        for segment in segments:
            key = (
                segment.speaker,
                round(segment.start, 2),
                round(segment.end, 2),
                segment.text,
            )
            if key in self._seen_keys:
                continue
            self._seen_keys.add(key)
            deduped.append(segment)
        return deduped

    def _write_log(self, segments: Iterable[Segment]) -> None:
        try:
            payload = [segment.to_dict() for segment in segments]
            self._log_path.parent.mkdir(parents=True, exist_ok=True)
            self._log_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as exc:  # pragma: no cover - logging only
            logger.debug("Failed to write diarization log: %s", exc)

    def _diff_transcript(self, text: str) -> str:
        if not text:
            return ""
        if not self._last_transcript:
            return text
        if text.startswith(self._last_transcript):
            diff = text[len(self._last_transcript):].lstrip()
            return diff
        # When transcript changes significantly (correction), emit latest text.
        return text

    @staticmethod
    def _is_word_char(char: str) -> bool:
        if char.isalnum():
            return True
        code = ord(char)
        return 0xAC00 <= code <= 0xD7A3  # Hangul syllables

    def _assemble_segments(self, segments_meta: List[dict[str, Any]], transcript: str) -> List[Segment]:
        if transcript.startswith(self._last_transcript):
            start_idx = len(self._last_transcript)
        else:
            start_idx = 0
        new_text = transcript[start_idx:]
        cursor = 0
        assembled: List[Segment] = []

        for meta in segments_meta:
            words: List[str] = meta["words"]
            extracted, cursor = self._extract_text_for_words(new_text, cursor, words)
            text = extracted if extracted else self._finalize_text(words)
            assembled.append(
                Segment(
                    speaker=meta["speaker"],
                    text=text.strip(),
                    start=meta["start"],
                    end=meta["end"],
                ),
            )

        return assembled

    def _extract_text_for_words(self, text: str, cursor: int, words: List[str]) -> tuple[str, int]:
        if not text or cursor >= len(text):
            return "", cursor

        buffer: list[str] = []
        length = len(text)

        for word in words:
            if not word:
                continue

            # Consume any leading separators before the word.
            while cursor < length and text[cursor] != word[0]:
                buffer.append(text[cursor])
                cursor += 1

            for ch in word:
                while cursor < length and text[cursor] != ch:
                    buffer.append(text[cursor])
                    cursor += 1
                if cursor < length:
                    buffer.append(text[cursor])
                    cursor += 1

        # Include trailing punctuation or separators associated with this segment.
        while cursor < length and not self._is_word_char(text[cursor]):
            buffer.append(text[cursor])
            cursor += 1

        return "".join(buffer), cursor
