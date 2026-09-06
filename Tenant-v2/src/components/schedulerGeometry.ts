export interface SchedulerEventBoxMetrics {
  top: number;
  bottom: number;
  height: number;
}

export function getSlotHeightForResolution({
  pixelsPerHour,
  slotMinutes,
}: {
  pixelsPerHour: number;
  slotMinutes: number;
}): number {
  if (!Number.isFinite(pixelsPerHour) || pixelsPerHour <= 0) {
    return 0;
  }

  if (!Number.isFinite(slotMinutes) || slotMinutes <= 0) {
    return 0;
  }

  return (pixelsPerHour * slotMinutes) / 60;
}

export function getSchedulerEventBoxMetrics({
  startMinutes,
  endMinutes,
  pixelsPerHour,
  timelineStartMinutes = 0,
}: {
  startMinutes: number;
  endMinutes: number;
  pixelsPerHour: number;
  timelineStartMinutes?: number;
}): SchedulerEventBoxMetrics {
  if (!Number.isFinite(pixelsPerHour) || pixelsPerHour <= 0) {
    return { top: 0, bottom: 0, height: 0 };
  }

  const relativeStartMinutes = Math.max(0, startMinutes - timelineStartMinutes);
  const relativeEndMinutes = Math.max(0, endMinutes - timelineStartMinutes);
  const top = (relativeStartMinutes / 60) * pixelsPerHour;
  const bottom = (relativeEndMinutes / 60) * pixelsPerHour;
  const height = Math.max(0, bottom - top);

  return { top, bottom, height };
}
