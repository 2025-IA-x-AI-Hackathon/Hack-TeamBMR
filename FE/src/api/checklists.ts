import { api } from './http';
import {
  ChecklistTemplate,
  ChecklistTemplatesResponse,
  SaveChecklistPayload,
} from '../types/domain';

export interface ChecklistQueryParams {
  locale: string;
  category: string;
}

export async function fetchChecklistTemplates(
  { locale, category }: ChecklistQueryParams,
): Promise<ChecklistTemplate[]> {
  const params = new URLSearchParams({
    locale,
    category,
  });

  const { data } = await api<ChecklistTemplatesResponse>(`/v1/checklists?${params.toString()}`);
  return data.templates;
}

export async function saveChecklistChecks(
  checklistId: string,
  payload: SaveChecklistPayload,
): Promise<void> {
  await api(`/v1/checklists/${encodeURIComponent(checklistId)}/checks`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
