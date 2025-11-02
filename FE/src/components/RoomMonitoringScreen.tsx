import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './RoomMonitoringScreen.css';
import { useSttSession } from '../realtime/useSttSession';
import { getRealtimeClient } from '../realtime/ws';
import { fetchAuthToken } from '../api/auth';
import { api } from '../api/http';
import type { LlmReport } from '../types/domain';

type ReportState = 'idle' | 'waiting' | 'ready';

export function RoomMonitoringScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    start,
    stop,
    state,
    bubbles,
    partial,
  } = useSttSession();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reportState, setReportState] = useState<ReportState>('idle');

  useEffect(() => {
    if (!roomId) {
      navigate('/home', { replace: true });
    }
  }, [navigate, roomId]);

  const handleStartRecording = useCallback(async () => {
    if (!roomId) {
      return;
    }
    try {
      setError(null);
      await start(roomId);
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : '녹음을 시작할 수 없습니다.';
      setError(message);
    }
  }, [roomId, start]);

  const handleStopRecording = useCallback(() => {
    stop();
  }, [stop]);

  const handlePauseRecording = useCallback(() => {
    setToast('일시 정지는 곧 제공될 예정입니다.');
  }, []);

  const handleUploadChange = useCallback(() => {
    if (!roomId) {
      return;
    }
    navigate(`/rooms/${roomId}/documents`);
  }, [navigate, roomId]);

  useEffect(() => {
    const client = getRealtimeClient();
    client.connect();

    const markReportReady = () => {
      setReportState((current) => (current === 'idle' ? current : 'ready'));
      setToast('AI 종합 리포트가 생성되었습니다!');
    };

    const extractRoomId = (value: unknown): string | null => {
      if (!value || typeof value !== 'object') {
        return null;
      }
      const record = value as Record<string, unknown>;
      const candidate = record.roomId ?? record.room_id;
      return typeof candidate === 'string' ? candidate : null;
    };

    const matchesRoom = (value?: string | null) => {
      if (!roomId || !value) {
        return true;
      }
      return value === roomId;
    };

    const unsubscribeOcr = client.subscribe('ocr.done', () => {
      setToast('서류 분석이 완료되었습니다! 결과를 확인해 주세요.');
    });

    const unsubscribeLlmDone = client.subscribe('llm.done', (payload) => {
      const targetRoomId = extractRoomId(payload);
      if (!matchesRoom(targetRoomId)) {
        return;
      }
      markReportReady();
    });

    const unsubscribeLlmResult = client.subscribe('llm.result', (payload) => {
      const report = payload as LlmReport | null;
      const targetRoomId = report?.roomId ?? extractRoomId(report);
      if (!matchesRoom(targetRoomId)) {
        return;
      }
      markReportReady();
    });

    return () => {
      unsubscribeOcr();
      unsubscribeLlmDone();
      unsubscribeLlmResult();
      stop();
    };
  }, [roomId, stop]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const isCapturing = useMemo(
    () => state === 'connecting' || state === 'ready' || state === 'recording',
    [state],
  );

  const transcriptText = useMemo(() => {
    const finalized = bubbles.map((bubble) => bubble.text).join(' ');
    if (partial) {
      return `${finalized} ${partial}`.trim();
    }
    return finalized.trim();
  }, [bubbles, partial]);

  const isWaitingView = reportState !== 'idle';
  const reportMessage = reportState === 'ready'
    ? 'AI가 모든 분석을 완료했어요!'
    : 'AI가 대화 내용과 서류 모두를 종합적으로 분석하고 있어요';

  const handleViewReport = useCallback(() => {
    if (!roomId || reportState !== 'ready') {
      return;
    }
    navigate(`/rooms/${roomId}/report`);
  }, [navigate, reportState, roomId]);

  const handleGenerateReport = useCallback(async () => {
    if (!roomId) {
      return;
    }
    try {
      setReportState('waiting');
      setError(null);
      await fetchAuthToken();
      await api(`/v1/llm/reports/${encodeURIComponent(roomId)}`, { method: 'POST' });
      setToast('AI 종합 리포트를 생성 중입니다. 잠시만 기다려 주세요!');
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : '리포트를 생성할 수 없습니다.';
      setError(message);
      setReportState('idle');
    }
  }, [roomId]);

  return (
    <div className="monitor-root">
      <div className="monitor-device">
        <div className="monitor-status-bar">
          <div className="monitor-time">9:41</div>
          <div className="monitor-levels">
            <div className="status-icon cellular">
              <span />
              <span />
              <span />
              <span />
            </div>
            <svg
              className="status-icon wifi"
              width="20"
              height="16"
              viewBox="0 0 20 16"
              aria-hidden
            >
              <path
                d="M10 15.5c.8 0 1.45-.65 1.45-1.45S10.8 12.6 10 12.6s-1.45.65-1.45 1.45S9.2 15.5 10 15.5z"
                fill="currentColor"
              />
              <path
                d="M10 10.2c1.84 0 3.58.72 4.88 2.02l1.35-1.35C14.6 9.24 12.38 8.3 10 8.3s-4.6.94-6.23 2.58l1.35 1.35A6.88 6.88 0 0110 10.2z"
                fill="currentColor"
                opacity=".75"
              />
              <path
                d="M10 5.8c3.34 0 6.41 1.36 8.63 3.58L20 8 19.77 7.7C17.22 5.16 13.73 3.7 10 3.7S2.78 5.16.23 7.7L0 8l1.37 1.38A12.18 12.18 0 0110 5.8z"
                fill="currentColor"
                opacity=".45"
              />
            </svg>
            <div className="status-icon battery" aria-hidden>
              <div className="battery-body">
                <div className="battery-charge" />
              </div>
              <div className="battery-cap" />
            </div>
          </div>
        </div>

        <header className="monitor-header">
          <button
            type="button"
            className="back-button"
            onClick={() => navigate(-1)}
            aria-label="이전으로"
          />
          <h1>계약 모니터링</h1>
        </header>

        <main className="monitor-content">
          {isWaitingView ? (
            <section className="monitor-report-progress">
              <h2>AI 종합 보고서를 만들고 있어요</h2>
              <p className="monitor-report-message">{reportMessage}</p>
              <img
                className="monitor-report-image"
                src="/boomerang.svg"
                alt="부메랑 로고"
                width={180}
                height={180}
              />
            </section>
          ) : (
            <>
              <section>
                <h2>방을 결정하셨나요?</h2>
                <p>계약 전, 대화를 같이 듣고 분석해드릴게요.</p>
                <p className="monitor-subtitle">아래 녹음 버튼을 눌러 바로 시작해보세요!</p>
              </section>

              <section className="monitor-transcript">
                {transcriptText ? (
                  <p className="transcript-text">{transcriptText}</p>
                ) : (
                  <p className="transcript-placeholder">
                    AI가 받아 적은 대화 내용이 여기에 표시됩니다.
                  </p>
                )}
              </section>

              <section className="monitor-recorder">
                {isCapturing ? (
                  <div
                    className="recorder-card"
                    onClick={handleStopRecording}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleStopRecording();
                      }
                    }}
                  >
                    <div className="recorder-info">
                      <svg
                        className="recorder-mic"
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        aria-hidden
                      >
                        <path
                          d="M10 13c1.66 0 3-1.34 3-3V5a3 3 0 1 0-6 0v5c0 1.66 1.34 3 3 3Zm4.5-3a.75.75 0 0 1 1.5 0 5.5 5.5 0 0 1-5 5.48V18a.75.75 0 0 1-1.5 0v-2.52a5.5 5.5 0 0 1-5-5.48.75.75 0 0 1 1.5 0A4 4 0 0 0 10 14a4 4 0 0 0 4.5-4Z"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="recorder-text">
                        {state === 'recording' ? 'AI가 대화 듣는 중...' : 'AI가 대화 준비 중...'}
                      </span>
                    </div>
                    <div className="recorder-controls">
                      <button
                        type="button"
                        className="pause-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handlePauseRecording();
                        }}
                        title="일시 정지"
                      >
                        <span />
                        <span />
                      </button>
                      <button
                        type="button"
                        className="stop-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleStopRecording();
                        }}
                        title="녹음 종료"
                      >
                        <span />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="recorder-button"
                    onClick={handleStartRecording}
                  >
                    <span className="recorder-label">
                      <svg
                        className="recorder-mic"
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        aria-hidden
                      >
                        <path
                          d="M10 13c1.66 0 3-1.34 3-3V5a3 3 0 1 0-6 0v5c0 1.66 1.34 3 3 3Zm4.5-3a.75.75 0 0 1 1.5 0 5.5 5.5 0 0 1-5 5.48V18a.75.75 0 0 1-1.5 0v-2.52a5.5 5.5 0 0 1-5-5.48.75.75 0 0 1 1.5 0A4 4 0 0 0 10 14a4 4 0 0 0 4.5-4Z"
                          fill="currentColor"
                        />
                      </svg>
                      AI 녹음 대기 중
                    </span>
                    <span className="recorder-dot" />
                  </button>
                )}
                {error ? <div className="monitor-error">{error}</div> : null}
              </section>
            </>
          )}
        </main>

        <div className="monitor-actions">
          {isWaitingView ? (
            <button
              type="button"
              className="generate-button"
              onClick={handleViewReport}
              disabled={reportState !== 'ready'}
            >
              AI 종합 리포트 확인하기
            </button>
          ) : (
            <>
              <button
                type="button"
                className="upload-button"
                onClick={handleUploadChange}
                disabled={isCapturing}
              >
                서류 업로드하기
              </button>
              <button
                type="button"
                className="generate-button"
                onClick={handleGenerateReport}
                disabled={!roomId || isCapturing}
              >
                AI 종합 리포트 만들기
              </button>
            </>
          )}
        </div>

        {toast ? <div className="monitor-toast">{toast}</div> : null}

        <div className="monitor-home-indicator">
          <span className="home-bar" />
        </div>
      </div>
    </div>
  );
}
