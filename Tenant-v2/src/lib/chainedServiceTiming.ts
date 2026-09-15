export interface ChainedServiceTimingItem {
  startTime: number;
  duration?: number;
  startTimeIso?: string | null;
  timingMode?: 'auto' | 'manual';
}

export const isAutoDerivedFromPreviousChain = ({
  priorItem,
  currentItem,
  expectedStartIso
}: {
  priorItem?: ChainedServiceTimingItem;
  currentItem?: ChainedServiceTimingItem;
  expectedStartIso: string;
}) => {
  if (!priorItem || !currentItem) {
    return false;
  }

  // Use explicit canonical state if provided
  if (currentItem.timingMode) {
    return currentItem.timingMode === 'auto';
  }

  // Legacy fallback (heuristics)
  const expectedStart = Number(priorItem.startTime) + Number(priorItem.duration || 0);
  const currentStartIso = currentItem.startTimeIso ? new Date(currentItem.startTimeIso).getTime() : null;
  const expectedStartMs = new Date(expectedStartIso).getTime();

  return Number(currentItem.startTime) === expectedStart
    && (currentStartIso === null || currentStartIso === expectedStartMs);
};