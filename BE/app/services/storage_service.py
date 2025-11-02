from __future__ import annotations

import asyncio
from typing import Optional

import boto3
from botocore.client import Config

from app.core.config import settings


class StorageService:
    """S3-backed storage utility for room assets."""

    def __init__(self) -> None:
        self._bucket = settings.AWS_S3_BUCKET
        self._expires_in = settings.AWS_PRESIGN_EXPIRES
        self._client = boto3.client(
            "s3",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "virtual"},
            ),
        )

    async def upload_bytes(
        self,
        key: str,
        data: bytes,
        *,
        content_type: Optional[str] = None,
    ) -> None:
        """Upload binary content to S3 at the provided key."""

        def _upload() -> None:
            params = {
                "Bucket": self._bucket,
                "Key": key,
                "Body": data,
            }
            if content_type:
                params["ContentType"] = content_type
            self._client.put_object(**params)

        await asyncio.to_thread(_upload)

    async def generate_presigned_url(self, key: str) -> str:
        """Generate a time-bound URL for accessing an object."""

        def _generate() -> str:
            return self._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=self._expires_in,
            )

        return await asyncio.to_thread(_generate)

    async def delete_object(self, key: str) -> None:
        """Delete an object from storage."""

        def _delete() -> None:
            self._client.delete_object(Bucket=self._bucket, Key=key)

        await asyncio.to_thread(_delete)


_storage_service: Optional[StorageService] = None


def get_storage_service() -> StorageService:
    """Return a singleton StorageService instance."""
    global _storage_service
    if _storage_service is None:
        _storage_service = StorageService()
    return _storage_service
