from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.checklist import build_default_checklist_items


class RoomChecklist(BaseModel):
    items: List[Dict[str, Any]] = Field(
        default_factory=build_default_checklist_items,
        description="List of dictionaries like {'q1': '질문', 'a1': True|False|None}.",
    )


class RoomPhoto(BaseModel):
    photo_id: str = Field(..., description="Unique identifier for the photo.")
    object_url: str = Field(..., description="Public or signed URL for the photo asset.")
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp when the photo was registered.",
    )


class RoomCreateRequest(BaseModel):
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
    checklist: RoomChecklist = Field(
        default_factory=RoomChecklist,
        description="Checklist items and responses for this room.",
    )


class RoomBase(BaseModel):
    room_id: Optional[str] = Field(
        default=None,
        description="Internal room identifier for persistence. Generated if omitted.",
    )
    user_id: Optional[str] = Field(
        default=None,
        description="Identifier of the user that owns this room.",
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
    photo_key: Optional[str] = Field(
        default=None,
        description="Object storage key for the primary photo.",
    )
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp.")


class RoomDetailResponse(BaseModel):
    room_id: str = Field(..., description="Unique room identifier exposed to clients.")
    user_id: Optional[str] = Field(default=None, description="Owning user identifier.")
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
    created_at: datetime = Field(..., description="Creation timestamp.")
