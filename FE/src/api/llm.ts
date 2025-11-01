import { api } from './http';

export async function triggerLlmReport(reportId: string): Promise<void> {
  await api(`/v1/llm/reports/${encodeURIComponent(reportId)}`, {
    method: 'POST',
  });
}

export function fetchLlmReport(reportId: string): Promise<Response> {
  return api(`/v1/llm/reports/${encodeURIComponent(reportId)}`);
}
