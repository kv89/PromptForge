import api from "@/config/api";
import type { EvalResult, Rubric, RubricCreate } from "@/types/prompt";

export async function getRunEval(runId: string): Promise<EvalResult> {
  const res = await api.get<EvalResult>(`/runs/${runId}/eval`);
  return res.data;
}

export async function manuallyEvaluateRun(
  runId: string,
  rubricId?: string,
  passThreshold: number = 75.0
): Promise<EvalResult> {
  const res = await api.post<EvalResult>(`/runs/${runId}/eval`, {
    run_id: runId,
    rubric_id: rubricId ?? null,
    pass_threshold: passThreshold,
  });
  return res.data;
}

export async function listEvalsForPrompt(
  promptId: string
): Promise<EvalResult[]> {
  const res = await api.get<EvalResult[]>(`/prompts/${promptId}/evals`);
  return res.data;
}

export async function listRubrics(
  useCaseId?: string
): Promise<Rubric[]> {
  const res = await api.get<Rubric[]>("/rubrics", {
    params: useCaseId ? { use_case_id: useCaseId } : undefined,
  });
  return res.data;
}

export async function createRubric(data: RubricCreate): Promise<Rubric> {
  const res = await api.post<Rubric>("/rubrics", data);
  return res.data;
}