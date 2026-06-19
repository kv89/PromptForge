import type { ReactNode } from "react";

import { useAuth } from "@/hooks/useAuth";

/**
 * Mounts the Firebase auth subscription once for the whole app so the global
 * auth store stays in sync with the active session.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  useAuth();
  return <>{children}</>;
}
