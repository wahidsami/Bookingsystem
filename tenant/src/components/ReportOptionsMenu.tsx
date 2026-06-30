"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  EllipsisVerticalIcon,
  PrinterIcon,
  StarIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

type MenuAction = {
  id: string;
  label: string;
  icon: typeof ArrowDownTrayIcon;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  hidden?: boolean;
  tone?: "default" | "danger" | "accent";
};

type ReportOptionsMenuProps = {
  locale: string;
  isFavorite?: boolean;
  onDuplicate?: () => void | Promise<void>;
  onToggleFavorite?: () => void | Promise<void>;
  onExportCsv?: () => void | Promise<void>;
  onExportXlsx?: () => void | Promise<void>;
  onExportPdf?: () => void | Promise<void>;
  onPrint?: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
};

function MenuItem({
  label,
  icon: Icon,
  onClick,
  disabled,
  tone = "default"
}: Pick<MenuAction, "label" | "icon" | "onClick" | "disabled" | "tone">) {
  const toneClasses =
    tone === "danger"
      ? "text-rose-700 hover:bg-rose-50"
      : tone === "accent"
        ? "text-primary-700 hover:bg-primary/5"
        : "text-gray-700 hover:bg-gray-50";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition ${
        disabled ? "cursor-not-allowed opacity-50" : toneClasses
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

export function ReportOptionsMenu({
  locale,
  isFavorite = false,
  onDuplicate,
  onToggleFavorite,
  onExportCsv,
  onExportXlsx,
  onExportPdf,
  onPrint,
  disabled = false,
  className = ""
}: ReportOptionsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const isRTL = locale === "ar";

  const actions = useMemo<MenuAction[]>(
    () => [
      {
        id: "duplicate",
        label: locale === "ar" ? "نسخ التقرير" : "Duplicate",
        icon: DocumentDuplicateIcon,
        onClick: () => void onDuplicate?.(),
        disabled: !onDuplicate
      },
      {
        id: "favorite",
        label: isFavorite ? (locale === "ar" ? "إزالة من المفضلة" : "Unfavorite") : (locale === "ar" ? "إضافة للمفضلة" : "Favorite"),
        icon: StarIcon,
        onClick: () => void onToggleFavorite?.(),
        tone: "accent",
        disabled: !onToggleFavorite
      },
      {
        id: "csv",
        label: locale === "ar" ? "تصدير CSV" : "Export CSV",
        icon: ArrowDownTrayIcon,
        onClick: () => void onExportCsv?.(),
        disabled: !onExportCsv
      },
      {
        id: "xlsx",
        label: locale === "ar" ? "تصدير XLSX" : "Export XLSX",
        icon: ArrowDownTrayIcon,
        onClick: () => void onExportXlsx?.(),
        disabled: !onExportXlsx
      },
      {
        id: "pdf",
        label: locale === "ar" ? "تصدير PDF" : "Export PDF",
        icon: ArrowDownTrayIcon,
        onClick: () => void onExportPdf?.(),
        disabled: !onExportPdf
      },
      {
        id: "print",
        label: locale === "ar" ? "طباعة" : "Print",
        icon: PrinterIcon,
        onClick: () => void onPrint?.(),
        disabled: !onPrint
      }
    ],
    [isFavorite, locale, onDuplicate, onExportCsv, onExportPdf, onExportXlsx, onPrint, onToggleFavorite]
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const visibleActions = actions.filter((action) => !action.hidden);

  return (
    <div ref={wrapperRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 ${
          disabled ? "cursor-not-allowed opacity-50 hover:bg-white" : ""
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <EllipsisVerticalIcon className="h-5 w-5" />
        <span>{locale === "ar" ? "خيارات" : "Options"}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className={`absolute top-14 z-40 w-72 rounded-3xl border border-gray-200 bg-white p-2 shadow-2xl ${isRTL ? "left-0" : "right-0"}`}
        >
          <div className={`flex items-center justify-between px-3 py-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                {locale === "ar" ? "إجراءات التقرير" : "Report actions"}
              </div>
              <div className="mt-1 text-sm font-semibold text-gray-900">
                {locale === "ar" ? "خيارات سريعة" : "Quick actions"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
              aria-label={locale === "ar" ? "إغلاق" : "Close"}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-1 space-y-1">
            {visibleActions.map((action) => (
              <MenuItem
                key={action.id}
                label={action.label}
                icon={action.icon}
                tone={action.tone}
                disabled={disabled || action.disabled}
                onClick={() => {
                  if (disabled || action.disabled) return;
                  setOpen(false);
                  void action.onClick();
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
