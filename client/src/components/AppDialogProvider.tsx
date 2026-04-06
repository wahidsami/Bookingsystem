"use client";

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type DialogTone = "default" | "danger" | "success";
type DialogType = "alert" | "confirm" | "prompt";
type DialogResult = boolean | string | null;

interface DialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: DialogTone;
  defaultValue?: string;
  placeholder?: string;
}

interface DialogState extends DialogOptions {
  type: DialogType;
  value: string;
}

interface DialogContextValue {
  alert: (options: string | DialogOptions) => Promise<void>;
  confirm: (options: string | DialogOptions) => Promise<boolean>;
  prompt: (options: string | DialogOptions, defaultValue?: string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

function normalizeOptions(
  input: string | DialogOptions,
  type: DialogType,
  defaultValue = ""
): DialogState {
  const options = typeof input === "string" ? { message: input } : input;

  return {
    type,
    title:
      options.title ||
      (type === "confirm"
        ? "Confirm Action"
        : type === "prompt"
          ? "Provide Input"
          : options.tone === "success"
            ? "Success"
            : "Notice"),
    message: options.message,
    confirmText:
      options.confirmText ||
      (type === "confirm" ? "Confirm" : type === "prompt" ? "Continue" : "OK"),
    cancelText: options.cancelText || "Cancel",
    tone: options.tone || "default",
    defaultValue: options.defaultValue ?? defaultValue,
    placeholder: options.placeholder,
    value: options.defaultValue ?? defaultValue,
  };
}

function getDismissResult(dialog: DialogState) {
  if (dialog.type === "alert") return true;
  if (dialog.type === "prompt") return null;
  return false;
}

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const resolverRef = useRef<((value: DialogResult) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const closeDialog = useCallback((result: DialogResult) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  const alert = useCallback((options: string | DialogOptions) => {
    return new Promise<void>((resolve) => {
      resolverRef.current = () => {
        resolve();
      };
      setDialog(normalizeOptions(options, "alert"));
    });
  }, []);

  const confirm = useCallback((options: string | DialogOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = (value) => {
        resolve(Boolean(value));
      };
      setDialog(normalizeOptions(options, "confirm"));
    });
  }, []);

  const prompt = useCallback((options: string | DialogOptions, defaultValue = "") => {
    return new Promise<string | null>((resolve) => {
      resolverRef.current = (value) => {
        resolve(typeof value === "string" ? value : null);
      };
      setDialog(normalizeOptions(options, "prompt", defaultValue));
    });
  }, []);

  useEffect(() => {
    if (!dialog || dialog.type !== "prompt") return;

    const focusInput = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(focusInput);
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog(getDismissResult(dialog));
      }

      if (event.key === "Enter" && dialog.type === "prompt") {
        event.preventDefault();
        closeDialog(dialog.value);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeDialog, dialog]);

  useEffect(() => {
    const originalAlert = window.alert;

    window.alert = (message?: any) => {
      void alert({
        message: typeof message === "string" ? message : String(message ?? ""),
      });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, [alert]);

  const value = useMemo(() => ({ alert, confirm, prompt }), [alert, confirm, prompt]);

  const toneClasses =
    dialog?.tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : dialog?.tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-primary/20 bg-primary/5 text-primary";

  return (
    <DialogContext.Provider value={value}>
      {children}

      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl">
            <div className={`mb-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${toneClasses}`}>
              {dialog.type === "confirm" ? "Confirm" : dialog.type === "prompt" ? "Input" : "Message"}
            </div>
            <h3 className="text-xl font-bold text-gray-900">{dialog.title}</h3>
            <p className="mt-3 text-sm leading-6 text-gray-600">{dialog.message}</p>

            {dialog.type === "prompt" && (
              <input
                ref={inputRef}
                type="text"
                value={dialog.value}
                onChange={(event) =>
                  setDialog((current) =>
                    current ? { ...current, value: event.target.value } : current
                  )
                }
                placeholder={dialog.placeholder}
                className="mt-4 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            )}

            <div className="mt-6 flex justify-end gap-3">
              {dialog.type !== "alert" && (
                <button
                  type="button"
                  onClick={() => closeDialog(getDismissResult(dialog))}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  {dialog.cancelText}
                </button>
              )}
              <button
                type="button"
                onClick={() => closeDialog(dialog.type === "prompt" ? dialog.value : true)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                  dialog.tone === "danger"
                    ? "bg-red-600 hover:bg-red-500"
                    : dialog.tone === "success"
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-primary hover:bg-primary/90"
                }`}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useAppDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useAppDialog must be used within an AppDialogProvider");
  }
  return context;
}
