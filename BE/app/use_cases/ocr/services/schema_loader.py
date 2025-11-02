"""스키마 및 프롬프트 로더"""

import json
from pathlib import Path
from typing import Dict, Any


class SchemaLoader:
    """계약서 스키마 및 프롬프트 로더"""

    def __init__(self):
        # BE/app/use_cases/ocr/ 경로
        self.ocr_base_dir = Path(__file__).parent.parent
        self.schema_dir = self.ocr_base_dir / "schema"
        self.prompt_dir = self.ocr_base_dir / "prompt"

    def load_schema(self, contract_type: str) -> Dict[str, Any]:
        """
        계약서 타입에 맞는 JSON 스키마 로드

        Args:
            contract_type: 계약서 타입 (예: "주택임대차표준계약서")

        Returns:
            dict: JSON Schema

        Raises:
            FileNotFoundError: 스키마 파일이 없는 경우
        """
        schema_path = self.schema_dir / f"{contract_type}.json"

        if not schema_path.exists():
            raise FileNotFoundError(f"Schema not found: {schema_path}")

        with open(schema_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def load_prompt(self, contract_type: str, ocr_text: str) -> str:
        """
        계약서 타입에 맞는 프롬프트를 로드하고 스키마와 OCR 텍스트를 삽입하여 완성된 프롬프트 반환

        Args:
            contract_type: 계약서 타입 (예: "주택임대차표준계약서")
            ocr_text: OCR로 추출된 원본 텍스트

        Returns:
            str: 완성된 프롬프트 (스키마 + OCR 텍스트 포함)

        Raises:
            FileNotFoundError: 프롬프트 파일이 없는 경우
        """
        # 프롬프트 템플릿 로드
        prompt_path = self.prompt_dir / f"{contract_type}.txt"

        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt not found: {prompt_path}")

        with open(prompt_path, "r", encoding="utf-8") as f:
            prompt_template = f.read()

        # 스키마 로드
        schema = self.load_schema(contract_type)

        # 프롬프트 구성: 스키마 삽입
        schema_json = json.dumps(schema, ensure_ascii=False, indent=2)
        full_prompt = prompt_template.replace(
            "{JSON Schema}",
            schema_json
        )

        # OCR 텍스트 추가
        full_prompt += f"\n\n[입력 문서]\n{ocr_text}\n\n[출력]\n"

        return full_prompt


def get_schema_loader() -> SchemaLoader:
    """
    SchemaLoader 인스턴스를 생성하는 Factory 함수

    Returns:
        SchemaLoader: 스키마 로더 인스턴스
    """
    return SchemaLoader()
