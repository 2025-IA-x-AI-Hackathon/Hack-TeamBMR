import { api, ApiResponse } from './http';
import { LlmReport } from '../types/domain';

export async function triggerLlmReport(reportId: string): Promise<void> {
  await api(`/v1/llm/reports/${encodeURIComponent(reportId)}`, {
    method: 'POST',
  });
}

export async function fetchLlmReport(reportId: string): Promise<ApiResponse<LlmReport>> {
  return api<LlmReport>(`/v1/llm/reports/${encodeURIComponent(reportId)}`);
}
