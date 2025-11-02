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
  LlmReportItem,
  LlmReportSeverity,
  LlmReportGlossaryItem,
} from '../types/domain';

type AccordionState = Record<string, boolean>;

const severityLabel: Record<LlmReportSeverity, string> = {
  high: '위험',
  medium: '주의',
  low: '참고',
  info: '정보',
};

export function LlmReportScreen() {
  const { roomId } = useParams<{ roomId: string}>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<LlmReport | null>(null);
  const [expandedItems, setExpandedItems] = useState<AccordionState>({});

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

  const handleToggle = (key: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const cautionItems = useMemo(() => report?.cautions ?? [], [report]);
  const positiveItems = useMemo(() => report?.positives ?? [], [report]);
  const glossaryItems = useMemo(() => report?.glossary ?? [], [report]);

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
          <section className="llm-intro">
            <h2>대화 내용과 서류를 같이 살펴봤어요.</h2>
            <p>{report.summary ?? '전반적으로 확인된 내용을 아래에서 확인해 보세요.'}</p>
          </section>

          {cautionItems.length ? (
            <section>
              <div className="section-heading danger">
                <span aria-hidden>⚠️</span>
                <h3>조심해서 봐야 할 부분</h3>
              </div>
              <div className="llm-card-list">
                {cautionItems.map((item, index) => (
                  <ReportCard
                    key={item.id ?? `caution-${index}`}
                    item={item}
                    expanded={Boolean(expandedItems[item.id ?? `caution-${index}`])}
                    onToggle={() => handleToggle(item.id ?? `caution-${index}`)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {positiveItems.length ? (
            <section>
              <div className="section-heading success">
                <span aria-hidden>✅</span>
                <h3>잘 된 부분</h3>
              </div>
              <div className="llm-card-list">
                {positiveItems.map((item, index) => (
                  <ReportCard
                    key={item.id ?? `positive-${index}`}
                    item={item}
                    expanded={Boolean(expandedItems[item.id ?? `positive-${index}`])}
                    onToggle={() => handleToggle(item.id ?? `positive-${index}`)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {glossaryItems.length ? (
            <section className="llm-glossary">
              <div className="glossary-heading">
                <span aria-hidden>📘</span>
                <h3>부동산 용어 알아보기</h3>
              </div>
              <ul>
                {glossaryItems.map((item, index) => (
                  <GlossaryItem
                    key={item.id ?? `glossary-${index}`}
                    item={item}
                    expanded={Boolean(expandedItems[item.id ?? `glossary-${index}`])}
                    onToggle={() => handleToggle(item.id ?? `glossary-${index}`)}
                  />
                ))}
              </ul>
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

type ReportCardProps = {
  item: LlmReportItem;
  expanded: boolean;
  onToggle: () => void;
};

function ReportCard({ item, expanded, onToggle }: ReportCardProps) {
  const severity: LlmReportSeverity = item.severity ?? 'info';
  return (
    <article className={`llm-card severity-${severity}`}>
      <div className="llm-card-header">
        <span className="severity-dot" aria-hidden />
        <div>
          <div className="llm-card-title-row">
            <h4>{item.title}</h4>
            <span className="llm-card-badge">{severityLabel[severity]}</span>
          </div>
          <p>{item.description}</p>
        </div>
      </div>
      {item.detail ? (
        <button
          type="button"
          className="llm-card-toggle"
          onClick={onToggle}
        >
          {expanded ? '접기' : '자세히 보기'}
        </button>
      ) : null}
      {expanded && item.detail ? (
        <div className="llm-card-detail">{item.detail}</div>
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
    <li className="glossary-item">
      <button
        type="button"
        onClick={onToggle}
        className="glossary-trigger"
      >
        <span>{item.term}</span>
        <span aria-hidden>{expanded ? '﹀' : '﹂'}</span>
      </button>
      {expanded ? (
        <div className="glossary-body">{item.description}</div>
      ) : null}
    </li>
  );
}
