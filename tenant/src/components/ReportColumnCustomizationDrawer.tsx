"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownIcon,
  ArrowPathIcon,
  ArrowUpIcon,
  Bars3Icon,
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import type { ReportColumnPreference } from "./useReportColumnPreferences";

type ReportColumnCustomizationDrawerProps = {
  open: boolean;
  locale: string;
  title?: string;
  subtitle?: string;
  columns: ReportColumnPreference[];
  onClose: () => void;
  onSave: (columns: ReportColumnPreference[]) => void | Promise<void>;
  onReset?: () => void | Promise<void>;
};

function cloneColumns(columns: ReportColumnPreference[]) {
  return columns.map((column) => ({ ...column }));
}

export function ReportColumnCustomizationDrawer({
  open,
  locale,
  title,
  subtitle,
  columns,
  onClose,
  onSave,
  onReset
}: ReportColumnCustomizationDrawerProps) {
  const [draftColumns, setDraftColumns] = useState<ReportColumnPreference[]>(() => cloneColumns(columns));
  const [saving, setSaving] = useState(false);
  const isRTL = locale === "ar";

  useEffect(() => {
    if (open) {
      setDraftColumns(cloneColumns(columns));
    }
  }, [columns, open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const visibleCount = useMemo(
    () => draftColumns.filter((column) => column.visible).length,
    [draftColumns]
  );

  if (!open) return null;

  const moveColumn = (index: number, direction: -1 | 1) => {
    setDraftColumns((current) => {
      const next = cloneColumns(current);
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return next;
      if (next[index]?.locked || next[targetIndex]?.locked) return next;

      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const toggleVisibility = (index: number) => {
    setDraftColumns((current) => {
      const next = cloneColumns(current);
      const column = next[index];
      if (!column || column.locked) return next;
      const currentlyVisible = next.filter((item) => item.visible).length;
      if (column.visible && currentlyVisible <= 1) return next;
      column.visible = !column.visible;
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(cloneColumns(draftColumns));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div className="fixed inset-0 z-[160]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 end-0 flex w-full max-w-[560px]">
        <div className="flex h-full w-full flex-col overflow-hidden border-l border-gray-200 bg-white shadow-2xl" dir={isRTL ? "rtl" : "ltr"}>
          <div className={`flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {locale === "ar" ? "إعدادات الأعمدة" : "Column settings"}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-900">
                {title || (locale === "ar" ? "تخصيص الأعمدة" : "Customize columns")}
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
            <div className="space-y-3">
              <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {locale === "ar" ? "إظهار / إخفاء الأعمدة" : "Show / hide columns"}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {locale === "ar"
                        ? "اترك على الأقل عمودًا واحدًا ظاهرًا."
                        : "Keep at least one column visible."}
                    </div>
                  </div>
                  <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    {visibleCount} / {draftColumns.length}
                  </div>
                </div>
              </div>

              {draftColumns.map((column, index) => {
                const canMoveUp = index > 0 && !column.locked && !draftColumns[index - 1]?.locked;
                const canMoveDown = index < draftColumns.length - 1 && !column.locked && !draftColumns[index + 1]?.locked;
                const canHide = !column.locked && (column.visible ? visibleCount > 1 : true);

                return (
                  <div key={column.id} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className={`flex items-start justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Bars3Icon className="h-4 w-4 text-gray-400" />
                          <span className="font-semibold text-gray-900">{column.label}</span>
                          {column.locked ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                              {locale === "ar" ? "ثابت" : "Locked"}
                            </span>
                          ) : null}
                        </div>
                        {column.description ? (
                          <p className="mt-1 text-xs leading-5 text-gray-500">{column.description}</p>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleVisibility(index)}
                        disabled={!canHide}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                          column.visible
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                        } ${!canHide ? "cursor-not-allowed opacity-40" : ""}`}
                        aria-label={column.visible ? (locale === "ar" ? "إخفاء العمود" : "Hide column") : (locale === "ar" ? "إظهار العمود" : "Show column")}
                      >
                        {column.visible ? <EyeIcon className="h-4 w-4" /> : <EyeSlashIcon className="h-4 w-4" />}
                      </button>
                    </div>

                    <div className={`mt-3 flex items-center justify-between gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <div className="text-xs font-medium text-gray-500">
                        {column.visible
                          ? locale === "ar" ? "ظاهر" : "Visible"
                          : locale === "ar" ? "مخفي" : "Hidden"}
                      </div>
                      <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <button
                          type="button"
                          onClick={() => moveColumn(index, -1)}
                          disabled={!canMoveUp}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50 ${
                            !canMoveUp ? "cursor-not-allowed opacity-40 hover:bg-white" : ""
                          }`}
                          aria-label={locale === "ar" ? "تحريك لأعلى" : "Move up"}
                        >
                          <ArrowUpIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveColumn(index, 1)}
                          disabled={!canMoveDown}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50 ${
                            !canMoveDown ? "cursor-not-allowed opacity-40 hover:bg-white" : ""
                          }`}
                          aria-label={locale === "ar" ? "تحريك لأسفل" : "Move down"}
                        >
                          <ArrowDownIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`border-t border-gray-200 bg-white px-5 py-4 ${isRTL ? "text-right" : "text-left"}`}>
            <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${isRTL ? "sm:flex-row-reverse" : ""}`}>
              <button
                type="button"
                onClick={() => void onReset?.()}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                <ArrowPathIcon className="h-4 w-4" />
                {locale === "ar" ? "إعادة الضبط" : "Reset"}
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
                  onClick={() => void save()}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckIcon className="h-4 w-4" />
                  {saving ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...") : (locale === "ar" ? "حفظ" : "Save")}
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

