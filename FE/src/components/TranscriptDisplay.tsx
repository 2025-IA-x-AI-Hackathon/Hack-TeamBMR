import type { SttBubble } from '../types/domain';

interface TranscriptDisplayProps {
  bubbles: SttBubble[];
  partial?: string;
}

export function TranscriptDisplay({
  bubbles,
  partial,
}: TranscriptDisplayProps) {
  return (
    <div className="panel">
      <h3>전사 결과</h3>
      <div className="transcript">
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className="bubble"
          >
            <span className="bubble-speaker">
              화자 {bubble.speaker ?? '?'}
            </span>
            <span className="bubble-text">
              {bubble.text}
            </span>
          </div>
        ))}
        {partial ? (
          <div className="partial">
            <span className="partial-label">부분 인식</span>
            <span>{partial}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
