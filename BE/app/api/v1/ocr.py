from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Path, Query, UploadFile, status
from fastapi.responses import JSONResponse

from app.models import OcrBase, OcrDetailResponse, OcrListResponse, OcrUploadResponse

router = APIRouter(prefix="/ocr")

OCR_STORE: Dict[str, OcrBase] = {}
OCR_INDEX_BY_REPORT: Dict[str, List[str]] = {}


def _to_detail(record: OcrBase, presigned_url: Optional[str] = None) -> OcrDetailResponse:
    return OcrDetailResponse(
        ocr_id=record.ocr_id or "",
        report_id=record.report_id,
        status=record.status,
        created_at=record.created_at,
        detail=record.detail,
        object_url=presigned_url,
    )


@router.post(
    "/uploads",
    status_code=status.HTTP_201_CREATED,
    response_model=OcrUploadResponse,
)
async def upload_ocr_document(
    file: UploadFile = File(...),
    report_id: Optional[str] = Query(None, description="Optional report identifier to group OCR uploads."),
) -> OcrUploadResponse:
    pass


@router.get(
    "/{report_id}",
    response_model=OcrListResponse,
    responses={status.HTTP_202_ACCEPTED: {"model": OcrListResponse}},
)
async def get_ocr_results(
    report_id: str = Path(..., description="Report identifier associated with OCR uploads."),
) -> List[OcrDetailResponse]:
    pass
