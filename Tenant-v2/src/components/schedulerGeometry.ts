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
}: {
  startMinutes: number;
  endMinutes: number;
  slotMinutes: number;
  slotHeight: number;
}): SchedulerEventBoxMetrics {
  const top = (Math.max(0, startMinutes) / slotMinutes) * slotHeight;
  const bottom = (Math.max(0, endMinutes) / slotMinutes) * slotHeight;
  const height = Math.max(0, bottom - top);

  return { top, bottom, height };
}
