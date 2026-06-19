import { create } from "zustand";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (type: ToastType, message: string) => void;
  dismiss: (id: number) => void;
}

const AUTO_DISMISS_MS = 4000;
let counter = 0;

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (type, message) => {
    const id = ++counter;
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, AUTO_DISMISS_MS);
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** React hook exposing toast actions for use inside components/hooks. */
export function useToast() {
  const push = useToastStore((s) => s.push);
  return {
    showSuccess: (message: string) => push("success", message),
    showError: (message: string) => push("error", message),
    showInfo: (message: string) => push("info", message),
  };
}

/** Imperative API for use outside React (e.g. the axios interceptor). */
export const toast = {
  success: (message: string) => useToastStore.getState().push("success", message),
  error: (message: string) => useToastStore.getState().push("error", message),
  info: (message: string) => useToastStore.getState().push("info", message),
};

const TYPE_STYLES: Record<ToastType, string> = {
  success: "bg-green-600",
  error: "bg-red-600",
  info: "bg-brand-500",
};

/** Renders active toasts; mount once near the app root. */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto max-w-sm rounded-md px-4 py-2 text-left text-sm font-medium text-white shadow-lg ${TYPE_STYLES[t.type]}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
