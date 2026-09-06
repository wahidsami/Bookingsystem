export interface SchedulerEventBoxMetrics {
  top: number;
  bottom: number;
  height: number;
}

export function getSchedulerEventBoxMetrics({
  startMinutes,
  endMinutes,
  slotMinutes,
  slotHeight,
  timelineStartMinutes = 0,
}: {
  startMinutes: number;
  endMinutes: number;
  slotMinutes: number;
  slotHeight: number;
  timelineStartMinutes?: number;
}): SchedulerEventBoxMetrics {
  const relativeStartMinutes = Math.max(0, startMinutes - timelineStartMinutes);
  const relativeEndMinutes = Math.max(0, endMinutes - timelineStartMinutes);
  const top = (relativeStartMinutes / slotMinutes) * slotHeight;
  const bottom = (relativeEndMinutes / slotMinutes) * slotHeight;
  const height = Math.max(0, bottom - top);

  return { top, bottom, height };
}
