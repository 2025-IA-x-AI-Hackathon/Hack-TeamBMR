from __future__ import annotations

from typing import List, Optional, Tuple
from uuid import uuid4

from app.database.mongodb import get_ocr_collection, get_session
from app.models import OcrBase, OcrDetailResponse, OcrUploadResponse
from app.repositories import OcrRepository
from app.services.storage_service import StorageService, get_storage_service


class OcrService:
    def __init__(self, repository: OcrRepository, storage: StorageService) -> None:
        self._repository = repository
        self._storage = storage

    async def upload_document(
        self,
        user_id: str,
        report_id: Optional[str],
        filename: str,
        content: bytes,
        content_type: Optional[str],
    ) -> OcrUploadResponse:
        ocr_id = f"ocr_{uuid4().hex[:10]}"
        object_key = f"ocr/{user_id}/{ocr_id}/{filename}"

        await self._storage.upload_bytes(
            object_key,
            content,
            content_type=content_type or "application/octet-stream",
        )

        record = OcrBase(
            ocr_id=ocr_id,
            user_id=user_id,
            report_id=report_id,
            status="done",
            detail={"message": "Upload received."},
            object_key=object_key,
        )

        async with get_session() as session:
            await self._repository.insert(record, session=session)

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


def get_ocr_service() -> OcrService:
    repository = OcrRepository(get_ocr_collection())
    storage = get_storage_service()
    return OcrService(repository, storage)
