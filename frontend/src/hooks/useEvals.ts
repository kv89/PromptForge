import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getRunEval,
  listEvalsForPrompt,
  listRubrics,
  manuallyEvaluateRun,
} from "@/services/evalService";
import { useToast } from "@/components/ui/Toast";

export function useRunEval(runId: string | undefined) {
  return useQuery({
    queryKey: ["run-eval", runId],
    queryFn: () => getRunEval(runId!),
    enabled: !!runId,
    retry: false,   // don't retry 404s (run may not have eval yet)
  });
}

export function usePromptEvals(promptId: string | undefined) {
  return useQuery({
    queryKey: ["prompt-evals", promptId],
    queryFn: () => listEvalsForPrompt(promptId!),
    enabled: !!promptId,
  });
}

export function useRubrics(useCaseId?: string) {
  return useQuery({
    queryKey: ["rubrics", useCaseId],
    queryFn: () => listRubrics(useCaseId),
  });
}

export function useManualEval() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: ({
      runId,
      rubricId,
      passThreshold,
    }: {
      runId: string;
      rubricId?: string;
      passThreshold?: number;
    }) => manuallyEvaluateRun(runId, rubricId, passThreshold),
    onSuccess: (result) => {
      showSuccess(
        `Evaluation complete — score: ${result.overall_score}/100 ` +
        `(${result.passed ? "✓ passed" : "✗ failed"})`
      );
      queryClient.invalidateQueries({ queryKey: ["run-eval", result.run_id] });
      queryClient.invalidateQueries({
        queryKey: ["prompt-evals", result.prompt_id],
      });
      queryClient.invalidateQueries({ queryKey: ["prompt-runs"] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail ?? error?.message;
      showError(detail ?? "Evaluation failed.");
    },
  });
}

import { createRubric } from "@/services/evalService";
import type { RubricCreate } from "@/types/prompt";

export function useCreateRubric() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: (data: RubricCreate) => createRubric(data),
    onSuccess: () => {
      showSuccess("Rubric created successfully");
      queryClient.invalidateQueries({ queryKey: ["rubrics"] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail ?? error?.message;
      showError(detail ?? "Failed to create rubric.");
    },
  });
}