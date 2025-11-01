from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from app.database.mongodb import get_ocr_collection, get_session
from app.models import OcrBase, OcrDetailResponse, OcrUploadResponse
from app.repositories import OcrRepository
from app.services.storage_service import StorageService, get_storage_service
from app.use_cases.ocr import get_ocr_use_case

class OcrService:
    def __init__(self, repository: OcrRepository, storage: StorageService) -> None:
        self._repository = repository
        self._storage = storage

    async def upload_document(
        self,
        user_id: str,
        report_id: Optional[str],
        filename: str,
        file_type: Optional[str],
        content: bytes,
        content_type: Optional[str],
    ) -> OcrUploadResponse:
        safe_report_id = report_id or "unassigned"
        safe_file_type = file_type or "generic"
        file_stem = Path(filename).stem or f"upload-{uuid4().hex[:8]}"
        ocr_id = f"{safe_report_id}-{safe_file_type}-{file_stem}"
        object_key = f"ocr/{user_id}/{safe_report_id}/{safe_file_type}/{filename}"

        await self._storage.upload_bytes(
            object_key,
            content,
            content_type=content_type or "application/octet-stream",
        )
        ocr_use_case = get_ocr_use_case()
        record = OcrBase(
            ocr_id=ocr_id,
            user_id=user_id,
            report_id=report_id,
            status="done",
            detail=await ocr_use_case.process(object_key),  # 추후 합치면 제공될 예정!
            object_key=object_key,
        )

        async with get_session() as session:
            await self._repository.upsert(record, session=session)

        url = await self._storage.generate_presigned_url(object_key)
        return OcrUploadResponse(ocr_id=ocr_id, status=record.status, object_url=url)

    async def list_results(self, user_id: str, report_id: str) -> Tuple[List[OcrDetailResponse], bool]:
        records = await self._repository.list_by_report(user_id, report_id)
        if not records:
            return [], True

        responses: List[OcrDetailResponse] = []
        pending = False

        for record in records:
            if record.status != "done":
                pending = True
            object_url = None
            if record.object_key:
                object_url = await self._storage.generate_presigned_url(record.object_key)
            responses.append(
                OcrDetailResponse(
                    ocr_id=record.ocr_id or "",
                    user_id=record.user_id,
                    report_id=record.report_id,
                    status=record.status,
                    created_at=record.created_at,
                    detail=record.detail,
                    object_url=object_url,
                )
            )

        return responses, pending

    async def list_details(self, user_id: str, report_id: str) -> List[Dict[str, Any]]:
        records = await self._repository.list_by_report(user_id, report_id)
        return [record.detail for record in records]


def get_ocr_service() -> OcrService:
    repository = OcrRepository(get_ocr_collection())
    storage = get_storage_service()
    return OcrService(repository, storage)
