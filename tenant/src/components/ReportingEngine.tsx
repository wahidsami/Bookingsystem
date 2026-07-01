"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AnalyticsDataTable, type AnalyticsDataTableProps } from "./AnalyticsDataTable";
import { AnalyticsDetailsDrawer, type AnalyticsDetailsDrawerProps } from "./AnalyticsDetailsDrawer";
import { ReportColumnCustomizationDrawer, type ReportColumnCustomizationDrawerProps } from "./ReportColumnCustomizationDrawer";
import { ReportFiltersDrawer, type ReportFiltersDrawerProps } from "./ReportFiltersDrawer";
import { ReportOptionsMenu, type ReportOptionsMenuProps } from "./ReportOptionsMenu";
import { ReportExportToolbar, type ReportExportToolbarProps } from "./ReportExportToolbar";
import { ReportingStickyToolbar } from "./ReportingStickyToolbar";
import type { ReportDatePresetKey } from "./ReportDatePresets";

export type ReportingWorkspaceNavItem = {
  id: string;
  label: string;
  href: string;
  description?: string;
  badge?: ReactNode;
};

export type ReportingWorkspaceEngineProps = {
  locale: string;
  title: string;
  subtitle?: string;
  navItems: ReportingWorkspaceNavItem[];
  activeReportId: string;
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
  children: ReactNode;
  className?: string;
};

export function ReportingWorkspaceEngine({
  locale,
  title,
  subtitle,
  navItems,
  activeReportId,
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
  children,
  className = ""
}: ReportingWorkspaceEngineProps) {
  const isRTL = locale === "ar";

  return (
    <div className={`space-y-5 ${className}`} dir={isRTL ? "rtl" : "ltr"}>
      <ReportingStickyToolbar
        locale={locale}
        title={title}
        subtitle={subtitle}
        selectedPreset={selectedPreset}
        startDate={startDate}
        endDate={endDate}
        onPresetChange={onPresetChange}
        onStartDateChange={onStartDateChange}
        onEndDateChange={onEndDateChange}
        onFiltersClick={onFiltersClick}
        onSettingsClick={onSettingsClick}
        optionsMenu={optionsMenu}
        actions={actions}
      />

      <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className={`mb-4 flex flex-wrap items-center gap-2 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
          {navItems.map((item) => {
            const active = item.id === activeReportId;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`group inline-flex min-h-16 min-w-[180px] flex-1 flex-col rounded-2xl border px-4 py-3 transition ${
                  active
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span className={`text-sm font-semibold ${active ? "text-primary-700" : "text-gray-900"}`}>
                  {item.label}
                </span>
                {item.description ? (
                  <span className="mt-1 text-xs leading-5 text-gray-500">{item.description}</span>
                ) : null}
                {item.badge !== undefined ? (
                  <span className="mt-2 text-xs font-semibold text-gray-500">{item.badge}</span>
                ) : null}
              </Link>
            );
          })}
        </div>

        <div className="space-y-5">{children}</div>
      </section>
    </div>
  );
}

export function ReportingTableEngine(props: AnalyticsDataTableProps) {
  return <AnalyticsDataTable {...props} />;
}

export function ReportingDetailDrawer(props: AnalyticsDetailsDrawerProps) {
  return <AnalyticsDetailsDrawer {...props} />;
}

export function ReportingFiltersEngineDrawer(props: ReportFiltersDrawerProps) {
  return <ReportFiltersDrawer {...props} />;
}

export function ReportingColumnsEngineDrawer(props: ReportColumnCustomizationDrawerProps) {
  return <ReportColumnCustomizationDrawer {...props} />;
}

export function ReportingOptionsEngineMenu(props: ReportOptionsMenuProps) {
  return <ReportOptionsMenu {...props} />;
}

export function ReportingExportEngineToolbar(props: ReportExportToolbarProps) {
  return <ReportExportToolbar {...props} />;
}
