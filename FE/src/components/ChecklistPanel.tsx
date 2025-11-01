import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  fetchChecklistTemplates,
  saveChecklistChecks,
} from '../api/checklists';
import type { ChecklistTemplate } from '../types/domain';

interface ItemState {
  checked: boolean;
  memo: string;
}

export function ChecklistPanel() {
  const [locale] = useState('ko-KR');
  const [category, setCategory] = useState('lease');
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChecklistTemplates({ locale, category });
      setTemplates(data);
      const defaults: Record<string, ItemState> = {};
      data.forEach((template) => {
        template.items.forEach((item) => {
          defaults[item.id] = { checked: false, memo: '' };
        });
      });
      setItemStates(defaults);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '체크리스트를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [category, locale]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2_500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleToggle = useCallback((itemId: string) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        checked: !prev[itemId]?.checked,
        memo: prev[itemId]?.memo ?? '',
      },
    }));
  }, []);

  const handleMemoChange = useCallback((itemId: string, memo: string) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        checked: prev[itemId]?.checked ?? false,
        memo,
      },
    }));
  }, []);

  const handleSave = useCallback(async (event: FormEvent<HTMLFormElement>, template: ChecklistTemplate) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await saveChecklistChecks(template.id, {
        checks: template.items.map((item) => ({
          itemId: item.id,
          checked: itemStates[item.id]?.checked ?? false,
          memo: itemStates[item.id]?.memo || undefined,
        })),
      });
      setToast('체크리스트가 저장되었습니다.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '체크리스트 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }, [itemStates]);

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    templates.forEach((template) => categories.add(template.category));
    if (!categories.size) {
      categories.add(category);
    }
    return Array.from(categories);
  }, [category, templates]);

  return (
    <div className="panel">
      <h2>체크리스트</h2>

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="checklist-locale">Locale</label>
          <input
            id="checklist-locale"
            value={locale}
            disabled
          />
        </div>
        <div className="field-group">
          <label htmlFor="checklist-category">카테고리</label>
          <select
            id="checklist-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categoryOptions.map((option) => (
              <option
                key={option}
                value={option}
              >
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group align-end">
          <button
            type="button"
            onClick={loadTemplates}
            disabled={loading}
          >
            {loading ? '갱신 중...' : '불러오기'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="error-text">{error}</div>
      ) : null}

      {toast ? (
        <div className="toast">{toast}</div>
      ) : null}

      {loading ? (
        <div className="spinner">불러오는 중...</div>
      ) : null}

      {templates.map((template) => (
        <form
          key={template.id}
          className="checklist"
          onSubmit={(event) => handleSave(event, template)}
        >
          <h3>{template.title}</h3>
          <ul>
            {template.items.map((item) => (
              <li key={item.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={itemStates[item.id]?.checked ?? false}
                    onChange={() => handleToggle(item.id)}
                  />
                  <span>{item.label}</span>
                  {item.required ? <span className="badge">필수</span> : null}
                </label>
                <textarea
                  value={itemStates[item.id]?.memo ?? ''}
                  placeholder="메모"
                  rows={2}
                  onChange={(event) => handleMemoChange(item.id, event.target.value)}
                />
              </li>
            ))}
          </ul>
          <button
            type="submit"
            className="primary"
            disabled={saving}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </form>
      ))}

      {!templates.length && !loading ? (
        <p>표시할 체크리스트 템플릿이 없습니다.</p>
      ) : null}
    </div>
  );
}
