import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './RoomCreationSuccessScreen.css';

export function RoomCreationSuccessScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const roomId = (location.state as { roomId?: string } | null | undefined)?.roomId ?? null;
  const hasRoomId = Boolean(roomId);

  useEffect(() => {
    if (!hasRoomId) {
      navigate('/home', { replace: true });
    }
  }, [hasRoomId, navigate]);

  const handleHome = useCallback(() => {
    navigate('/home', { replace: true });
  }, [navigate]);

  const handleMonitor = useCallback(() => {
    if (!roomId) {
      navigate('/home', { replace: true });
      return;
    }
    navigate(`/rooms/${roomId}/record`, { replace: true });
  }, [navigate, roomId]);

  return (
    <div className="success-root">
      <div className="success-device">
        <div className="success-status-bar">
          <div className="success-time">9:41</div>
          <div className="success-levels">
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

        <header className="success-header">
          <button
            type="button"
            className="success-back-button"
            onClick={handleHome}
            aria-label="이전으로"
          />
          <h1>체크리스트 확인</h1>
        </header>

        <main className="success-content">
          <h2>방 정보 저장 완료!</h2>
          <img
            src="/boomerang.svg"
            alt="부메랑 로고"
            width={180}
            height={180}
          />
        </main>

        <div className="success-actions">
          <button
            type="button"
            className="success-primary"
            onClick={handleMonitor}
          >
            계약 대화 모니터링
          </button>
          <button
            type="button"
            className="success-secondary"
            onClick={handleHome}
          >
            홈화면 바로가기
          </button>
        </div>

        <div className="success-home-indicator">
          <span className="home-bar" />
        </div>
      </div>
    </div>
  );
}
