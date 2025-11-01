import type { SttQaPair } from '../realtime/stt.types';

interface QaSummaryPanelProps {
  pairs: SttQaPair[];
  visible: boolean;
}

export function QaSummaryPanel({
  pairs,
  visible,
}: QaSummaryPanelProps) {
  if (!visible || pairs.length === 0) {
    return null;
  }

  return (
    <div className="panel qa-panel">
      <h3>질문 · 답변 요약</h3>
      <div className="qa-list">
        {pairs.map((pair) => (
          <div
            key={`${pair.q_text}-${pair.a_time}`}
            className="qa-item"
          >
            <div className="qa-question">
              <span className="qa-label">Q.</span>
              <span className="qa-text">{pair.q_text}</span>
              <span className="qa-meta">
                화자 {pair.q_speaker ?? '?'} · {pair.q_time.toFixed(1)}s
              </span>
            </div>
            <div className="qa-answer">
              <span className="qa-label">A.</span>
              <span className="qa-text">{pair.a_text}</span>
              <span className="qa-meta">
                화자 {pair.a_speaker ?? '?'} · {pair.a_time.toFixed(1)}s · 신뢰도 {Math.round(pair.confidence * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
