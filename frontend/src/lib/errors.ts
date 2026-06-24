import { isAxiosError } from "axios";

interface ApiErrorEnvelope {
  error?: { code?: number; message?: string };
}

/**
 * Extract a human-readable message from an unknown error, preferring the
 * backend's `{ "error": { "code", "message" } }` envelope.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as ApiErrorEnvelope | undefined;
    if (data?.error?.message) {
      return data.error.message;
    }
    if (error.message) {
      return error.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
