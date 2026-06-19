import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useToast } from "@/components/ui/Toast";
import {
  addVersion,
  archivePrompt,
  createPrompt,
  getPrompt,
  getVersions,
  listPrompts,
  promoteVersion,
  type PromptFilters,
} from "@/services/promptService";
import { createUseCase, listUseCases } from "@/services/useCaseService";
import type { PromptUpdate } from "@/types/prompt";

/* ------------------------------------------------------------------ */
/* Use cases                                                           */
/* ------------------------------------------------------------------ */

export function useUseCaseList() {
  return useQuery({
    queryKey: ["use-cases"],
    queryFn: listUseCases,
  });
}

export function useCreateUseCase() {
  const queryClient = useQueryClient();
  const { showSuccess } = useToast();
  return useMutation({
    mutationFn: createUseCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["use-cases"] });
      showSuccess("Use case created");
    },
  });
}

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

export function usePromptList(filters?: PromptFilters) {
  return useQuery({
    queryKey: ["prompts", filters],
    queryFn: () => listPrompts(filters),
  });
}

export function usePrompt(promptId?: string) {
  return useQuery({
    queryKey: ["prompt", promptId],
    queryFn: () => getPrompt(promptId as string),
    enabled: Boolean(promptId),
  });
}

export function usePromptVersions(promptId?: string) {
  return useQuery({
    queryKey: ["prompt-versions", promptId],
    queryFn: () => getVersions(promptId as string),
    enabled: Boolean(promptId),
  });
}

export function useCreatePrompt() {
  const queryClient = useQueryClient();
  const { showSuccess } = useToast();
  return useMutation({
    mutationFn: createPrompt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      showSuccess("Prompt created");
    },
  });
}

export function useAddVersion(promptId: string) {
  const queryClient = useQueryClient();
  const { showError } = useToast();

  return useMutation({
    mutationFn: (data: PromptUpdate) => addVersion(promptId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompt", promptId] });
      queryClient.invalidateQueries({ queryKey: ["prompt-versions", promptId] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail ?? error?.message;
      showError(detail ?? "Failed to save version.");
    },
  });
}

export function usePromoteVersion(promptId: string) {
  const queryClient = useQueryClient();
  const { showSuccess } = useToast();
  return useMutation({
    mutationFn: (versionNumber: number) =>
      promoteVersion(promptId, versionNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompt", promptId] });
      showSuccess("Version promoted to stable");
    },
  });
}

export function useArchivePrompt() {
  const queryClient = useQueryClient();
  const { showSuccess } = useToast();
  return useMutation({
    mutationFn: archivePrompt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      showSuccess("Prompt archived");
    },
  });
}


import { improvePrompt } from "@/services/promptService";
import type { ImprovePromptRequest } from "@/types/prompt";

export function useImprovePrompt() {
  const { showError } = useToast();

  return useMutation({
    mutationFn: ({
      promptId,
      data,
    }: {
      promptId: string;
      data: ImprovePromptRequest;
    }) => improvePrompt(promptId, data),
    onError: (error: any) => {
      const detail = error?.response?.data?.detail ?? error?.message;
      showError(detail ?? "Failed to generate improved prompt.");
    },
  });
}
