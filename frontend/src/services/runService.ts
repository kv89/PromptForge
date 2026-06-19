import api from "@/config/api";
import type { Run, RunRequest, RunSummary, StabilityResult } from "@/types/prompt";

export async function executeRun(data: RunRequest): Promise<Run> {
  const res = await api.post<Run>("/runs", data);
  return res.data;
}

export async function listRuns(params?: {
  prompt_id?: string;
  limit?: number;
}): Promise<RunSummary[]> {
  const res = await api.get<RunSummary[]>("/runs", { params });
  return res.data;
}

export async function getRun(runId: string): Promise<Run> {
  const res = await api.get<Run>(`/runs/${runId}`);
  return res.data;
}

export async function listRunsForPrompt(
  promptId: string
): Promise<RunSummary[]> {
  const res = await api.get<RunSummary[]>(`/prompts/${promptId}/runs`);
  return res.data;
}

export async function startStabilityTest(
  promptId: string,
  params: {
    version_number: number;
    variables?: Record<string, string>;
    n?: number;
    temperature?: number;
    max_tokens?: number;
  }
): Promise<{ job_id: string; status: string }> {
  const { variables, ...queryParams } = params;
  const res = await api.post<{ job_id: string; status: string }>(
    `/prompts/${promptId}/stability/start`,
    variables ?? {},
    { params: queryParams }
  );
  return res.data;
}

export async function getStabilityResult(jobId: string): Promise<{
  status: string;
  progress?: number;
  n?: number;
  result?: StabilityResult;
  error?: string;
}> {
  const res = await api.get(`/stability/${jobId}`);
  return res.data;
}