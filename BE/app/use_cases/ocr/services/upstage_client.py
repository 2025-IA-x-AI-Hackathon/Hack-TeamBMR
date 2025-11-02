"""Upstage AI API 클라이언트"""

from io import BytesIO
import httpx
from app.core.config import settings


class UpstageClient:
    """Upstage AI Document OCR API 클라이언트"""

    def __init__(self):
        self.api_url = settings.UPSTAGE_API_URL
        self.api_key = settings.UPSTAGE_API_KEY

    async def ocr_document(self, pdf_bytes: bytes) -> dict:
        """
        PDF 문서를 OCR 처리

        Args:
            pdf_bytes: PDF 파일의 바이너리 데이터 (메모리)

        Returns:
            dict: Upstage OCR API 원본 응답
            {
                "apiVersion": "...",
                "text": "추출된 텍스트...",
                "confidence": 0.95,
                "metadata": {...}
            }

        Raises:
            httpx.HTTPStatusError: API 호출 실패 시
            httpx.RequestError: 네트워크 에러 발생 시
        """
        async with httpx.AsyncClient(timeout=60.0) as client:
            files = {
                "document": ("document.pdf", BytesIO(pdf_bytes), "application/pdf")
            }
            data = {"model": "ocr"}
            headers = {"Authorization": f"Bearer {self.api_key}"}

            response = await client.post(
                self.api_url,
                headers=headers,
                files=files,
                data=data
            )
            response.raise_for_status()

            return response.json()


def get_upstage_client() -> UpstageClient:
    """
    UpstageClient 인스턴스를 생성하는 Factory 함수

    Returns:
        UpstageClient: Upstage API 클라이언트 인스턴스
    """
    return UpstageClient()
