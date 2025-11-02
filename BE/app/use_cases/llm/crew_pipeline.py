import json
import os
from pathlib import Path
from typing import Any, Dict, List, Sequence

import yaml
from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv

load_dotenv()

# ---- 최소 전처리: STT → segments 수집, OCR → contract 얕은 병합 ----
def _collect_segments(details: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    segments: List[Dict[str, Any]] = []
    for detail in details or []:
        if not isinstance(detail, dict):
            continue

        # Allow raw segment dicts to pass through unchanged.
        if "text" in detail and "segments" not in detail and "conversation_segments" not in detail:
            text = (detail.get("text") or "").strip()
            if not text:
                continue
            segments.append(
                {
                    "text": text,
                    "t0": detail.get("t0"),
                    "t1": detail.get("t1"),
                }
            )
            continue

        for segment in detail.get("segments") or detail.get("conversation_segments") or []:
            if not isinstance(segment, dict):
                continue
            text = (segment.get("text") or segment.get("utterance") or "").strip()
            if not text:
                continue
            segments.append(
                {
                    "text": text,
                    "t0": segment.get("t0"),
                    "t1": segment.get("t1"),
                }
            )
    return segments


def _collect_contract(details: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    contract: Dict[str, Any] = {}
    for detail in details or []:
        if not isinstance(detail, dict):
            continue

        candidate = None
        for key in ("contract_json", "contract", "payload", "data"):
            value = detail.get(key)
            if isinstance(value, dict):
                candidate = value
                break
            if isinstance(value, str):
                try:
                    decoded = json.loads(value)
                except json.JSONDecodeError:
                    continue
                if isinstance(decoded, dict):
                    candidate = decoded
                    break

        if candidate is None and "title" in detail and "properties" in detail:
            candidate = detail

        if not isinstance(candidate, dict):
            continue

        for key, value in candidate.items():
            if value in (None, "", [], {}):
                continue
            contract[key] = value
    return contract


def _collect_checklists(details: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    checklists: List[Dict[str, Any]] = []
    for detail in details or []:
        if not isinstance(detail, dict):
            continue
        payload: Dict[str, Any] = {}
        if "room_id" in detail:
            payload["room_id"] = detail["room_id"]

        items = detail.get("items") or detail.get("checklist")
        if isinstance(items, str):
            try:
                decoded = json.loads(items)
            except json.JSONDecodeError:
                decoded = None
            if isinstance(decoded, list):
                items = decoded
        if isinstance(items, list):
            payload["items"] = items
        if payload:
            checklists.append(payload)
    return checklists


# ---- Crew 실행 ----
def run_real_estate_agent(
    stt_details: List[Dict[str, Any]],
    ocr_details: List[Dict[str, Any]],
    checklist_details: List[Dict[str, Any]],
) -> Any:
    segments = _collect_segments(stt_details)
    contract = _collect_contract(ocr_details)
    checklists = _collect_checklists(checklist_details)

    config = _load_config("crew_config.yaml")
    agents = _build_agents(config)
    tasks = _build_tasks(config, agents)

    process_enum = Process.sequential if config.get("process", "sequential").lower() == "sequential" else Process.parallel

    crew = Crew(
        agents=list(agents.values()),
        tasks=tasks,
        process=process_enum,
        verbose=False,
    )

    inputs = {
        "conversation_segments": json.dumps(segments, ensure_ascii=False),
        "contract_json": json.dumps(contract, ensure_ascii=False),
        "checklist_json": json.dumps(checklists, ensure_ascii=False),
    }

    result = crew.kickoff(inputs=inputs)

    # 최소 결과 처리: 태스크 출력 → 전체 출력 순으로 확인
    for task in reversed(tasks):
        out = getattr(task, "output", None)
        if not out:
            continue
        p = getattr(out, "pydantic", None)
        if p is not None:
            return p.model_dump()
        raw = getattr(out, "raw", None) or getattr(out, "raw_output", None)
        if raw is not None:
            try:
                return json.loads(raw)
            except (TypeError, json.JSONDecodeError):
                return raw

    out = getattr(result, "output", None) or getattr(result, "raw_output", None)
    if isinstance(out, str):
        try:
            return json.loads(out)
        except json.JSONDecodeError:
            return out
    if out is not None:
        return out

    if isinstance(result, str):
        try:
            return json.loads(result)
        except json.JSONDecodeError:
            return result

    return result


# ---- 설정 로딩/구성 ----
def _load_config(path: str) -> Dict[str, Any]:
    config_path = Path(path)
    if not config_path.is_absolute():
        config_path = Path(__file__).resolve().parent / config_path
    with config_path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    crews = data.get("crews", [])
    if not crews:
        raise ValueError("crew_config.yaml 에 crews 항목이 비어 있습니다.")
    return crews[0]


def _build_agents(config: Dict[str, Any]) -> Dict[str, Agent]:
    agents: Dict[str, Agent] = {}
    for a in config.get("agents", []):
        agents[a["id"]] = Agent(
            role=a.get("role", "Agent"),
            goal=a.get("goal", ""),
            backstory=a.get("backstory", ""),
            llm=a.get("llm", os.getenv("OPENAI_MODEL", "gpt-5")),
            allow_delegation=a.get("allow_delegation", False),
            config=a.get("config", {}),
        )
    if not agents:
        raise ValueError("crew_config.yaml 에 정의된 agent 가 없습니다.")
    return agents


def _build_tasks(config: Dict[str, Any], agents: Dict[str, Agent]) -> List[Task]:
    tasks: List[Task] = []
    for t in config.get("tasks", []):
        agent_id = t.get("agent")
        if agent_id not in agents:
            raise ValueError(f"태스크에 할당된 agent '{agent_id}'를 찾을 수 없습니다.")
        tasks.append(Task(
            description=t.get("description", ""),
            agent=agents[agent_id],
            expected_output="JSON 결과만 반환",
        ))
    if not tasks:
        raise ValueError("crew_config.yaml 에 정의된 task 가 없습니다.")
    return tasks
