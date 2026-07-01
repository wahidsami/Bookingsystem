"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

type ToastTone = "info" | "success" | "warning" | "danger";

type ToastInput = {
  title?: string;
  message: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: string;
  createdAt: number;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function toneStyles(tone: ToastTone) {
  switch (tone) {
    case "success":
      return {
        icon: <CheckCircleIcon className="h-5 w-5 text-emerald-300" />,
        ring: "border-emerald-400/20 bg-emerald-500/10",
      };
    case "warning":
      return {
        icon: <ExclamationTriangleIcon className="h-5 w-5 text-amber-300" />,
        ring: "border-amber-400/20 bg-amber-500/10",
      };
    case "danger":
      return {
        icon: <ExclamationTriangleIcon className="h-5 w-5 text-rose-300" />,
        ring: "border-rose-400/20 bg-rose-500/10",
      };
    case "info":
    default:
      return {
        icon: <InformationCircleIcon className="h-5 w-5 text-sky-300" />,
        ring: "border-sky-400/20 bg-sky-500/10",
      };
  }
}

export function AppToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: ToastInput) => {
    const id = Math.random().toString(36).slice(2, 10);
    const nextToast: ToastItem = {
      id,
      createdAt: Date.now(),
      tone: toast.tone || "info",
      title: toast.title,
      message: toast.message,
      durationMs: toast.durationMs ?? 4500,
    };

    setToasts((current) => [nextToast, ...current].slice(0, 4));

    if ((nextToast.durationMs ?? 0) > 0) {
      window.setTimeout(() => {
        dismissToast(id);
      }, nextToast.durationMs);
    }

    return id;
  }, [dismissToast]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<ToastInput>;
      if (!custom.detail?.message) return;
      showToast(custom.detail);
    };

    window.addEventListener("refah:toast", handler);
    return () => window.removeEventListener("refah:toast", handler);
  }, [showToast]);

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed bottom-5 end-5 z-[13000] flex w-full max-w-sm flex-col gap-3 px-4 sm:px-0" dir="ltr">
        {toasts.map((toast) => {
          const tone = toneStyles(toast.tone || "info");

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto overflow-hidden rounded-[1.5rem] border text-white shadow-[0_22px_65px_rgba(15,23,42,0.42)] backdrop-blur-xl ${tone.ring}`}
            >
              <div className="flex items-start gap-3 bg-slate-950/95 px-4 py-4">
                <div className="mt-0.5 rounded-2xl bg-white/5 p-2">
                  {tone.icon}
                </div>
                <div className="min-w-0 flex-1">
                  {toast.title ? <p className="text-sm font-semibold text-white">{toast.title}</p> : null}
                  <p className={`text-sm leading-6 ${toast.title ? "mt-1 text-slate-300" : "text-slate-200"}`}>{toast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-full border border-white/10 bg-white/5 p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                  aria-label="Dismiss toast"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useAppToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useAppToast must be used within an AppToastProvider");
  }
  return context;
}
