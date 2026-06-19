import api from "@/config/api";

export interface HealthStatus {
  status: "ok" | "error";
  version?: string;
  environment?: string;
  detail?: string;
}

export interface OllamaHealthStatus {
  status: "ok" | "error";
  models?: string[];
  detail?: string;
}

export async function getApiHealth(): Promise<HealthStatus> {
  const res = await api.get<HealthStatus>("/health");
  return res.data;
}

export async function getFirestoreHealth(): Promise<HealthStatus> {
  const res = await api.get<HealthStatus>("/health/firestore");
  return res.data;
}

export async function getOllamaHealth(): Promise<OllamaHealthStatus> {
  const res = await api.get<OllamaHealthStatus>("/health/ollama");
  return res.data;
}

export async function getModelInfo(): Promise<{ model: string; provider: string }> {
  const res = await getOllamaHealth();
  return {
    model: res.models?.[0] ?? "unknown",
    provider: "Ollama",
  };
}