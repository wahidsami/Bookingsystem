"use client";

import type { ReactNode } from "react";
import { ReportingWorkspaceEngine } from "./ReportingEngine";
import type { ReportDatePresetKey } from "./ReportDatePresets";

export type SalesReportNavItem = {
  id: string;
  label: string;
  href: string;
  description?: string;
  badge?: ReactNode;
};

type SalesReportWorkspaceShellProps = {
  locale: string;
  title: string;
  subtitle?: string;
  navItems: SalesReportNavItem[];
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
};

export function SalesReportWorkspaceShell({
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
  children
}: SalesReportWorkspaceShellProps) {
  return (
    <ReportingWorkspaceEngine
      locale={locale}
      title={title}
      subtitle={subtitle}
      navItems={navItems}
      activeReportId={activeReportId}
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
    >
      {children}
    </ReportingWorkspaceEngine>
  );
}
