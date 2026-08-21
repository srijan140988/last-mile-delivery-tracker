import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  variant: "success" | "error" | "info";
}

interface ToastContextValue {
  push: (message: string, variant?: Toast["variant"]) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, variant: Toast["variant"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg border animate-in fade-in slide-in-from-bottom-2 ${
              t.variant === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : t.variant === "error"
                ? "bg-red-50 text-red-800 border-red-200"
                : "bg-white text-slate-800 border-slate-200"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
