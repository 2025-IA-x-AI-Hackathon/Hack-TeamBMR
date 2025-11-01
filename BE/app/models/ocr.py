from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class OcrBase(BaseModel):
    """MongoDB persistence schema for OCR jobs."""

    ocr_id: Optional[str] = Field(
        default=None,
        description="Primary identifier for the OCR record. Generated if omitted.",
    )
    user_id: str = Field(..., description="Owner of the OCR job.")
    room_id: Optional[str] = Field(
        default=None,
        description="Associated report identifier, if any.",
    )
    status: str = Field(..., description="Processing status, e.g. queued, processing, done.")
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp when the OCR job was created.",
    )
    detail: Dict[str, Any] = Field(
        default_factory=dict,
        description="Arbitrary metadata or extraction result stored with the OCR job.",
    )
    object_key: Optional[str] = Field(
        default=None,
        description="Storage key for the uploaded document within object storage.",
    )


class OcrDetailResponse(BaseModel):
    """REST payload combining OCR persistence data with access information."""

    ocr_id: str = Field(..., description="Primary identifier for the OCR record.")
    user_id: str = Field(..., description="Owner of the OCR job.")
    room_id: Optional[str] = Field(
        default=None,
        description="Associated report identifier, if any.",
    )
    status: str = Field(..., description="Processing status, e.g. queued, processing, done.")
    created_at: datetime = Field(..., description="Timestamp when the OCR job was created.")
    detail: Dict[str, Any] = Field(
        default_factory=dict,
        description="OCR extraction result or job metadata returned to clients.",
    )
    object_url: Optional[str] = Field(
        default=None,
        description="Pre-signed URL for downloading the uploaded document.",
    )


class OcrUploadResponse(BaseModel):
    ocr_id: str = Field(..., description="Identifier assigned to the OCR upload request.")
    status: str = Field(..., description="Initial job status.")
    object_url: Optional[str] = Field(
        default=None,
        description="Pre-signed URL referencing the uploaded object when available.",
    )


class OcrListResponse(BaseModel):
    items: List[OcrDetailResponse] = Field(
        default_factory=list,
        description="Collection of OCR jobs for a given report.",
    )
