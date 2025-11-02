from __future__ import annotations

from typing import Any, Dict, List, Tuple

from pydantic import BaseModel, Field


_CHECKLIST_QUESTIONS: Tuple[Tuple[str, str], ...] = (
    ("수도와 배수", "싱크대/세면대/샤워기 물은 잘 나오는가"),
    ("수도와 배수", "변기 물은 잘 내려가는가"),
    ("수도와 배수", "싱크대/화장실 온수는 잘 나오는가"),
    ("창문", "햇빛은 잘 들어오는가"),
    ("창문", "방충망/방범창은 이상 없는가"),
    ("창문", "옆 건물에서 너무 잘 보이지 않는가"),
    ("화장실", "화장실 내부에 창문이 있는가"),
    ("화장실", "배수구 냄새는 나지 않는가"),
    ("화장실", "공간이 충분히 넓은가"),
    ("주변 환경", "대중교통 이용은 편리한가"),
    ("주변 환경", "편의점, 은행 등 편의시설이 있는가"),
    ("주변 환경", "언덕에 있는가"),
    ("디테일", "벽지에 곰팡이 흔적은 없는가"),
    ("디테일", "바퀴약 설치는 없는가"),
    ("디테일", "콘센트 개수는 충분한가"),
    ("보안", "공동현관 비밀번호가 있는가"),
    ("보안", "출입구와 복도에 CCTV가 있는가"),
    ("보안", "건물에 집주인이 사는가"),
)


def build_default_checklist_items() -> List[Dict[str, Any]]:
    """Return a fresh checklist structure used for rooms and template responses."""

    items: List[Dict[str, Any]] = []
    for idx, (category, question) in enumerate(_CHECKLIST_QUESTIONS, start=1):
        items.append(
            {
                f"q{idx}": f"{category} - {question}",
                f"a{idx}": None,
            }
        )
    return items


DEFAULT_CHECKLIST_ITEMS: List[Dict[str, Any]] = build_default_checklist_items()


class ChecklistResponse(BaseModel):
    items: List[Dict[str, Any]] = Field(
        default_factory=build_default_checklist_items,
        description="Checklist items mirroring the room checklist structure.",
    )


__all__ = [
    "ChecklistResponse",
    "build_default_checklist_items",
    "DEFAULT_CHECKLIST_ITEMS",
]
