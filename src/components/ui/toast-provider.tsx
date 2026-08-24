"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  message: string;
  tone: "default" | "error";
}

const ToastContext = createContext<((message: string, tone?: Toast["tone"]) => void) | null>(null);

let idCounter = 0;

/** Toast discreto para feedback de sucesso/erro (seção "Optimistic UI" do briefing). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, tone: Toast["tone"] = "default") => {
    idCounter += 1;
    const id = idCounter;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "animate-fade-in-up pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur",
              t.tone === "error"
                ? "border-red-500/30 bg-red-950/90 text-red-200"
                : "border-base-700 bg-base-850/95 text-base-100"
            )}
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
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}
