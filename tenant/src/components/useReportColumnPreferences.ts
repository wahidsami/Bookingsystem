"use client";

import { useEffect, useMemo, useState } from "react";

export type ReportColumnPreference = {
  id: string;
  label: string;
  description?: string;
  visible: boolean;
  locked?: boolean;
};

type UseReportColumnPreferencesInput = {
  userKey?: string | null;
  reportKey: string;
  defaultColumns: ReportColumnPreference[];
};

function buildStorageKey(userKey: string, reportKey: string) {
  return `rifah:reporting-v2:columns:${userKey}:${reportKey}`;
}

function cloneColumns(columns: ReportColumnPreference[]) {
  return columns.map((column) => ({ ...column }));
}

export function normalizeReportColumnPreferences(
  defaults: ReportColumnPreference[],
  persisted?: ReportColumnPreference[] | null
) {
  const persistedMap = new Map((persisted || []).map((column) => [column.id, column]));
  const ordered: ReportColumnPreference[] = [];

  defaults.forEach((column) => {
    const saved = persistedMap.get(column.id);
    ordered.push({
      ...column,
      visible: saved?.visible ?? column.visible,
      locked: saved?.locked ?? column.locked,
      description: saved?.description ?? column.description
    });
    persistedMap.delete(column.id);
  });

  persistedMap.forEach((column) => {
    ordered.push({ ...column });
  });

  return ordered;
}

export function useReportColumnPreferences({
  userKey,
  reportKey,
  defaultColumns
}: UseReportColumnPreferencesInput) {
  const defaultColumnsKey = useMemo(
    () =>
      JSON.stringify(
        defaultColumns.map((column) => ({
          id: column.id,
          label: column.label,
          description: column.description || "",
          visible: column.visible,
          locked: !!column.locked
        }))
      ),
    [defaultColumns]
  );

  const storageKey = useMemo(() => {
    if (!userKey) return null;
    return buildStorageKey(userKey, reportKey);
  }, [reportKey, userKey]);

  const [columns, setColumns] = useState<ReportColumnPreference[]>(() => cloneColumns(defaultColumns));
  const [hydrated, setHydrated] = useState(false);

  const clonedDefaults = useMemo(() => cloneColumns(defaultColumns), [defaultColumnsKey]);

  useEffect(() => {
    const fallback = cloneColumns(clonedDefaults);

    if (typeof window === "undefined" || !storageKey) {
      setColumns(fallback);
      setHydrated(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setColumns(fallback);
        setHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as ReportColumnPreference[] | null;
      setColumns(normalizeReportColumnPreferences(fallback, Array.isArray(parsed) ? parsed : null));
    } catch (error) {
      console.error("Failed to load report column preferences:", error);
      setColumns(fallback);
    } finally {
      setHydrated(true);
    }
  }, [clonedDefaults, defaultColumnsKey, storageKey]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined" || !storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(columns));
    } catch (error) {
      console.error("Failed to save report column preferences:", error);
    }
  }, [columns, hydrated, storageKey]);

  const visibleColumns = useMemo(() => columns.filter((column) => column.visible), [columns]);

  const updateColumns = (nextColumns: ReportColumnPreference[] | ((current: ReportColumnPreference[]) => ReportColumnPreference[])) => {
    setColumns((current) => {
      const next = typeof nextColumns === "function" ? nextColumns(current) : nextColumns;
      return cloneColumns(next);
    });
  };

  const resetColumns = () => {
    setColumns(cloneColumns(clonedDefaults));
    if (typeof window !== "undefined" && storageKey) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch (error) {
        console.error("Failed to reset report column preferences:", error);
      }
    }
  };

  return {
    columns,
    visibleColumns,
    hydrated,
    storageKey,
    setColumns: updateColumns,
    resetColumns
  };
}
