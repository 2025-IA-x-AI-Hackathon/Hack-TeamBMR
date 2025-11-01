from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Path, Query, UploadFile, status
from fastapi.responses import JSONResponse

from app.api.dependencies import get_authenticated_user_id
from app.models import OcrDetailResponse, OcrListResponse, OcrUploadResponse
from app.services import OcrService, get_ocr_service

router = APIRouter(prefix="/ocr")


@router.post(
    "/uploads",
    status_code=status.HTTP_201_CREATED,
    response_model=OcrUploadResponse,
)
async def upload_ocr_document(
    file: UploadFile = File(...),
    # report_id: Optional[str] = Query(None, description="Optional report identifier to group OCR uploads."),
    # file_type: Optional[str] = Query(None, description="Type of the OCR report."),
    user_id: str = Depends(get_authenticated_user_id),
    service: OcrService = Depends(get_ocr_service),
) -> OcrUploadResponse:
    filename = file.filename
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file upload.")

    return await service.upload_document(
        user_id,
        # report_id,
        filename,
        # file_type,
        content,
        file.content_type,
    )


@router.get(
    "/{report_id}",
    response_model=OcrListResponse,
    responses={status.HTTP_202_ACCEPTED: {"model": OcrListResponse}},
)
async def get_ocr_results(
    report_id: str = Path(..., description="Report identifier associated with OCR uploads."),
    user_id: str = Depends(get_authenticated_user_id),
    service: OcrService = Depends(get_ocr_service),
) -> OcrListResponse | JSONResponse:
    items, pending = await service.list_results(user_id, report_id)
    response = OcrListResponse(items=items)
    if pending:
        return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content=response.model_dump())
    return response
