import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  executeRun,
  getRun,
  listRuns,
  listRunsForPrompt,
} from "@/services/runService";
import { useToast } from "@/components/ui/Toast";
import type { RunRequest } from "@/types/prompt";

export function useRunList(params?: { prompt_id?: string; limit?: number }) {
  return useQuery({
    queryKey: ["runs", params],
    queryFn: () => listRuns(params),
  });
}

export function useRun(runId: string | undefined) {
  return useQuery({
    queryKey: ["run", runId],
    queryFn: () => getRun(runId!),
    enabled: !!runId,
  });
}

export function usePromptRuns(promptId: string | undefined) {
  return useQuery({
    queryKey: ["prompt-runs", promptId],
    queryFn: () => listRunsForPrompt(promptId!),
    enabled: !!promptId,
  });
}

export function useExecuteRun() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: (data: RunRequest) => executeRun(data),
    onSuccess: (run) => {
      showSuccess(`Run completed in ${Math.round(run.latency_ms)}ms`);
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      queryClient.invalidateQueries({
        queryKey: ["prompt-runs", run.prompt_id],
      });
    },
    onError: (error: any) => {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail ?? error?.message;
      if (status === 503) {
        showError(
          "Ollama is not running. Start it with: docker start ollama"
        );
      } else if (status === 422) {
        showError(detail ?? "A required variable is missing.");
      } else {
        showError(detail ?? "Run failed. Check the error details.");
      }
    },
  });
}

import { startStabilityTest, getStabilityResult } from "@/services/runService";

export function useStabilityTest() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [jobId, setJobId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Poll for results
  const pollQuery = useQuery({
    queryKey: ["stability-job", jobId],
    queryFn: () => getStabilityResult(jobId!),
    enabled: !!jobId && isPolling,
    refetchInterval: 5000,  // poll every 5 seconds
  });

  // Stop polling when done
  if (
    isPolling &&
    pollQuery.data &&
    ["completed", "failed"].includes(pollQuery.data.status)
  ) {
    setIsPolling(false);
    if (pollQuery.data.status === "completed") {
      showSuccess(
        `Stability test complete — index: ${pollQuery.data.result?.stability_index}/100`
      );
      queryClient.invalidateQueries({ queryKey: ["prompt-runs"] });
    } else {
      showError(pollQuery.data.error ?? "Stability test failed");
    }
  }

  const start = useMutation({
    mutationFn: ({
      promptId,
      params,
    }: {
      promptId: string;
      params: {
        version_number: number;
        variables?: Record<string, string>;
        n?: number;
      };
    }) => startStabilityTest(promptId, params),
    onSuccess: (data) => {
      setJobId(data.job_id);
      setIsPolling(true);
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail ?? error?.message;
      showError(detail ?? "Failed to start stability test");
    },
  });

  return {
    mutate: start.mutate,
    isPending: start.isPending || isPolling,
    progress: pollQuery.data?.progress,
    total: pollQuery.data?.n,
    result: pollQuery.data?.status === "completed" ? pollQuery.data.result : null,
  };
}