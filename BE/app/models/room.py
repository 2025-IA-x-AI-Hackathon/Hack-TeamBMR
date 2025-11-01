from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


_CHECKLIST_QUESTIONS: List[tuple[str, str]] = [
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
]


def _default_checklist_items() -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for idx, (category, question) in enumerate(_CHECKLIST_QUESTIONS, start=1):
        items.append({f"q{idx}": f"{category} - {question}", f"a{idx}": None})
    return items


class RoomChecklist(BaseModel):
    items: List[Dict[str, Any]] = Field(
        default_factory=_default_checklist_items,
        description="List of dictionaries like {'q1': '질문', 'a1': True|False|None}.",
    )


class RoomPhoto(BaseModel):
    photo_id: str = Field(..., description="Unique identifier for the photo.")
    object_url: str = Field(..., description="Public or signed URL for the photo asset.")

class RoomBase(BaseModel):
    room_id: Optional[str] = Field(
        default=None,
        description="Internal room identifier for persistence. Generated if omitted.",
    )
    address: str = Field(..., description="Full street address for the room.")
    type: str = Field(..., description="Room type label, e.g. '원룸'.")
    floor: int = Field(..., ge=0, description="Floor number; 0 indicates ground/basement.")
    deposit: int = Field(..., ge=0, description="Deposit amount in 만원.")
    rent_monthly: int = Field(..., ge=0, description="Monthly rent in KRW.")
    fee_included: bool = Field(..., description="Whether maintenance fee is included in the rent.")
    fee_mgmt: Optional[int] = Field(
        default=None,
        ge=0,
        description="Monthly maintenance fee if not included.",
    )
    report_id: Optional[str] = Field(default=None, description="Linked report identifier.")
    checklist: RoomChecklist = Field(
        default_factory=RoomChecklist,
        description="Checklist items and responses for this room.",
    )
    photo_id: Optional[str] = Field(
        default=None,
        description="Identifier of the primary photo stored for this room.",
    )


class RoomDetailResponse(BaseModel):
    room_id: str = Field(..., description="Unique room identifier exposed to clients.")
    address: str = Field(..., description="Full street address for the room.")
    type: str = Field(..., description="Room type label, e.g. '원룸'.")
    floor: int = Field(..., ge=0, description="Floor number; 0 indicates ground/basement.")
    deposit: int = Field(..., ge=0, description="Deposit amount in 만원.")
    rent_monthly: int = Field(..., ge=0, description="Monthly rent in KRW.")
    fee_included: bool = Field(..., description="Whether maintenance fee is included in the rent.")
    fee_mgmt: Optional[int] = Field(
        default=None,
        ge=0,
        description="Monthly maintenance fee if not included.",
    )
    report_id: Optional[str] = Field(default=None, description="Linked report identifier.")
    checklist: RoomChecklist = Field(
        default_factory=RoomChecklist,
        description="Checklist values decorated for presentation.",
    )
    photo: Optional[RoomPhoto] = Field(
        default=None,
        description="Primary photo metadata substituted for the stored photo_id.",
    )
