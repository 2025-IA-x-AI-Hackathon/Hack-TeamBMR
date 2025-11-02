import { api } from './http';
import type { LlmReport, LlmReportGlossaryItem, LlmReportPoint, LlmReportSeverity } from '../types/domain';

function normalizeSeverity(value?: string): LlmReportSeverity {
  if (value === 'high' || value === 'medium' || value === 'low' || value === 'info') {
    return value;
  }
  return 'info';
}

const colorToSeverity: Record<string, LlmReportSeverity> = {
  red: 'high',
  yellow: 'medium',
  green: 'info',
};

function normalizeGlossaryItem(raw: any): LlmReportGlossaryItem {
  return {
    id: raw?.id ?? undefined,
    term: raw?.term ?? raw?.title ?? '',
    description: raw?.description ?? raw?.detail ?? raw?.definition ?? '',
  };
}

function normalizePoint(raw: any, kind: 'caution' | 'good'): LlmReportPoint | null {
  const title = raw?.title ?? '';
  const detail = raw?.detail ?? raw?.description ?? '';
  if (!title && !detail) {
    return null;
  }
  const color = typeof raw?.color === 'string' ? raw.color.toLowerCase() : '';
  const mappedSeverity = colorToSeverity[color] ?? (kind === 'caution' ? 'medium' : 'info');
  return {
    title,
    detail,
    severity: normalizeSeverity(mappedSeverity),
    kind,
  };
}

export function normalizeLlmReport(raw: any): LlmReport {
  const detail = raw?.detail ?? {};

  const cautionPoints = Array.isArray(detail?.caution_points)
    ? detail.caution_points
        .map((point: any) => normalizePoint(point, 'caution'))
        .filter((point: LlmReportPoint | null): point is LlmReportPoint => Boolean(point))
    : [];

  const goodPoints = Array.isArray(detail?.good_points)
    ? detail.good_points
        .map((point: any) => normalizePoint(point, 'good'))
        .filter((point: LlmReportPoint | null): point is LlmReportPoint => Boolean(point))
    : [];

  const glossaryItems = Array.isArray(detail?.glossary)
    ? detail.glossary.map(normalizeGlossaryItem)
    : Array.isArray(raw?.glossary)
      ? raw.glossary.map(normalizeGlossaryItem)
      : [];

  return {
    roomId: raw?.roomId ?? raw?.room_id ?? raw?.reportId ?? raw?.report_id ?? '',
    reportId: raw?.reportId ?? raw?.report_id ?? undefined,
    userId: raw?.userId ?? raw?.user_id ?? undefined,
    status: raw?.status ?? 'done',
    summary: detail?.summary ?? raw?.summary ?? undefined,
    cautionPoints,
    goodPoints,
    createdAt: raw?.createdAt ?? raw?.created_at ?? new Date().toISOString(),
    glossary: glossaryItems,
  };
}

export async function triggerLlmReport(roomId: string): Promise<void> {
  await api(`/v1/llm/reports/${encodeURIComponent(roomId)}`, {
    method: 'POST',
  });
}

export function fetchLlmReport(roomId: string): Promise<Response> {
  return api(`/v1/llm/reports/${encodeURIComponent(roomId)}`);
}
