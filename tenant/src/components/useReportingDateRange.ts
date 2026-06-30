"use client";

import { useEffect, useState } from "react";
import { getReportDateRangeForPreset, type ReportDatePresetKey } from "./ReportDatePresets";

export function useReportingDateRange(defaultPreset: ReportDatePresetKey = "last_30_days") {
  const initialRange = getReportDateRangeForPreset(defaultPreset) || getReportDateRangeForPreset("last_30_days")!;
  const [selectedPreset, setSelectedPreset] = useState<ReportDatePresetKey>(defaultPreset);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);

  useEffect(() => {
    const nextRange = getReportDateRangeForPreset(selectedPreset);
    if (!nextRange) return;
    setStartDate(nextRange.startDate);
    setEndDate(nextRange.endDate);
  }, [selectedPreset]);

  const applyPreset = (preset: ReportDatePresetKey) => {
    setSelectedPreset(preset);
    const nextRange = getReportDateRangeForPreset(preset);
    if (nextRange) {
      setStartDate(nextRange.startDate);
      setEndDate(nextRange.endDate);
    }
  };

  return {
    selectedPreset,
    setSelectedPreset: applyPreset,
    startDate,
    setStartDate,
    endDate,
    setEndDate
  };
}
