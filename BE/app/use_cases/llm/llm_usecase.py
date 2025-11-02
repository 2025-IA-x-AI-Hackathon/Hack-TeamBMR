from __future__ import annotations

import json
from typing import Any, Dict, List

import anyio
from fastapi import HTTPException

from app.use_cases.llm.crew_pipeline import run_real_estate_agent
from app.models.checklist import build_default_checklist_items


class LLMUsecase:
    async def process(
        self,
        stt_details: List[Dict[str, Any]],
        ocr_details: List[Dict[str, Any]],
        checklist_details: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        segments = self._extract_conversation_segments(stt_details, ocr_details)
        contract = self._extract_contract_json(ocr_details)
        checklist_payload = self._build_checklist_payload(checklist_details)

        stt_payload: List[Dict[str, Any]] = segments
        ocr_payload = self._build_ocr_payload(ocr_details, contract)

        result = await anyio.to_thread.run_sync(
            run_real_estate_agent,
            stt_payload,
            ocr_payload,
            checklist_payload,
        )

        if isinstance(result, dict):
            return result
        if isinstance(result, list):
            return {"result": result}
        if isinstance(result, str):
            try:
                return json.loads(result)
            except json.JSONDecodeError:
                return {"result": result}
        return {"result": result}

    def _extract_conversation_segments(
        self,
        stt_details: List[Dict[str, Any]],
        ocr_details: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        for details in (stt_details, ocr_details):
            for detail in details or []:
                normalized = self._normalize_segment_container(detail)
                if normalized:
                    return normalized

        if stt_details and all(isinstance(item, dict) and "text" in item for item in stt_details):
            normalized: List[Dict[str, Any]] = []
            for item in stt_details:
                text = (item.get("text") or "").strip()
                if not text:
                    continue
                normalized.append(
                    {
                        "text": text,
                        "t0": item.get("t0"),
                        "t1": item.get("t1"),
                    }
                )
            if normalized:
                return normalized

        raise HTTPException(status_code=422, detail="대화 세그먼트를 찾을 수 없습니다.")

    def _extract_contract_json(self, ocr_details: List[Dict[str, Any]]) -> Dict[str, Any]:
        for detail in ocr_details or []:
            if not isinstance(detail, dict):
                continue
            for key in ("contract_json", "contract", "payload", "data"):
                candidate = self._decode_if_json(detail.get(key))
                if isinstance(candidate, dict):
                    return candidate
            if "title" in detail and "properties" in detail:
                return detail

        raise HTTPException(status_code=422, detail="계약서 JSON을 찾을 수 없습니다.")

    def _build_ocr_payload(self, ocr_details: List[Dict[str, Any]], contract: Dict[str, Any]) -> List[Dict[str, Any]]:
        payload = [detail for detail in ocr_details or [] if isinstance(detail, dict)]
        if not any({"contract_json", "contract"} & detail.keys() for detail in payload):
            payload.append({"contract_json": contract})
        if not payload:
            payload.append({"contract_json": contract})
        return payload

    def _build_checklist_payload(self, checklist_details: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        payload: List[Dict[str, Any]] = []
        for detail in checklist_details or []:
            if not isinstance(detail, dict):
                continue

            items = None
            if "items" in detail:
                items = self._extract_checklist_items(detail["items"])
            elif "checklist" in detail:
                items = self._extract_checklist_items(detail["checklist"])
            else:
                items = self._extract_checklist_items(detail)

            if not items:
                continue

            entry: Dict[str, Any] = {"items": items}
            room_id = detail.get("room_id")
            if isinstance(room_id, str):
                entry["room_id"] = room_id
            payload.append(entry)

        if not payload:
            payload.append({"items": build_default_checklist_items()})

        return payload

    def _extract_checklist_items(self, raw: Any) -> List[Dict[str, Any]] | None:
        decoded = self._decode_if_json(raw)
        if isinstance(decoded, dict):
            decoded = decoded.get("items")

        if not isinstance(decoded, list):
            return None

        normalized: List[Dict[str, Any]] = []
        for entry in decoded:
            if isinstance(entry, dict):
                normalized.append(entry)

        return normalized or None

    @staticmethod
    def _decode_if_json(value: Any) -> Any:
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return value

    def _normalize_segment_container(self, container: Dict[str, Any]) -> List[Dict[str, Any]] | None:
        if not isinstance(container, dict):
            return None

        segments = (
            container.get("segments")
            or container.get("conversation_segments")
            or container.get("transcript")
        )
        segments = self._decode_if_json(segments)
        if not isinstance(segments, list):
            return None

        normalized: List[Dict[str, Any]] = []
        for segment in segments:
            if not isinstance(segment, dict):
                continue
            text = (segment.get("text") or segment.get("utterance") or "").strip()
            if not text:
                continue
            t0 = segment.get("t0")
            t1 = segment.get("t1")
            if t0 is None:
                t0 = segment.get("start")
            if t1 is None:
                t1 = segment.get("end")
            normalized.append(
                {
                    "text": text,
                    "t0": t0,
                    "t1": t1,
                    "speaker": segment.get("speaker"),
                    "segment_key": segment.get("segment_key"),
                }
            )

        return normalized or None


def get_llm_usecase() -> LLMUsecase:
    return LLMUsecase()
