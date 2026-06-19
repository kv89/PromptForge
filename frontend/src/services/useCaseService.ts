import { api } from "@/config/api";
import type { UseCaseCreate, UseCaseResponse } from "@/types/prompt";

export async function listUseCases(): Promise<UseCaseResponse[]> {
  const { data } = await api.get<UseCaseResponse[]>("/use-cases");
  return data;
}

export async function createUseCase(
  payload: UseCaseCreate,
): Promise<UseCaseResponse> {
  const { data } = await api.post<UseCaseResponse>("/use-cases", payload);
  return data;
}
