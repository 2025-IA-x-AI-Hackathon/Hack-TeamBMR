import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { fetchLlmReport, triggerLlmReport } from '../api/llm';
import type { LlmReport } from '../types/domain';
import { getRealtimeClient } from '../realtime/ws';
import type { LlmErrorPayload, LlmProgressPayload } from '../realtime/stt.types';

type LlmStatus = 'idle' | 'triggering' | 'processing' | 'done' | 'error';

function normalizeLlmReport(raw: Partial<LlmReport> & {
  room_id?: string;
  report_id?: string;
  status?: string;
  summary?: string;
  highlights?: string[];
  recommendations?: string[];
}): LlmReport {
  return {
    roomId: raw.roomId ?? raw.room_id ?? raw.reportId ?? raw.report_id ?? '',
    reportId: raw.reportId ?? raw.report_id ?? undefined,
    status: (raw.status as LlmReport['status']) ?? 'done',
    summary: raw.summary ?? '',
    highlights: raw.highlights ?? [],
    recommendations: raw.recommendations ?? [],
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

export function LlmReportPanel() {
  const client = useMemo(() => getRealtimeClient(), []);
  const [inputRoomId, setInputRoomId] = useState('');
  const [status, setStatus] = useState<LlmStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [report, setReport] = useState<LlmReport | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    client.connect();
  }, [client]);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputRoomId.trim()) {
      setError('roomId를 입력해주세요.');
      return;
    }

    setStatus('triggering');
    setError(null);
    setProgressStage(null);
    setReport(null);

    try {
      const trimmed = inputRoomId.trim();
      await triggerLlmReport(trimmed);
      setStatus('processing');
      setActiveRoomId(trimmed);
      activeRoomIdRef.current = trimmed;
    } catch (triggerError) {
      setError(triggerError instanceof Error ? triggerError.message : '보고서 생성 요청 중 오류가 발생했습니다.');
      setStatus('error');
    }
  }, [inputRoomId]);

  useEffect(() => {
    if (!activeRoomId || status !== 'processing') {
      return undefined;
    }

    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const response = await fetchLlmReport(activeRoomId);
        if (cancelled) {
          return;
        }

        if (response.status === 200) {
          const payload = await response.json() as LlmReport;
          const normalized = normalizeLlmReport(payload);
          setReport(normalized);
          setStatus('done');
          setProgressStage('완료');
          return;
        }

        if (response.status === 202) {
          timer = window.setTimeout(poll, 3_000);
        }
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : 'LLM 보고서 조회 중 오류가 발생했습니다.');
          setStatus('error');
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [activeRoomId, status]);

  useEffect(() => {
    const extractRoomId = (value: unknown): string | null => {
      if (!value || typeof value !== 'object') {
        return null;
      }
      const record = value as Record<string, unknown>;
      const candidate = record.roomId ?? record.room_id ?? record.report_id;
      return typeof candidate === 'string' ? candidate : null;
    };

    const unsubscribeProgress = client.subscribe('llm.progress', (payload) => {
      const progress = payload as LlmProgressPayload;
      const payloadRoomId = extractRoomId(progress);
      if (activeRoomIdRef.current && payloadRoomId && payloadRoomId !== activeRoomIdRef.current) {
        return;
      }
      setStatus('processing');
      setProgressStage(progress.stage);
    });

    const unsubscribeResult = client.subscribe('llm.result', (payload) => {
      const normalized = normalizeLlmReport(payload as LlmReport);
      const normalizedRoomId = normalized.roomId || normalized.reportId || null;
      if (activeRoomIdRef.current && normalizedRoomId && normalizedRoomId !== activeRoomIdRef.current) {
        return;
      }
      activeRoomIdRef.current = normalizedRoomId;
      setActiveRoomId(normalizedRoomId);
      setReport(normalized);
      setStatus('done');
      setProgressStage('완료');
    });

    const unsubscribeError = client.subscribe('llm.error', (payload) => {
      const llmError = payload as LlmErrorPayload;
      const payloadRoomId = extractRoomId(llmError);
      if (activeRoomIdRef.current && payloadRoomId && payloadRoomId !== activeRoomIdRef.current) {
        return;
      }
      setError(llmError.message);
      setStatus('error');
    });

    return () => {
      unsubscribeProgress();
      unsubscribeResult();
      unsubscribeError();
    };
  }, [client]);

  return (
    <div className="panel">
      <h2>LLM 보고서</h2>
      <form
        className="llm-form"
        onSubmit={handleSubmit}
      >
        <div className="field-row">
          <div className="field-group">
            <label htmlFor="llm-room-id">Room ID</label>
            <input
              id="llm-room-id"
              value={inputRoomId}
              onChange={(event) => setInputRoomId(event.target.value)}
              placeholder="예: rm_123"
              disabled={status === 'triggering' || status === 'processing'}
            />
          </div>
          <div className="field-group align-end">
            <button
              type="submit"
              className="primary"
              disabled={status === 'triggering' || status === 'processing'}
            >
              {status === 'triggering' ? '요청 중...' : '보고서 생성'}
            </button>
          </div>
        </div>
      </form>

      {status === 'processing' ? (
        <div className="status-text">
          보고서 생성 중... {progressStage ? `(${progressStage})` : null}
        </div>
      ) : null}

      {error ? <div className="error-text">{error}</div> : null}

      {report ? (
        <div className="llm-report">
          <h3>요약</h3>
          <p>{report.summary ?? '요약이 없습니다.'}</p>

          {report.highlights?.length ? (
            <>
              <h4>주요 사항</h4>
              <ul>
                {report.highlights.map((highlight, index) => (
                  <li key={index.toString()}>{highlight}</li>
                ))}
              </ul>
            </>
          ) : null}

          {report.recommendations?.length ? (
            <>
              <h4>추천 사항</h4>
              <ol>
                {report.recommendations.map((recommendation, index) => (
                  <li key={index.toString()}>{recommendation}</li>
                ))}
              </ol>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
