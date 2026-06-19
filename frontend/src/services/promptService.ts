import { api } from "@/config/api";
import type {
  Prompt,
  PromptCreate,
  PromptUpdate,
  PromptVersion,
} from "@/types/prompt";

export interface PromptFilters {
  use_case?: string;
  status?: string;
}

export async function listPrompts(
  params: PromptFilters = {},
): Promise<Prompt[]> {
  const { data } = await api.get<Prompt[]>("/prompts", {
    // The backend filters by the denormalised `use_case_slug` field.
    params: {
      use_case_slug: params.use_case || undefined,
      status: params.status || undefined,
    },
  });
  return data;
}

export async function getPrompt(promptId: string): Promise<Prompt> {
  const { data } = await api.get<Prompt>(`/prompts/${promptId}`);
  return data;
}

export async function createPrompt(payload: PromptCreate): Promise<Prompt> {
  const { data } = await api.post<Prompt>("/prompts", payload);
  return data;
}

export async function addVersion(
  promptId: string,
  payload: PromptUpdate,
): Promise<Prompt> {
  const { data } = await api.post<Prompt>(
    `/prompts/${promptId}/versions`,
    payload,
  );
  return data;
}

export async function getVersions(promptId: string): Promise<PromptVersion[]> {
  const { data } = await api.get<PromptVersion[]>(
    `/prompts/${promptId}/versions`,
  );
  return data;
}

export async function promoteVersion(
  promptId: string,
  versionNumber: number,
): Promise<Prompt> {
  const { data } = await api.post<Prompt>(
    `/prompts/${promptId}/versions/${versionNumber}/promote`,
  );
  return data;
}

export async function archivePrompt(promptId: string): Promise<void> {
  await api.delete(`/prompts/${promptId}`);
}

import type { ImprovePromptRequest, ImprovePromptResponse } from "@/types/prompt";

export async function improvePrompt(
  promptId: string,
  data: ImprovePromptRequest
): Promise<ImprovePromptResponse> {
  const res = await api.post<ImprovePromptResponse>(
    `/prompts/${promptId}/improve`,
    data
  );
  return res.data;
}