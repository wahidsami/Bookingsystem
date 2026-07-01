"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";

export type ReportFiltersDrawerProps = {
  open: boolean;
  locale: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onApply?: () => void | Promise<void>;
  onReset?: () => void | Promise<void>;
  children: ReactNode;
  applyLabel?: string;
  resetLabel?: string;
  className?: string;
};

export function ReportFiltersDrawer({
  open,
  locale,
  title,
  subtitle,
  onClose,
  onApply,
  onReset,
  children,
  applyLabel,
  resetLabel,
  className = ""
}: ReportFiltersDrawerProps) {
  const [saving, setSaving] = useState(false);
  const isRTL = locale === "ar";

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleApply = async () => {
    if (!onApply) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await onApply();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div className={`fixed inset-0 z-[170] ${className}`}>
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`absolute inset-y-0 ${isRTL ? "left-0" : "right-0"} flex w-full max-w-[560px]`}>
        <div className="flex h-full w-full flex-col overflow-hidden border-l border-gray-200 bg-white shadow-2xl" dir={isRTL ? "rtl" : "ltr"}>
          <div className={`flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {locale === "ar" ? "مرشحات التقرير" : "Report filters"}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-900">
                {title || (locale === "ar" ? "المرشحات" : "Filters")}
              </h2>
              {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-gray-300 bg-white p-2 text-gray-600 transition hover:bg-gray-50"
              aria-label={locale === "ar" ? "إغلاق" : "Close"}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4">
            {children}
          </div>

          <div className={`border-t border-gray-200 bg-white px-5 py-4 ${isRTL ? "text-right" : "text-left"}`}>
            <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${isRTL ? "sm:flex-row-reverse" : ""}`}>
              <button
                type="button"
                onClick={() => void onReset?.()}
                className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                {resetLabel || (locale === "ar" ? "إعادة الضبط" : "Reset")}
              </button>

              <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  {locale === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleApply()}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-full border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (locale === "ar" ? "جارٍ التطبيق..." : "Applying...") : (applyLabel || (locale === "ar" ? "تطبيق" : "Apply"))}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
}
