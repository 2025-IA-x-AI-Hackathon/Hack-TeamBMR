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

  const response = await api(`/v1/checklists?${params.toString()}`);
  const data = await response.json() as ChecklistTemplatesResponse;
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
