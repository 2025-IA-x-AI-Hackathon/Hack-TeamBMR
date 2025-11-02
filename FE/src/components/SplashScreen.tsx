import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './SplashScreen.css';
import { fetchAuthToken } from '../api/auth';

export function SplashScreen() {
  const navigate = useNavigate();

  const handleStart = useCallback(async () => {
    if (typeof window !== 'undefined') {
      const token = window.localStorage.getItem('token');
      if (!token) {
        await fetchAuthToken();
      }
    }
    navigate('/home', { replace: true });
  }, [navigate]);

  return (
    <div className="splash-root">
      <div className="splash-device">
        <div className="splash-status-bar">
          <div className="splash-time">9:41</div>
          <div className="splash-levels">
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

        <div className="splash-body">
          <h2 className="splash-title">
            처음이라 불안한 부동산 계약,
            <br />
            이제 부메랑이 같이 가드릴게요
          </h2>

          <div className="splash-illustration">
            <img
              src="/boomerang.svg"
              alt="부메랑 로고"
              width={200}
              height={200}
              loading="lazy"
            />
          </div>

          <div className="splash-subtitle">
            <p>당신의 AI 부동산 메이트,</p>
            <strong>부메랑</strong>
          </div>
        </div>

        <div className="splash-cta">
          <button
            type="button"
            className="splash-start-button"
            onClick={handleStart}
          >
            시작하기
          </button>
        </div>

        <div className="splash-home-indicator">
          <span className="home-bar" />
        </div>
      </div>
    </div>
  );
}
