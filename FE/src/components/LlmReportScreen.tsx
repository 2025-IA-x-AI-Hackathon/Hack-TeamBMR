import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './LlmReportScreen.css';
import { fetchLlmReport, normalizeLlmReport } from '../api/llm';
import type {
  LlmReport,
  LlmReportPoint,
  LlmReportSeverity,
  LlmReportGlossaryItem,
} from '../types/domain';

export function LlmReportScreen() {
  const { roomId } = useParams<{ roomId: string}>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<LlmReport | null>(null);
  const [expandedPoints, setExpandedPoints] = useState<Record<string, boolean>>({});
  const [expandedGlossary, setExpandedGlossary] = useState<Record<string, boolean>>({});

  const loadReport = useCallback(async () => {
    if (!roomId) {
      navigate('/home', { replace: true });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetchLlmReport(roomId);
      if (response.status === 202) {
        setError('AI 리포트를 준비하는 중입니다. 잠시 후 다시 확인해 주세요.');
        setReport(null);
        return;
      }
      if (response.status === 404) {
        setError('AI 리포트를 찾을 수 없습니다.');
        setReport(null);
        return;
      }
      if (!response.ok) {
        throw new Error('AI 리포트를 불러오는 중 문제가 발생했습니다.');
      }
      const payload = await response.json();
      const data = normalizeLlmReport(payload);
      if (data.roomId && roomId && data.roomId !== roomId) {
        setError('다른 방의 AI 리포트를 불러왔어요. 다시 시도해 주세요.');
        setReport(null);
        return;
      }
      setReport(data);
      setExpandedPoints({});
      setExpandedGlossary({});
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'AI 리포트를 불러오지 못했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [navigate, roomId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const cautionPoints = useMemo(() => report?.cautionPoints ?? [], [report]);
  const goodPoints = useMemo(() => report?.goodPoints ?? [], [report]);
  const glossaryItems = useMemo(() => report?.glossary ?? [], [report]);

  const handleGlossaryToggle = (key: string) => {
    setExpandedGlossary((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) {
    return (
      <div className="llm-root">
        <div className="llm-device">
          <div className="llm-loading">AI 리포트를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="llm-root">
        <div className="llm-device">
          <div className="llm-error">{error ?? 'AI 리포트를 찾을 수 없습니다.'}</div>
          <button
            type="button"
            className="llm-home-button"
            onClick={() => navigate('/home')}
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="llm-root">
      <div className="llm-device">
        <div className="llm-status-bar">
          <div className="llm-time">9:41</div>
          <div className="llm-levels">
            <div className="status-icon cellular">
              <span /><span /><span /><span />
            </div>
            <svg className="status-icon wifi" width="20" height="16" viewBox="0 0 20 16" aria-hidden>
              <path d="M10 15.5c.8 0 1.45-.65 1.45-1.45S10.8 12.6 10 12.6s-1.45.65-1.45 1.45S9.2 15.5 10 15.5z" fill="currentColor" />
              <path d="M10 10.2c1.84 0 3.58.72 4.88 2.02l1.35-1.35C14.6 9.24 12.38 8.3 10 8.3s-4.6.94-6.23 2.58l1.35 1.35A6.88 6.88 0 0 1 10 10.2z" fill="currentColor" opacity=".75" />
              <path d="M10 5.8c3.34 0 6.41 1.36 8.63 3.58L20 8l-.23-.3C17.22 5.16 13.73 3.7 10 3.7S2.78 5.16.23 7.7L0 8l1.37 1.38A12.18 12.18 0 0 1 10 5.8z" fill="currentColor" opacity=".45" />
            </svg>
            <div className="status-icon battery" aria-hidden>
              <div className="battery-body">
                <div className="battery-charge" />
              </div>
              <div className="battery-cap" />
            </div>
          </div>
        </div>

        <header className="llm-header">
          <button
            type="button"
            className="back-button"
            onClick={() => navigate(-1)}
            aria-label="이전으로"
          />
          <h1>AI 종합 리포트</h1>
        </header>

        <main className="llm-content">
          <section className="llm-summary">
            <h2>대화 내용과 서류를 같이 살펴봤어요.</h2>
            <p>{report.summary ?? '전반적으로 큰 문제는 없지만, 조심해서 보면 좋은 부분 몇 가지를 확인했어요.'}</p>
          </section>

          {cautionPoints.length ? (
            <section className="llm-section">
              <header className="llm-section-title">
                <span className="llm-section-icon" aria-hidden>
                  <svg className="llm-icon llm-icon-caution" viewBox="0 0 24 24">
                    <path d="M12 3 1 21h22L12 3Zm0 6c.55 0 1 .45 1 1v5a1 1 0 1 1-2 0v-5c0-.55.45-1 1-1Zm0 10.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z" />
                  </svg>
                </span>
                <div>
                  <h3>조심해서 봐야 할 부분</h3>
                  <p>바로잡아야 할 위험 신호를 먼저 점검해 주세요.</p>
                </div>
              </header>
              <div className="llm-point-list">
                {cautionPoints.map((point, index) => {
                  const key = `caution-${index}`;
                  const expanded = expandedPoints[key] ?? false;
                  return (
                    <ReportPointCard
                      key={key}
                      point={point}
                      expanded={expanded}
                      onToggle={() => setExpandedPoints((prev) => ({
                        ...prev,
                        [key]: !prev[key],
                      }))}
                    />
                  );
                })}
              </div>
            </section>
          ) : null}

          {goodPoints.length ? (
            <section className="llm-section">
              <header className="llm-section-title">
                <span className="llm-section-icon" aria-hidden>
                  <svg className="llm-icon llm-icon-good" viewBox="0 0 24 24">
                    <path d="m9.2 17.6-5.3-5.3 1.4-1.4 3.9 3.9 9.7-9.7 1.4 1.4-11.1 11.1Z" />
                  </svg>
                </span>
                <div>
                  <h3>잘 된 부분</h3>
                  <p>그대로 이어가면 좋은 포인트들이에요.</p>
                </div>
              </header>
              <div className="llm-point-list">
                {goodPoints.map((point, index) => {
                  const key = `good-${index}`;
                  const expanded = expandedPoints[key] ?? false;
                  return (
                    <ReportPointCard
                      key={key}
                      point={point}
                      expanded={expanded}
                      onToggle={() => setExpandedPoints((prev) => ({
                        ...prev,
                        [key]: !prev[key],
                      }))}
                    />
                  );
                })}
              </div>
            </section>
          ) : null}

          {glossaryItems.length ? (
            <section className="llm-section">
              <header className="llm-section-title">
                <span className="llm-section-icon" aria-hidden>
                  <svg className="llm-icon llm-icon-glossary" viewBox="0 0 24 24">
                    <path d="M5 4c-1.1 0-2 .9-2 2v13h2.5c1.1 0 2 .9 2 2h11.5V6c0-1.1-.9-2-2-2H5Zm2.5 15H5V6h2.5c.28 0 .5.22.5.5v12c0 .28-.22.5-.5.5ZM9 5h8.5c.28 0 .5.22.5.5V20h-8v-1h5v-2h-5V5Z" />
                  </svg>
                </span>
                <div>
                  <h3>부동산 용어 알아보기</h3>
                  <p>문서에 함께 등장한 용어도 차근히 정리했어요.</p>
                </div>
              </header>
              <div className="llm-glossary-list">
                {glossaryItems.map((item, index) => {
                  const key = item.id ?? `glossary-${index}`;
                  const expanded = expandedGlossary[key] ?? false;
                  return (
                    <GlossaryItem
                      key={key}
                      item={item}
                      expanded={expanded}
                      onToggle={() => handleGlossaryToggle(key)}
                    />
                  );
                })}
              </div>
            </section>
          ) : null}
        </main>

        <div className="llm-actions">
          <button
            type="button"
            className="llm-home-button"
            onClick={() => navigate('/home')}
          >
            홈으로 돌아가기
          </button>
        </div>

        <div className="llm-home-indicator">
          <span className="home-bar" />
        </div>
      </div>
    </div>
  );
}

type ReportPointCardProps = {
  point: LlmReportPoint;
  expanded: boolean;
  onToggle: () => void;
};

function ReportPointCard({ point, expanded, onToggle }: ReportPointCardProps) {
  const severity: LlmReportSeverity = point.severity ?? 'info';
  const isCaution = point.kind === 'caution';
  const hasDetail = Boolean(point.detail);
  return (
    <article className={`llm-point-card severity-${severity}${point.kind === 'good' ? ' is-good' : ''}${expanded ? ' expanded' : ''}`}>
      <div className="llm-point-header">
        <div className="llm-point-left">
          <span className={`llm-point-dot severity-${severity}`} aria-hidden />
          <span className="llm-point-title">{point.title}</span>
        </div>
        {hasDetail ? (
          <button
            type="button"
            className={`llm-point-toggle${expanded ? ' expanded' : ''}`}
            onClick={onToggle}
          >
            <span>{expanded ? '접기' : '자세히 보기'}</span>
            <svg className="llm-point-toggle-icon" viewBox="0 0 16 16" aria-hidden>
              <path d="m4 6 4 4 4-4" />
            </svg>
          </button>
        ) : null}
      </div>
      {hasDetail && expanded ? (
        <p className={`llm-point-detail${isCaution ? ' caution' : ''}`}>{point.detail}</p>
      ) : null}
    </article>
  );
}

type GlossaryItemProps = {
  item: LlmReportGlossaryItem;
  expanded: boolean;
  onToggle: () => void;
};

function GlossaryItem({ item, expanded, onToggle }: GlossaryItemProps) {
  return (
    <article className={`llm-accordion-item${expanded ? ' expanded' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`llm-accordion-trigger${expanded ? ' expanded' : ''}`}
      >
        <span>{item.term}</span>
        <svg className="llm-accordion-icon" viewBox="0 0 16 16" aria-hidden>
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {expanded ? (
        <p className="llm-accordion-body">{item.description}</p>
      ) : null}
    </article>
  );
}
