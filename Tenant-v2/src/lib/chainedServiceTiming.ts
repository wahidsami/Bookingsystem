export interface ChainedServiceTimingItem {
  startTime: number;
  duration?: number;
  startTimeIso?: string | null;
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

  const expectedStart = Number(priorItem.startTime) + Number(priorItem.duration || 0);
  const currentStartIso = currentItem.startTimeIso ? new Date(currentItem.startTimeIso).getTime() : null;
  const expectedStartMs = new Date(expectedStartIso).getTime();

  return Number(currentItem.startTime) === expectedStart
    && (currentStartIso === null || currentStartIso === expectedStartMs);
};