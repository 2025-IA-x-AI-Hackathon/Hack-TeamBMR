import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './AddRoomScreen.css';

export type RoomDraft = {
  address: string;
  type: string;
  floor: number;
  deposit: number;
  rentMonthly: number;
  feeIncluded: boolean;
  feeMgmt?: number;
  photoFile: File | null;
};

type RoomFormState = {
  address: string;
  type: string;
  floor: string;
  deposit: string;
  rentMonthly: string;
  feeIncluded: boolean;
  feeMgmt: string;
};

const ROOM_TYPES = ['원룸', '투룸', '오피스텔'] as const;

export function AddRoomScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialDraft = (location.state as { draft?: RoomDraft } | null | undefined)?.draft;
  const [form, setForm] = useState<RoomFormState>({
    address: '',
    type: ROOM_TYPES[0],
    floor: '',
    deposit: '',
    rentMonthly: '',
    feeIncluded: false,
    feeMgmt: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialDraft) {
      return;
    }
    setForm({
      address: initialDraft.address,
      type: initialDraft.type,
      floor: String(initialDraft.floor ?? ''),
      deposit: String(initialDraft.deposit ?? ''),
      rentMonthly: String(initialDraft.rentMonthly ?? ''),
      feeIncluded: initialDraft.feeIncluded,
      feeMgmt: initialDraft.feeMgmt !== undefined ? String(initialDraft.feeMgmt) : '',
    });
    setPhotoFile(initialDraft.photoFile ?? null);
  }, [initialDraft]);

  const feeMgmtLabel = useMemo(
    () => (form.feeIncluded ? '관리비(포함)' : '관리비(만원)'),
    [form.feeIncluded],
  );

  const handleInputChange = useCallback(<K extends keyof RoomFormState>(
    key: K,
    value: RoomFormState[K],
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setPhotoFile(file);
  }, []);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const floorValue = Number(form.floor);
    const depositValue = Number(form.deposit);
    const rentValue = Number(form.rentMonthly);
    const rawFeeMgmtValue = form.feeMgmt ? Number(form.feeMgmt) : undefined;
    const feeMgmtValue = form.feeIncluded ? undefined : rawFeeMgmtValue;

    if ([floorValue, depositValue, rentValue].some(Number.isNaN)) {
      setError('층수, 보증금, 월세는 숫자로 입력해주세요.');
      return;
    }

    if (rawFeeMgmtValue !== undefined && Number.isNaN(rawFeeMgmtValue)) {
      setError('관리비는 숫자로 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const draft: RoomDraft = {
        address: form.address.trim(),
        type: form.type,
        floor: floorValue,
        deposit: depositValue,
        rentMonthly: rentValue,
        feeIncluded: form.feeIncluded,
        feeMgmt: feeMgmtValue,
        photoFile,
      };
      navigate('/checklist', { state: { draft } });
    } finally {
      setSubmitting(false);
    }
  }, [form, navigate, photoFile]);

  return (
    <div className="add-room-root">
      <div className="add-room-device">
        <div className="add-room-status-bar">
          <div className="add-room-time">9:41</div>
          <div className="add-room-levels">
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

        <header className="add-room-header">
          <button
            type="button"
            className="add-room-back-button"
            onClick={() => navigate('/home')}
            aria-label="이전으로"
          />
          <h1>정보 입력</h1>
        </header>

        <form
          className="add-room-form"
          onSubmit={handleSubmit}
        >
          <section className="add-room-section">
            <h2>방의 정보를 알려주세요</h2>

            <label className="field">
              <span className="field-label">주소</span>
              <input
                type="text"
                value={form.address}
                onChange={(event) => handleInputChange('address', event.target.value)}
                placeholder="예) 서울시 강남구 역삼동 123-45"
                required
              />
            </label>

            <div className="field">
              <span className="field-label">방 타입</span>
              <div className="room-type-group">
                {ROOM_TYPES.map((type) => {
                  const selected = form.type === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`room-type-option${selected ? ' selected' : ''}`}
                      onClick={() => handleInputChange('type', type)}
                    >
                      <span className="room-type-checkbox" aria-hidden>
                        {selected ? '■' : '□'}
                      </span>
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="field">
              <span className="field-label">층수</span>
              <input
                type="number"
                inputMode="numeric"
                value={form.floor}
                onChange={(event) => handleInputChange('floor', event.target.value)}
                placeholder="예) 3"
                min="0"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">보증금(만원)</span>
              <input
                type="number"
                inputMode="numeric"
                value={form.deposit}
                onChange={(event) => handleInputChange('deposit', event.target.value)}
                placeholder="예) 1000"
                min="0"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">월세(만원)</span>
              <input
                type="number"
                inputMode="numeric"
                value={form.rentMonthly}
                onChange={(event) => handleInputChange('rentMonthly', event.target.value)}
                placeholder="예) 50"
                min="0"
                required
              />
            </label>

            <div className="field fee-options">
              <label className="fee-toggle">
                <input
                  type="checkbox"
                  checked={form.feeIncluded}
                  onChange={(event) => handleInputChange('feeIncluded', event.target.checked)}
                />
                관리비 포함
              </label>
              <label className="fee-field">
                <span className="field-label">{feeMgmtLabel}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.feeMgmt}
                  onChange={(event) => handleInputChange('feeMgmt', event.target.value)}
                  placeholder="예) 5"
                  min="0"
                  disabled={form.feeIncluded}
                />
              </label>
            </div>

            <div className="field">
              <span className="field-label">방 사진</span>
              <label className="photo-upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />
                <div className="photo-upload-content">
                  <div className="photo-icon" aria-hidden />
                  <span>{photoFile ? photoFile.name : '사진 촬영/업로드'}</span>
                </div>
              </label>
              {photoFile ? (
                <p className="photo-hint">선택한 파일: {photoFile.name}</p>
              ) : (
                <p className="photo-hint">최대 10MB, JPG/PNG 권장</p>
              )}
            </div>
          </section>

          {error ? <div className="form-error">{error}</div> : null}

          <button
            type="submit"
            className="add-room-submit"
            disabled={submitting}
          >
            {submitting ? '다음으로 이동...' : '다음'}
          </button>
        </form>

        <div className="add-room-home-indicator">
          <span className="home-bar" />
        </div>
      </div>
    </div>
  );
}
