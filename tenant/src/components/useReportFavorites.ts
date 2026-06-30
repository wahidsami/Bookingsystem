"use client";

import { useEffect, useMemo, useState } from "react";

function buildStorageKey(userKey: string, reportKey: string) {
  return `rifah:reporting-v2:favorites:${userKey}:${reportKey}`;
}

function loadFavoriteValue(storageKey: string | null, fallback = false) {
  if (typeof window === "undefined" || !storageKey) {
    return fallback;
  }

  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch (error) {
    console.error("Failed to load report favorite state:", error);
    return fallback;
  }
}

export function useReportFavorite(userKey: string | null | undefined, reportKey: string) {
  const storageKey = useMemo(() => {
    if (!userKey) return null;
    return buildStorageKey(userKey, reportKey);
  }, [reportKey, userKey]);

  const [hydrated, setHydrated] = useState(false);
  const [isFavorite, setIsFavorite] = useState(() => loadFavoriteValue(storageKey, false));

  useEffect(() => {
    setIsFavorite(loadFavoriteValue(storageKey, false));
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined" || !storageKey) return;

    try {
      window.localStorage.setItem(storageKey, isFavorite ? "1" : "0");
    } catch (error) {
      console.error("Failed to persist report favorite state:", error);
    }
  }, [hydrated, isFavorite, storageKey]);

  const toggleFavorite = () => setIsFavorite((current) => !current);

  return {
    hydrated,
    isFavorite,
    setIsFavorite,
    toggleFavorite
  };
}
