"""OCR Service - S3에서 PDF를 불러와 Upstage OCR 처리 후 OpenAI 파싱"""

from app.services.storage_service import get_storage_service
from .services.upstage_client import get_upstage_client
from .services.openai_parser import get_openai_parser
from .services.schema_loader import get_schema_loader


class OCRUsecase:
    """OCR 처리: S3 다운로드 → Upstage OCR → OpenAI 파싱"""

    def __init__(self):
        self.storage_service = get_storage_service()
        self.upstage_client = get_upstage_client()
        self.openai_parser = get_openai_parser()
        self.schema_loader = get_schema_loader()

    async def process(self, s3_key: str, contract_type: str = "주택임대차표준계약서") -> dict:
        """
        S3 PDF → Upstage OCR → OpenAI 파싱 → 구조화된 데이터

        Args:
            s3_key: S3 객체 키 (파일 경로)
            contract_type: 계약서 타입 (기본: 주택임대차표준계약서)

        Returns:
            dict: 파싱된 계약서 데이터 (스키마에 맞는 구조)
        """
        # STEP 1: S3에서 PDF 다운로드 (메모리)
        pdf_bytes = await self.storage_service.download_bytes(s3_key)

        # STEP 2: Upstage OCR API 호출 (원본 텍스트 추출)
        ocr_result = await self.upstage_client.ocr_document(pdf_bytes)
        raw_text = ocr_result.get("text", "")

        # STEP 3: 완성된 프롬프트 생성 (스키마 + OCR 텍스트 삽입)
        full_prompt = self.schema_loader.load_prompt(contract_type, raw_text)

        # STEP 4: OpenAI API로 구조화된 데이터 파싱
        parsed_data = await self.openai_parser.parse_with_schema(full_prompt)

        # STEP 5: 파싱된 데이터 반환
        return parsed_data


def get_ocr_usecase() -> OCRUsecase:
    """
    OCRUsecase 인스턴스를 생성하는 Factory 함수

    Returns:
        OCRUsecase: OCR 유스케이스 인스턴스
    """
    return OCRUsecase()
