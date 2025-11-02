import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './RoomChecklistScreen.css';
import { fetchAuthToken } from '../api/auth';
import { createRoom, uploadRoomPhoto } from '../api/rooms';
import { fetchRoomChecklist } from '../api/checklists';
import type { ChecklistMapEntry, CreateRoomPayload } from '../types/domain';
import type { RoomDraft } from './AddRoomScreen';

type ChecklistItemView = {
  index: number;
  category: string;
  question: string;
  answerKey: string;
  checked: boolean;
};

function parseEntries(entries: ChecklistMapEntry[]): ChecklistItemView[] {
  return entries.map((entry, index) => {
    const questionKey = Object.keys(entry).find((key) => key.startsWith('q')) ?? `q${index + 1}`;
    const answerKey = Object.keys(entry).find((key) => key.startsWith('a')) ?? `a${index + 1}`;
    const labelRaw = String(entry[questionKey] ?? '');
    const [rawCategory, rawQuestion] = labelRaw.split(' - ');
    const category = (rawCategory ?? '').trim();
    const question = (rawQuestion ?? labelRaw).trim();
    const checked = Boolean(entry[answerKey]);
    return {
      index,
      category: category || '기타',
      question: question || labelRaw,
      answerKey,
      checked,
    };
  });
}

export function RoomChecklistScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const draft = (location.state as { draft?: RoomDraft } | null | undefined)?.draft;
  const [entries, setEntries] = useState<ChecklistMapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!draft) {
      navigate('/add-room', { replace: true });
    }
  }, [draft, navigate]);

  if (!draft) {
    return null;
  }

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchRoomChecklist();
        if (!cancelled) {
          setEntries(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : '체크리스트를 불러오지 못했습니다.';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const checklistViews = useMemo(() => parseEntries(entries), [entries]);

  const groupedChecklist = useMemo(() => {
    return checklistViews.reduce<Map<string, ChecklistItemView[]>>((acc, item) => {
      const list = acc.get(item.category) ?? [];
      list.push(item);
      acc.set(item.category, list);
      return acc;
    }, new Map());
  }, [checklistViews]);

  const ensureToken = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }
    const existing = window.localStorage.getItem('token');
    if (!existing) {
      await fetchAuthToken();
    }
  }, []);

  const toggleEntry = useCallback((item: ChecklistItemView) => {
    setEntries((prev) => prev.map((entry, index) => {
      if (index !== item.index) {
        return entry;
      }
      const current = entry[item.answerKey];
      return {
        ...entry,
        [item.answerKey]: !(current === true),
      };
    }));
  }, []);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await ensureToken();

      if (!draft) {
        navigate('/add-room', { replace: true });
        return;
      }

      const checklistItems = entries.map((entry, index) => {
        const questionKey = Object.keys(entry).find((key) => key.startsWith('q')) ?? `q${index + 1}`;
        const answerKey = Object.keys(entry).find((key) => key.startsWith('a')) ?? `a${index + 1}`;
        const answer = Boolean(entry[answerKey]);
        return {
          ...entry,
          [questionKey]: entry[questionKey],
          [answerKey]: answer,
        };
      });

      const payload: CreateRoomPayload = {
        address: draft.address,
        type: draft.type,
        floor: draft.floor,
        deposit: draft.deposit,
        rent_monthly: draft.rentMonthly,
        fee_included: draft.feeIncluded,
        fee_mgmt: draft.feeMgmt,
        checklist: {
          items: checklistItems,
        },
      };

      const createdRoom = await createRoom(payload);

      let finalRoom = createdRoom;
      if (draft.photoFile) {
        try {
          const uploadedPhoto = await uploadRoomPhoto(createdRoom.roomId, draft.photoFile);
          finalRoom = {
            ...createdRoom,
            photos: [
              ...createdRoom.photos,
              uploadedPhoto,
            ],
          };
        } catch (photoError) {
          console.error(photoError);
          if (typeof window !== 'undefined') {
            window.alert('방은 저장했지만 사진 업로드에 실패했습니다. 나중에 다시 시도해주세요.');
          }
        }
      }

      navigate('/success', { state: { roomId: finalRoom.roomId }, replace: true });
    } catch (submitError) {
      const message = submitError instanceof Error
        ? submitError.message
        : '체크리스트 저장 중 오류가 발생했습니다.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [draft, ensureToken, entries, navigate]);

  return (
    <div className="checklist-root">
      <div className="checklist-device">
        <div className="checklist-status-bar">
          <div className="checklist-time">9:41</div>
          <div className="checklist-levels">
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

        <header className="checklist-header">
          <button
            type="button"
            className="checklist-back-button"
            onClick={() => {
              if (draft) {
                navigate('/add-room', { state: { draft } });
              } else {
                navigate('/add-room');
              }
            }}
            aria-label="이전으로"
          />
          <h1>체크리스트 확인</h1>
        </header>

        <form
          className="checklist-form"
          onSubmit={handleSubmit}
        >
          <section className="checklist-intro">
            <h2>방을 보면서,<br />아래의 항목을 체크해주세요</h2>
          </section>

          {loading ? <div className="checklist-loading">체크리스트를 불러오는 중...</div> : null}
          {error ? <div className="checklist-error">{error}</div> : null}

          {!loading && !error ? (
            <div className="checklist-groups">
              {Array.from(groupedChecklist.entries()).map(([category, items]) => (
                <section
                  key={category}
                  className="checklist-group"
                >
                  <h3>{category}</h3>
                  <ul>
                    {items.map((item) => (
                      <li key={item.answerKey}>
                        <label className="checklist-item">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => toggleEntry(item)}
                          />
                          <span>{item.question}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : null}

          <button
            type="submit"
            className="checklist-submit"
            disabled={loading || submitting}
          >
            {submitting ? '저장 중...' : '완료'}
          </button>
        </form>

        <div className="checklist-home-indicator">
          <span className="home-bar" />
        </div>
      </div>
    </div>
  );
}
