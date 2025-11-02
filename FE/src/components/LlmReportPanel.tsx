import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { fetchLlmReport, normalizeLlmReport, triggerLlmReport } from '../api/llm';
import type { LlmReport } from '../types/domain';
import { getRealtimeClient } from '../realtime/ws';
import type { LlmErrorPayload, LlmProgressPayload } from '../realtime/stt.types';

type LlmStatus = 'idle' | 'triggering' | 'processing' | 'done' | 'error';

export function LlmReportPanel() {
  const client = useMemo(() => getRealtimeClient(), []);
  const [inputRoomId, setInputRoomId] = useState('');
  const [status, setStatus] = useState<LlmStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [report, setReport] = useState<LlmReport | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const [expandedPoints, setExpandedPoints] = useState<Record<string, boolean>>({});
  const [expandedGlossary, setExpandedGlossary] = useState<Record<string, boolean>>({});

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
          const payload = await response.json();
          const normalized = normalizeLlmReport(payload);
          setReport(normalized);
          setExpandedPoints({});
          setExpandedGlossary({});
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
      const normalized = normalizeLlmReport(payload);
      const normalizedRoomId = normalized.roomId || normalized.reportId || null;
      if (activeRoomIdRef.current && normalizedRoomId && normalizedRoomId !== activeRoomIdRef.current) {
        return;
      }
      activeRoomIdRef.current = normalizedRoomId;
      setActiveRoomId(normalizedRoomId);
      setReport(normalized);
      setExpandedPoints({});
      setExpandedGlossary({});
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
        <div className="llm-preview">
          <div className="llm-preview-shell">
            <header className="llm-preview-header">
              <h3>대화 내용과 서류를 같이 살펴봤어요.</h3>
              <p>{report.summary ?? '전반적으로 확인된 내용을 아래에서 확인해 주세요.'}</p>
            </header>

            {report.cautionPoints?.length ? (
              <section className="llm-preview-section caution">
                <div className="llm-preview-section-title">
                  <span role="img" aria-hidden>⚠️</span>
                  <div>
                    <h4>조심해서 봐야 할 부분</h4>
                    <p>바로잡아야 할 위험 신호를 먼저 점검해 주세요.</p>
                  </div>
                </div>
                <div className="llm-preview-points">
                  {report.cautionPoints.map((point, index) => {
                    const key = `caution-${index}`;
                    const expanded = expandedPoints[key];
                    return (
                      <article key={key} className={`llm-preview-point severity-${point.severity ?? 'info'}`}>
                        <div className="llm-preview-point-heading">
                          <div className="llm-preview-point-left">
                            <span className={`llm-preview-dot severity-${point.severity ?? 'info'}`} aria-hidden />
                            <span className="llm-preview-point-title">{point.title}</span>
                          </div>
                          <button
                            type="button"
                            className="llm-preview-toggle"
                            onClick={() => setExpandedPoints((prev) => ({
                              ...prev,
                              [key]: !prev[key],
                            }))}
                          >
                            {expanded ? '접기' : '자세히 보기'}
                          </button>
                        </div>
                        {expanded ? (
                          <p className="llm-preview-point-detail">{point.detail}</p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {report.goodPoints?.length ? (
              <section className="llm-preview-section good">
                <div className="llm-preview-section-title">
                  <span role="img" aria-hidden>✅</span>
                  <div>
                    <h4>잘 된 부분</h4>
                    <p>그대로 이어가면 좋은 포인트들이에요.</p>
                  </div>
                </div>
                <div className="llm-preview-points">
                  {report.goodPoints.map((point, index) => {
                    const key = `good-${index}`;
                    const expanded = expandedPoints[key];
                    return (
                      <article key={key} className={`llm-preview-point good severity-${point.severity ?? 'info'}`}>
                        <div className="llm-preview-point-heading">
                          <div className="llm-preview-point-left">
                            <span className={`llm-preview-dot severity-${point.severity ?? 'info'}`} aria-hidden />
                            <span className="llm-preview-point-title">{point.title}</span>
                          </div>
                          <button
                            type="button"
                            className="llm-preview-toggle"
                            onClick={() => setExpandedPoints((prev) => ({
                              ...prev,
                              [key]: !prev[key],
                            }))}
                          >
                            {expanded ? '접기' : '자세히 보기'}
                          </button>
                        </div>
                        {expanded ? (
                          <p className="llm-preview-point-detail">{point.detail}</p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {report.glossary?.length ? (
              <section className="llm-preview-section glossary">
                <div className="llm-preview-section-title">
                  <span role="img" aria-hidden>📘</span>
                  <div>
                    <h4>부동산 용어 알아보기</h4>
                    <p>문서에 함께 등장한 용어도 차근히 정리했어요.</p>
                  </div>
                </div>
                <div className="llm-preview-accordion">
                  {report.glossary.map((item, index) => {
                    const key = item.id ?? `glossary-${index}`;
                    const expanded = expandedGlossary[key];
                    return (
                      <article key={key} className="llm-preview-accordion-item">
                        <button
                          type="button"
                          className="llm-preview-accordion-trigger"
                          onClick={() => setExpandedGlossary((prev) => ({
                            ...prev,
                            [key]: !prev[key],
                          }))}
                        >
                          <span>{item.term}</span>
                          <span aria-hidden>{expanded ? '﹀' : '﹂'}</span>
                        </button>
                        {expanded ? (
                          <p className="llm-preview-accordion-body">{item.description}</p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <footer className="llm-preview-footer">
              <button
                type="button"
                className="llm-preview-home"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.href = '/home';
                  }
                }}
              >
                홈으로 돌아가기
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
