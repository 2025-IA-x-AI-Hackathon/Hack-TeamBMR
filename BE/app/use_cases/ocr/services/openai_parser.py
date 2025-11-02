"""OpenAI API를 사용한 계약서 파싱 클라이언트"""

import json
from typing import Dict, Any
from openai import AsyncOpenAI
from app.core.config import settings


class OpenAIParser:
    """OpenAI API를 사용하여 OCR 텍스트를 구조화된 JSON으로 파싱"""

    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL

    async def parse_with_schema(
        self,
        full_prompt: str
    ) -> Dict[str, Any]:
        """
        완성된 프롬프트로 OpenAI API 호출하여 JSON 파싱

        Args:
            full_prompt: 완성된 프롬프트 (스키마 + OCR 텍스트 포함)

        Returns:
            dict: 파싱된 계약서 데이터 (JSON Schema에 맞는 구조)

        Raises:
            Exception: OpenAI API 호출 실패 시
        """
        # OpenAI API 호출
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a document structure analysis and information extraction expert. Extract information according to the JSON schema provided."
                },
                {
                    "role": "user",
                    "content": full_prompt
                }
            ],
            temperature=0,
            response_format={"type": "json_object"}
        )

        # 응답 파싱
        result = json.loads(response.choices[0].message.content)
        return result


def get_openai_parser() -> OpenAIParser:
    """
    OpenAIParser 인스턴스를 생성하는 Factory 함수

    Returns:
        OpenAIParser: OpenAI 파서 인스턴스
    """
    return OpenAIParser()
