from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import sys

import pytest

sys.path.append(str(Path(__file__).resolve().parents[2]))

from app.models import LLMReportDetail, LLMReportTriggerPayload
from app.services.llm_service import LlmService


def _stub_dependencies(monkeypatch: pytest.MonkeyPatch, *, process_result: dict, ocr_details: list[dict]) -> None:
    mock_usecase = MagicMock()
    mock_usecase.process = AsyncMock(return_value=process_result)
    monkeypatch.setattr("app.services.llm_service.get_llm_usecase", lambda: mock_usecase)

    mock_ocr_service = MagicMock()
    mock_ocr_service.list_details = AsyncMock(return_value=ocr_details)
    monkeypatch.setattr("app.services.llm_service.get_ocr_service", lambda: mock_ocr_service)

    dummy_session = object()

    @asynccontextmanager
    async def session_ctx():
        yield dummy_session

    monkeypatch.setattr("app.services.llm_service.get_session", session_ctx)


@pytest.mark.asyncio
async def test_create_report_generates_and_persists(monkeypatch: pytest.MonkeyPatch) -> None:
    repository = MagicMock()
    repository.upsert = AsyncMock()
    repository.get = AsyncMock(return_value=None)

    _stub_dependencies(
        monkeypatch,
        process_result={"summary": "ok"},
        ocr_details=[{"contract_json": {"rent": 1000}}],
    )

    service = LlmService(repository)

    ack = await service.create_report("user-1", "room-1", LLMReportTriggerPayload())

    repository.upsert.assert_awaited_once()
    args, kwargs = repository.upsert.await_args
    saved_report = args[0]
    assert isinstance(saved_report, LLMReportDetail)
    assert saved_report.room_id == "room-1"
    assert saved_report.user_id == "user-1"
    assert saved_report.status == "done"
    assert saved_report.detail == {"summary": "ok"}
    assert kwargs["session"] is not None

    assert ack.room_id == "room-1"
    assert ack.user_id == "user-1"
    assert ack.status == "done"


@pytest.mark.asyncio
async def test_get_report_returns_existing(monkeypatch: pytest.MonkeyPatch) -> None:
    existing = LLMReportDetail(
        room_id="room-1",
        user_id="user-1",
        status="done",
        created_at=datetime.now(UTC),
        detail={"summary": "cached"},
    )

    repository = MagicMock()
    repository.get = AsyncMock(return_value=existing)
    repository.upsert = AsyncMock()

    service = LlmService(repository)

    result = await service.get_report("user-1", "room-1")

    assert result is existing
    repository.upsert.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_report_generates_when_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    repository = MagicMock()
    repository.get = AsyncMock(return_value=None)
    repository.upsert = AsyncMock()

    _stub_dependencies(
        monkeypatch,
        process_result={"summary": "generated"},
        ocr_details=[{"contract_json": {"rent": 1200}}],
    )

    service = LlmService(repository)

    report = await service.get_report("user-1", "room-1")

    repository.upsert.assert_awaited_once()
    assert report.room_id == "room-1"
    assert report.detail == {"summary": "generated"}
