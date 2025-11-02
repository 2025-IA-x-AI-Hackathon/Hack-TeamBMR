import { api } from './http';
import type { LlmReport, LlmReportItem, LlmReportGlossaryItem, LlmReportSeverity } from '../types/domain';

function normalizeSeverity(value?: string): LlmReportSeverity {
  if (value === 'high' || value === 'medium' || value === 'low' || value === 'info') {
    return value;
  }
  return 'info';
}

function normalizeItem(raw: any): LlmReportItem {
  return {
    id: raw?.id ?? undefined,
    title: raw?.title ?? '',
    description: raw?.description ?? raw?.summary ?? undefined,
    detail: raw?.detail ?? raw?.content ?? undefined,
    severity: normalizeSeverity(raw?.severity),
  };
}

function normalizeGlossaryItem(raw: any): LlmReportGlossaryItem {
  return {
    id: raw?.id ?? undefined,
    term: raw?.term ?? raw?.title ?? '',
    description: raw?.description ?? raw?.detail ?? '',
  };
}

export function normalizeLlmReport(raw: any): LlmReport {
  return {
    roomId: raw?.roomId ?? raw?.room_id ?? raw?.reportId ?? raw?.report_id ?? '',
    reportId: raw?.reportId ?? raw?.report_id ?? undefined,
    userId: raw?.userId ?? raw?.user_id ?? undefined,
    status: raw?.status ?? 'done',
    summary: raw?.summary ?? undefined,
    highlights: raw?.highlights ?? raw?.key_points ?? [],
    recommendations: raw?.recommendations ?? raw?.next_steps ?? [],
    createdAt: raw?.createdAt ?? raw?.created_at ?? new Date().toISOString(),
    cautions: Array.isArray(raw?.cautions) ? raw.cautions.map(normalizeItem) : [],
    positives: Array.isArray(raw?.positives) ? raw.positives.map(normalizeItem) : [],
    glossary: Array.isArray(raw?.glossary) ? raw.glossary.map(normalizeGlossaryItem) : [],
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
