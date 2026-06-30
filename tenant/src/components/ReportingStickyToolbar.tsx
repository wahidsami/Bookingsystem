"use client";

import type { ReactNode } from "react";
import { Cog6ToothIcon, FunnelIcon } from "@heroicons/react/24/outline";
import { REPORT_DATE_PRESETS, type ReportDatePresetKey } from "./ReportDatePresets";

type ReportingStickyToolbarProps = {
  locale: string;
  title: ReactNode;
  subtitle?: ReactNode;
  selectedPreset: ReportDatePresetKey;
  startDate: string;
  endDate: string;
  onPresetChange: (preset: ReportDatePresetKey) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onFiltersClick?: () => void;
  onSettingsClick?: () => void;
  optionsMenu?: ReactNode;
  actions?: ReactNode;
  className?: string;
  stickyTopClassName?: string;
  showCustomRangeInputs?: boolean;
};

export function ReportingStickyToolbar({
  locale,
  title,
  subtitle,
  selectedPreset,
  startDate,
  endDate,
  onPresetChange,
  onStartDateChange,
  onEndDateChange,
  onFiltersClick,
  onSettingsClick,
  optionsMenu,
  actions,
  className = "",
  stickyTopClassName = "top-0",
  showCustomRangeInputs = true
}: ReportingStickyToolbarProps) {
  const isRTL = locale === "ar";

  return (
    <section className={`no-print sticky ${stickyTopClassName} z-30 rounded-3xl border border-gray-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur ${className}`} dir={isRTL ? "rtl" : "ltr"}>
      <div className={`flex flex-col gap-4 ${isRTL ? "lg:flex-row-reverse" : "lg:flex-row"} lg:items-center lg:justify-between`}>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {locale === "ar" ? "التقارير" : "Reports"}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-3xl text-sm text-gray-600">{subtitle}</p> : null}
        </div>

        <div className={`flex flex-wrap items-center gap-2 ${isRTL ? "justify-end" : ""}`}>
          {actions}
          {onFiltersClick ? (
            <button
              type="button"
              onClick={onFiltersClick}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <FunnelIcon className="h-5 w-5" />
              <span>{locale === "ar" ? "المرشحات" : "Filters"}</span>
            </button>
          ) : null}
          {onSettingsClick ? (
            <button
              type="button"
              onClick={onSettingsClick}
              className="inline-flex h-11 items-center justify-center rounded-full border border-gray-300 bg-white px-3 text-gray-700 transition hover:bg-gray-50"
              aria-label={locale === "ar" ? "الإعدادات" : "Settings"}
              title={locale === "ar" ? "الإعدادات" : "Settings"}
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </button>
          ) : null}
          {optionsMenu}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className={`flex flex-wrap items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          {REPORT_DATE_PRESETS.map((preset) => {
            const active = preset.id === selectedPreset;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onPresetChange(preset.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {locale === "ar" ? preset.labelAr : preset.labelEn}
              </button>
            );
          })}
        </div>

        {showCustomRangeInputs ? (
          <div className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${isRTL ? "md:[direction:rtl]" : ""}`}>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                {locale === "ar" ? "من تاريخ" : "Start date"}
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => onStartDateChange(event.target.value)}
                disabled={selectedPreset !== "custom"}
                className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                {locale === "ar" ? "إلى تاريخ" : "End date"}
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => onEndDateChange(event.target.value)}
                disabled={selectedPreset !== "custom"}
                className="w-full rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </label>
          </div>
        ) : null}
      </div>
    </section>
  );
}

