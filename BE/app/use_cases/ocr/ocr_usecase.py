"""OCR Service - S3에서 PDF를 불러와 OCR 처리"""

from .s3_service import S3Service


class OCRUsecase:
    """OCR 서비스 모킹 클래스"""

    def __init__(self, s3_service: S3Service):
        self.s3_service = s3_service

    async def process(self, s3_key: str) -> dict:
        """
        S3에서 PDF를 불러와 OCR 처리

        Args:
            s3_key: S3 객체 키 (파일 경로)

        Returns:
            dict: OCR 처리 결과 (현재는 빈 dict)
        """
        # S3에서 PDF 다운로드
        pdf_bytes = self.s3_service.download_pdf(s3_key)

        # OCR 처리 (현재는 모킹)
        # TODO: 실제 OCR API 호출 구현
        _ = pdf_bytes  # 사용하지 않는 변수 표시

        return {
            "text": "This is a mocked OCR result.",
            "pages": 1,
        }


def get_ocr_usecase() -> OCRUsecase:
    """
    OCRUsecase 인스턴스를 생성하는 Factory 함수

    Args:
        bucket_name: S3 버킷 이름 (기본값: "default-bucket")

    Returns:
        OCRUsecase: OCR 유스케이스 인스턴스
    """
    return OCRUsecase(s3_service=S3Service())
