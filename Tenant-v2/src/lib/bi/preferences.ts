import { useEffect, useMemo, useState } from 'react';
import type {
  BIColumnPreferenceState,
  BIReportColumnDefinition,
  BIReportQueryState,
  BISavedViewSnapshot,
} from './types';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function usePersistentJsonState<T>(key: string, fallback: T) {
  const [state, setState] = useState<T>(() => readJson(key, fallback));

  useEffect(() => {
    writeJson(key, state);
  }, [key, state]);

  return [state, setState] as const;
}

function buildDefaultColumnState<TRow>(columns: BIReportColumnDefinition<TRow>[]): BIColumnPreferenceState {
  return {
    order: columns.map((column) => column.id),
    hidden: columns.filter((column) => column.hiddenByDefault).map((column) => column.id)
  };
}

export function useBIColumnPreferences<TRow>(
  reportId: string,
  columns: BIReportColumnDefinition<TRow>[]
) {
  const storageKey = `refah-bi-columns:${reportId}`;
  const [columnState, setColumnState] = usePersistentJsonState<BIColumnPreferenceState>(
    storageKey,
    buildDefaultColumnState(columns)
  );

  const normalized = useMemo(() => {
    const ordered = [...columns].sort((left, right) => {
      const leftIndex = columnState.order.indexOf(left.id);
      const rightIndex = columnState.order.indexOf(right.id);
      const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
      return normalizedLeft - normalizedRight;
    });

    return ordered.filter((column) => !columnState.hidden.includes(column.id));
  }, [columnState.hidden, columnState.order, columns]);

  const toggleColumn = (columnId: string) => {
    setColumnState((prev) => {
      const hidden = prev.hidden.includes(columnId)
        ? prev.hidden.filter((id) => id !== columnId)
        : [...prev.hidden, columnId];
      return { ...prev, hidden };
    });
  };

  const moveColumn = (columnId: string, direction: 'up' | 'down') => {
    setColumnState((prev) => {
      const order = [...prev.order];
      const currentIndex = order.indexOf(columnId);
      if (currentIndex === -1) return prev;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= order.length) return prev;

      const [removed] = order.splice(currentIndex, 1);
      order.splice(targetIndex, 0, removed);
      return { ...prev, order };
    });
  };

  const resetColumns = () => {
    setColumnState(buildDefaultColumnState(columns));
  };

  return {
    columnState,
    visibleColumns: normalized,
    toggleColumn,
    moveColumn,
    resetColumns,
    setColumnState,
  };
}

function buildDefaultSavedViews(): BISavedViewSnapshot[] {
  return [];
}

export function useBISavedViews(reportId: string) {
  const storageKey = `refah-bi-saved-views:${reportId}`;
  const [savedViews, setSavedViews] = usePersistentJsonState<BISavedViewSnapshot[]>(
    storageKey,
    buildDefaultSavedViews()
  );

  const saveView = (name: string, query: BIReportQueryState) => {
    const next: BISavedViewSnapshot = {
      id: `view-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      query
    };
    setSavedViews((prev) => [next, ...prev]);
  };

  const deleteView = (id: string) => {
    setSavedViews((prev) => prev.filter((view) => view.id !== id));
  };

  return {
    savedViews,
    saveView,
    deleteView,
    setSavedViews,
  };
}
