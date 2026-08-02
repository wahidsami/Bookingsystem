import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Users } from 'lucide-react';

export type SchedulerViewMode = 'day' | 'week';

export interface SchedulerColumn {
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string;
  statusLabel?: string;
  statusTone?: 'active' | 'break' | 'off' | 'today' | 'neutral';
  dateKey?: string;
  isToday?: boolean;
}

export interface SchedulerEvent {
  id: string;
  appointmentId?: string;
  columnId: string;
  dateKey: string;
  startMinutes: number;
  durationMinutes: number;
  title: string;
  subtitle?: string;
  variantLabel?: string;
  variantDescription?: string;
  notes?: string;
  price?: number;
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
  status?: string;
  kind?: 'appointment' | 'blocked';
  blockedType?: string;
  isGroupBooking?: boolean;
  guestCount?: number;
  hasNotes?: boolean;
  avatar?: string;
  staffAvatar?: string;
  assignedStaffName?: string;
  assignedStaffRole?: string;
  serviceCategory?: string;
  role?: string;
  raw?: any;
}

export interface SchedulerSlot {
  columnId: string;
  dateKey: string;
  employeeId: string;
  columnIndex: number;
  slotIndex: number;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
}

export interface SchedulerSlotRange {
  startSlot: SchedulerSlot;
  endSlot: SchedulerSlot;
  startIndex: number;
  endIndex: number;
  slotCount: number;
  durationMinutes: number;
}

export interface SchedulerGridProps {
  viewMode: SchedulerViewMode;
  selectedDateKey: string;
  isEditable: boolean;
  isRtl: boolean;
  boardCurrentTime: Date;
  columns: SchedulerColumn[];
  events: SchedulerEvent[];
  slotMinutes?: number;
  startHour?: number;
  endHour?: number;
  timeColumnWidth?: number;
  onSlotClick?: (slot: SchedulerSlot) => void;
  onSlotContextMenu?: (event: React.MouseEvent, slot: SchedulerSlot) => void;
  onSlotDrop?: (slot: SchedulerSlot, draggedEventId: string) => void;
  onSlotRangeSelect?: (range: SchedulerSlotRange) => void;
  onEventClick?: (event: SchedulerEvent) => void;
  onEventContextMenu?: (event: React.MouseEvent, schedulerEvent: SchedulerEvent) => void;
  onEventDragStart?: (schedulerEvent: SchedulerEvent) => void;
  onEventDragEnd?: (schedulerEvent: SchedulerEvent) => void;
  onEventResizeStart?: (schedulerEvent: SchedulerEvent, event: React.MouseEvent) => void;
  onAddSlotHover?: (slot: SchedulerSlot | null) => void;
  emptyHint?: string;
}

const DEFAULT_SLOT_MINUTES = 5;
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 21;
const DEFAULT_TIME_COLUMN_WIDTH = 84;
const DEFAULT_SLOT_HEIGHT = 10;

const toneClasses: Record<NonNullable<SchedulerColumn['statusTone']>, string> = {
  active: 'bg-emerald-500',
  break: 'bg-amber-500',
  off: 'bg-rose-500',
  today: 'bg-amber-500',
  neutral: 'bg-slate-300',
};

const serviceCategoryStyles: Record<string, {
  accent: string;
  card: string;
  badge: string;
  avatar: string;
}> = {
  hair: {
    accent: 'bg-fuchsia-500',
    card: 'border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-white',
    badge: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    avatar: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  },
  spa: {
    accent: 'bg-emerald-500',
    card: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    avatar: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  nails: {
    accent: 'bg-rose-500',
    card: 'border-rose-200 bg-gradient-to-br from-rose-50 to-white',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    avatar: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  beauty: {
    accent: 'bg-amber-500',
    card: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    avatar: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  barber: {
    accent: 'bg-sky-500',
    card: 'border-sky-200 bg-gradient-to-br from-sky-50 to-white',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    avatar: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  skin: {
    accent: 'bg-violet-500',
    card: 'border-violet-200 bg-gradient-to-br from-violet-50 to-white',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    avatar: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  default: {
    accent: 'bg-slate-500',
    card: 'border-slate-200 bg-white',
    badge: 'bg-slate-50 text-slate-700 border-slate-200',
    avatar: 'border-slate-200 bg-slate-50 text-slate-700',
  },
};

const getInitials = (value?: string | null) => {
  const words = `${value || ''}`.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '•';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
};

const getServiceCategoryStyles = (value?: string | null) => {
  const key = `${value || ''}`.trim().toLowerCase();
  if (serviceCategoryStyles[key]) {
    return serviceCategoryStyles[key];
  }
  if (key.includes('spa')) return serviceCategoryStyles.spa;
  if (key.includes('nail')) return serviceCategoryStyles.nails;
  if (key.includes('hair')) return serviceCategoryStyles.hair;
  if (key.includes('beauty')) return serviceCategoryStyles.beauty;
  if (key.includes('barber')) return serviceCategoryStyles.barber;
  if (key.includes('skin')) return serviceCategoryStyles.skin;
  return serviceCategoryStyles.default;
};

const formatAppointmentStatusLabel = (status?: string | null, kind?: SchedulerEvent['kind']) => {
  if (kind === 'blocked') {
    return 'Blocked';
  }
  const normalized = `${status || ''}`.trim().toLowerCase();
  if (!normalized) return 'Pending';
  if (normalized === 'completed') return 'Completed';
  if (['checked_in', 'checked-in', 'arrived'].includes(normalized)) return 'Arrived';
  if (['in_service', 'in-service'].includes(normalized)) return 'In Service';
  if (['confirmed', 'scheduled'].includes(normalized)) return 'Confirmed';
  if (['cancelled', 'canceled'].includes(normalized)) return 'Cancelled';
  if (['no_show', 'no-show'].includes(normalized)) return 'No Show';
  return normalized.replace(/[_-]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
};

const formatSlotTime = (totalMinutesFromStart: number, startHour: number, isRtl: boolean) => {
  const absoluteMinutes = (startHour * 60) + Math.max(0, Math.round(totalMinutesFromStart));
  let hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  const ampm = hours >= 12 ? (isRtl ? 'م' : 'PM') : (isRtl ? 'ص' : 'AM');
  hours %= 12;
  hours = hours || 12;
  return `${hours}:${String(minutes).padStart(2, '0')} ${ampm}`;
};

const formatSlotTime24 = (totalMinutesFromStart: number, startHour: number) => {
  const absoluteMinutes = (startHour * 60) + Math.max(0, Math.round(totalMinutesFromStart));
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getRiyadhMinutesSinceMidnight = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(value);

  const hour = Number(parts.find((part) => part.type === 'hour')?.value || '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || '0');
  return hour * 60 + minute;
};

const getRiyadhDateKey = (value: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);

  const year = parts.find((part) => part.type === 'year')?.value || '0000';
  const month = parts.find((part) => part.type === 'month')?.value || '00';
  const day = parts.find((part) => part.type === 'day')?.value || '00';
  return `${year}-${month}-${day}`;
};

export default function SchedulerGrid({
  viewMode,
  selectedDateKey,
  isEditable,
  isRtl,
  boardCurrentTime,
  columns,
  events,
  slotMinutes = DEFAULT_SLOT_MINUTES,
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
  timeColumnWidth = DEFAULT_TIME_COLUMN_WIDTH,
  onSlotClick,
  onSlotContextMenu,
  onSlotDrop,
  onEventClick,
  onEventContextMenu,
  onEventDragStart,
  onEventDragEnd,
  onEventResizeStart,
  onAddSlotHover,
  onSlotRangeSelect,
}: SchedulerGridProps) {
  const [hoveredSlot, setHoveredSlot] = useState<SchedulerSlot | null>(null);
  const [selectionAnchor, setSelectionAnchor] = useState<SchedulerSlot | null>(null);
  const [selectionFocus, setSelectionFocus] = useState<SchedulerSlot | null>(null);
  const suppressNextClickRef = useRef(false);
  const slotHeight = DEFAULT_SLOT_HEIGHT;
  const slotsPerHour = 60 / slotMinutes;
  const slotCount = Math.max(1, Math.round(((endHour - startHour) * 60) / slotMinutes));
  const gridTemplateColumns = useMemo(
    () => `${timeColumnWidth}px repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))`,
    [columns.length, timeColumnWidth]
  );
  const visibleDateKey = getRiyadhDateKey(boardCurrentTime);
  const currentMinutesSinceMidnight = getRiyadhMinutesSinceMidnight(boardCurrentTime);
  const currentTimeLinePosition = viewMode === 'day' && visibleDateKey === selectedDateKey && currentMinutesSinceMidnight >= startHour * 60 && currentMinutesSinceMidnight <= endHour * 60
    ? ((currentMinutesSinceMidnight - (startHour * 60)) / slotMinutes) * slotHeight
    : null;

  const rows = useMemo(() => Array.from({ length: slotCount }, (_, slotIndex) => {
    const startMinutes = slotIndex * slotMinutes;
    const endMinutes = startMinutes + slotMinutes;
    return { slotIndex, startMinutes, endMinutes };
  }), [slotCount, slotMinutes]);

  const resolveSlot = (column: SchedulerColumn, columnIndex: number, slotIndex: number): SchedulerSlot => {
    const startMinutes = slotIndex * slotMinutes;
    const endMinutes = (slotIndex + 1) * slotMinutes;
    return {
      columnId: column.id,
      dateKey: column.dateKey || selectedDateKey,
      employeeId: column.id,
      columnIndex,
      slotIndex,
      startMinutes,
      endMinutes,
      startTime: formatSlotTime24(startMinutes, startHour),
      endTime: formatSlotTime24(endMinutes, startHour),
    };
  };

  const getColumnIndex = (columnId: string) => columns.findIndex((column) => column.id === columnId);

  const isSameAxis = (left: SchedulerSlot | null, right: SchedulerSlot | null) => {
    if (!left || !right) return false;
    return left.columnId === right.columnId && left.dateKey === right.dateKey;
  };

  const isSlotInsideSelection = (slot: SchedulerSlot) => {
    if (!selectionAnchor || !selectionFocus || !isSameAxis(selectionAnchor, selectionFocus) || !isSameAxis(selectionAnchor, slot)) {
      return false;
    }

    const minIndex = Math.min(selectionAnchor.slotIndex, selectionFocus.slotIndex);
    const maxIndex = Math.max(selectionAnchor.slotIndex, selectionFocus.slotIndex);
    return slot.slotIndex >= minIndex && slot.slotIndex <= maxIndex;
  };

  const commitSelection = () => {
    if (!selectionAnchor || !selectionFocus) {
      setSelectionAnchor(null);
      setSelectionFocus(null);
      return;
    }

    const hasRange = selectionAnchor.slotIndex !== selectionFocus.slotIndex
      || selectionAnchor.columnId !== selectionFocus.columnId
      || selectionAnchor.dateKey !== selectionFocus.dateKey;

    if (hasRange) {
      const startIndex = Math.min(selectionAnchor.slotIndex, selectionFocus.slotIndex);
      const endIndex = Math.max(selectionAnchor.slotIndex, selectionFocus.slotIndex);
      const startSlot = selectionAnchor.slotIndex <= selectionFocus.slotIndex ? selectionAnchor : selectionFocus;
      const endSlot = selectionAnchor.slotIndex <= selectionFocus.slotIndex ? selectionFocus : selectionAnchor;
      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 0);
      onSlotRangeSelect?.({
        startSlot,
        endSlot,
        startIndex,
        endIndex,
        slotCount: endIndex - startIndex + 1,
        durationMinutes: Math.max(slotMinutes, (endIndex - startIndex + 1) * slotMinutes),
      });
    }

    setSelectionAnchor(null);
    setSelectionFocus(null);
  };

  useEffect(() => {
    if (!selectionAnchor) {
      return undefined;
    }

    const handleWindowMouseUp = () => {
      commitSelection();
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [selectionAnchor, selectionFocus]);

  const slotCellClassName = (isHourBoundary: boolean, isActiveHover: boolean) => [
    'relative outline-none transition-colors border-r last:border-r-0',
    isHourBoundary ? 'border-b border-slate-200' : 'border-b border-slate-100/80',
    isActiveHover ? 'bg-amber-500/10' : 'bg-white hover:bg-slate-50/80',
    isEditable ? 'cursor-pointer' : 'cursor-default',
  ].join(' ');

  const positionedEvents = useMemo(() => {
    const groupedByColumn = new Map<string, SchedulerEvent[]>();
    columns.forEach((column) => {
      groupedByColumn.set(column.id, []);
    });

    events.forEach((event) => {
      if (!groupedByColumn.has(event.columnId)) {
        groupedByColumn.set(event.columnId, []);
      }
      groupedByColumn.get(event.columnId)?.push(event);
    });

    type PositionedEvent = SchedulerEvent & { laneIndex: number; laneCount: number };
    const positioned: PositionedEvent[] = [];

    groupedByColumn.forEach((columnEvents, columnId) => {
      const sortedEvents = [...columnEvents].sort((a, b) => {
        if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
        return (b.startMinutes + b.durationMinutes) - (a.startMinutes + a.durationMinutes);
      });

      const clusters: SchedulerEvent[][] = [];
      let activeCluster: SchedulerEvent[] = [];
      let clusterEnd = -1;

      sortedEvents.forEach((event) => {
        const eventEnd = event.startMinutes + Math.max(slotMinutes, event.durationMinutes);
        if (activeCluster.length === 0) {
          activeCluster = [event];
          clusterEnd = eventEnd;
          return;
        }

        if (event.startMinutes < clusterEnd) {
          activeCluster.push(event);
          clusterEnd = Math.max(clusterEnd, eventEnd);
          return;
        }

        clusters.push(activeCluster);
        activeCluster = [event];
        clusterEnd = eventEnd;
      });

      if (activeCluster.length > 0) {
        clusters.push(activeCluster);
      }

      clusters.forEach((cluster) => {
        type Lane = { lastEnd: number };
        const lanes: Lane[] = [];
        const assignments = cluster
          .slice()
          .sort((a, b) => {
            if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
            return (b.startMinutes + b.durationMinutes) - (a.startMinutes + a.durationMinutes);
          })
          .map((event) => {
            const eventEnd = event.startMinutes + Math.max(slotMinutes, event.durationMinutes);
            let laneIndex = lanes.findIndex((lane) => lane.lastEnd <= event.startMinutes);
            if (laneIndex === -1) {
              laneIndex = lanes.length;
              lanes.push({ lastEnd: eventEnd });
            } else {
              lanes[laneIndex].lastEnd = eventEnd;
            }
            return { event, laneIndex };
          });

        const laneCount = Math.max(1, lanes.length);
        assignments.forEach(({ event, laneIndex }) => {
          positioned.push({
            ...event,
            columnId,
            laneIndex,
            laneCount,
          });
        });
      });
    });

    return positioned;
  }, [columns, events, slotMinutes]);

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="sticky top-0 z-30 grid border-b border-slate-200 bg-slate-50/95 backdrop-blur-sm" style={{ gridTemplateColumns }}>
        <div
          className="flex items-center justify-center border-r border-slate-200 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 bg-slate-50"
          style={{ width: timeColumnWidth }}
        >
          {isRtl ? 'الفترة' : 'Time'}
        </div>

        {columns.map((column, columnIndex) => {
          const isActiveLane = hoveredSlot?.columnId === column.id;
          const laneShade = columnIndex % 2 === 0 ? 'bg-slate-50/80' : 'bg-white';
          return (
          <div
            key={column.id}
            className={`min-w-0 border-r last:border-r-0 border-slate-200 px-3 py-2 flex items-center justify-between gap-3 transition-colors ${laneShade} ${column.isToday ? 'bg-amber-500/10' : ''} ${isActiveLane ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-400/50' : ''}`}
          >
            <div className="min-w-0 flex items-center gap-2">
              {column.avatar ? (
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                  <img src={column.avatar} alt={column.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className={`h-8 w-8 shrink-0 rounded-full text-[10px] font-black text-white flex items-center justify-center ${toneClasses[column.statusTone || 'neutral']}`}>
                  {column.title.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="truncate text-xs font-black text-slate-800">{column.title}</p>
                  {column.statusLabel && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">
                      {column.statusLabel}
                    </span>
                  )}
                </div>
                {column.subtitle && (
                  <p className="truncate text-[10px] font-semibold text-slate-400">{column.subtitle}</p>
                )}
              </div>
            </div>

            {column.isToday && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700">
                {isRtl ? 'اليوم' : 'Today'}
              </span>
            )}
          </div>
        );})}
      </div>

      <div className="relative" style={{ minHeight: `${slotCount * slotHeight}px` }}>
        {currentTimeLinePosition !== null && (
          <div
            className="pointer-events-none absolute inset-x-0 z-20"
            style={{ top: `${currentTimeLinePosition}px` }}
          >
            <div className="relative h-px bg-rose-500 shadow-[0_0_0_1px_rgba(244,63,94,0.18)]">
              <div className={`absolute -top-2 ${isRtl ? 'left-3' : 'right-3'} flex items-center gap-2`}>
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.18)]" />
                <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-black text-white shadow-lg">
                  {isRtl ? 'الوقت الحالي' : 'Current Time'}{' '}
                  {new Intl.DateTimeFormat(isRtl ? 'ar-SA' : 'en-US', {
                    timeZone: 'Asia/Riyadh',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  }).format(boardCurrentTime)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="relative">
          {rows.map((row) => {
            const hourBoundary = row.slotIndex % slotsPerHour === 0;
            const rowLabel = hourBoundary ? formatSlotTime(row.startMinutes, startHour, isRtl) : '';
            return (
              <div
                key={row.slotIndex}
                className="grid"
                style={{ gridTemplateColumns, height: `${slotHeight}px` }}
              >
                <div
                  className={`relative flex items-start justify-center pr-2 text-[10px] font-black font-mono tracking-tight text-slate-400 bg-slate-50/60 border-r border-slate-200 ${hourBoundary ? 'border-b border-slate-200' : 'border-b border-slate-100/80'}`}
                  style={{ width: timeColumnWidth }}
                >
                  {hourBoundary && <span className="mt-[-1px]">{rowLabel}</span>}
                </div>

                {columns.map((column, columnIndex) => {
                  const slot = resolveSlot(column, columnIndex, row.slotIndex);
                  const isHovered = hoveredSlot?.columnId === slot.columnId && hoveredSlot.slotIndex === slot.slotIndex;
                  const isSelected = isSlotInsideSelection(slot);
                  const laneShade = columnIndex % 2 === 0 ? 'bg-slate-50/70' : 'bg-white';
                  return (
                    <button
                      key={`${column.id}-${row.slotIndex}`}
                      type="button"
                      data-slot-index={slot.slotIndex}
                      data-column-id={slot.columnId}
                      data-date-key={slot.dateKey}
                      data-start-minutes={slot.startMinutes}
                      data-end-minutes={slot.endMinutes}
                      className={`${slotCellClassName(hourBoundary, isHovered || isSelected)} ${laneShade} ${isHovered ? 'ring-1 ring-inset ring-amber-400/50 bg-amber-500/10' : ''} ${isSelected ? 'bg-amber-500/12' : ''}`}
                      style={{ height: `${slotHeight}px` }}
                      aria-label={`${column.title} ${formatSlotTime(slot.startMinutes, startHour, isRtl)}`}
                      onMouseDown={(event) => {
                        if (!isEditable || event.button !== 0) return;
                        setSelectionAnchor(slot);
                        setSelectionFocus(slot);
                        onAddSlotHover?.(slot);
                      }}
                      onMouseEnter={() => {
                        if (selectionAnchor && isSameAxis(selectionAnchor, slot)) {
                          setSelectionFocus(slot);
                        }
                        setHoveredSlot(slot);
                        onAddSlotHover?.(slot);
                      }}
                      onMouseUp={() => {
                        if (!isEditable) return;
                        commitSelection();
                      }}
                      onMouseLeave={() => {
                        setHoveredSlot((current) => (current?.columnId === slot.columnId && current.slotIndex === slot.slotIndex ? null : current));
                        onAddSlotHover?.(null);
                      }}
                      onClick={(event) => {
                        if (!isEditable) return;
                        if (suppressNextClickRef.current) {
                          suppressNextClickRef.current = false;
                          event.preventDefault();
                          event.stopPropagation();
                          return;
                        }
                        onSlotClick?.(slot);
                        event.stopPropagation();
                      }}
                      onContextMenu={(event) => {
                        if (!isEditable) return;
                        event.preventDefault();
                        event.stopPropagation();
                        onSlotContextMenu?.(event, slot);
                      }}
                      onDragOver={(event) => {
                        if (!isEditable) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setHoveredSlot(slot);
                        onAddSlotHover?.(slot);
                      }}
                      onDrop={(event) => {
                        if (!isEditable) return;
                        event.preventDefault();
                        const draggedEventId = event.dataTransfer.getData('text/plain');
                        if (draggedEventId) {
                          onSlotDrop?.(slot, draggedEventId);
                        }
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-0 z-10">
          {positionedEvents.map((event) => {
            const columnIndex = getColumnIndex(event.columnId);
            if (columnIndex === -1) return null;

            const slotIndex = Math.max(0, Math.round(event.startMinutes / slotMinutes));
            const durationSlots = Math.max(1, Math.ceil(Math.max(event.durationMinutes, slotMinutes) / slotMinutes));
            const top = slotIndex * slotHeight;
            const height = durationSlots * slotHeight;
            const columnWidth = 100 / Math.max(columns.length, 1);
            const laneWidth = columnWidth / Math.max(1, event.laneCount);
            const left = `calc(${columnIndex * columnWidth}% + ${event.laneIndex * laneWidth}%)`;
            const serviceStyles = getServiceCategoryStyles(event.serviceCategory || event.raw?.service?.category);
            const customerAvatar = event.avatar || event.raw?.user?.photo || event.raw?.user?.profileImage || null;
            const staffAvatar = event.staffAvatar || event.raw?.staff?.photo || null;
            const assignedStaffName = event.assignedStaffName || event.raw?.staff?.name || event.role || '';
            const assignedStaffRole = event.assignedStaffRole || event.role || '';
            const variantLabel = event.variantLabel || event.raw?.serviceVariantName || event.raw?.serviceVariantDescription || '';
            const variantDescription = event.variantDescription || event.raw?.serviceVariantDescription || '';
            const isCompact = height < 38;
            const isMedium = height >= 38 && height < 58;

            const styleVariant = event.kind === 'blocked'
              ? 'bg-slate-50 text-slate-500 border-slate-200'
              : event.status === 'completed'
                ? 'bg-zinc-100 text-zinc-700 border-zinc-200'
                : event.paymentStatus === 'paid'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : event.paymentStatus === 'partial'
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200';

            return (
              <div
                key={event.id}
                className="absolute"
                style={{
                  left,
                  width: `calc(${laneWidth}% - 8px)`,
                  top: `${top}px`,
                  height: `${height}px`,
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  draggable={isEditable && event.kind !== 'blocked'}
                  onDragStart={(dragEvent) => {
                    if (!isEditable || event.kind === 'blocked') return;
                    dragEvent.dataTransfer.setData('text/plain', event.id);
                    onEventDragStart?.(event);
                  }}
                  onDragEnd={() => {
                    if (!isEditable || event.kind === 'blocked') return;
                    onEventDragEnd?.(event);
                  }}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    onEventClick?.(event);
                  }}
                  onContextMenu={(contextEvent) => {
                    if (!isEditable) return;
                    contextEvent.preventDefault();
                    contextEvent.stopPropagation();
                    onEventContextMenu?.(contextEvent, event);
                  }}
                  className={`pointer-events-auto relative flex h-full flex-col justify-between overflow-hidden rounded-xl border p-2 shadow-xs transition-all ${styleVariant} ${event.kind !== 'blocked' ? serviceStyles.card : ''} ${isEditable && event.kind !== 'blocked' ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'cursor-default'}`}
                >
                  {event.kind !== 'blocked' && (
                    <div className={`absolute inset-x-0 top-0 h-1 ${serviceStyles.accent}`} />
                  )}

                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[10px] font-black ${serviceStyles.avatar}`}>
                        {customerAvatar ? (
                          <img src={customerAvatar} alt={event.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span>{getInitials(event.title)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-black leading-tight text-slate-900">
                          {event.title}
                        </p>
                        {!isCompact && (
                          <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
                            <span className={`max-w-full truncate rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${serviceStyles.badge}`}>
                              {event.subtitle || 'Service'}
                            </span>
                            {variantLabel && (
                              <span className="truncate text-[9px] font-semibold text-slate-500">
                                {variantLabel}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded bg-zinc-900/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tight text-slate-700">
                        {formatSlotTime(event.startMinutes, startHour, isRtl)}
                      </span>
                      {!isCompact && (
                        <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${
                          event.kind === 'blocked'
                            ? 'border-slate-200 bg-slate-50 text-slate-600'
                            : event.status === 'completed'
                              ? 'border-zinc-200 bg-zinc-100 text-zinc-700'
                              : event.status === 'cancelled'
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                        }`}>
                          {formatAppointmentStatusLabel(event.status, event.kind)}
                        </span>
                      )}
                      {!isCompact && event.kind !== 'blocked' && (
                        <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${event.paymentStatus === 'paid'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : event.paymentStatus === 'partial'
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-rose-200 bg-rose-50 text-rose-700'
                        }`}>
                          {event.paymentStatus === 'paid' ? 'Paid' : event.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
                        </span>
                      )}
                    </div>
                  </div>

                  {!isCompact && (
                    <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-[9px]">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {staffAvatar ? (
                          <div className="h-4 w-4 shrink-0 overflow-hidden rounded-full border border-white shadow-sm">
                            <img src={staffAvatar} alt={assignedStaffName || 'Staff'} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ) : assignedStaffName ? (
                          <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[7px] font-black text-slate-600">
                            {getInitials(assignedStaffName)}
                          </div>
                        ) : null}
                        <span className="truncate font-bold text-slate-600">
                          {assignedStaffName || (event.kind === 'blocked' ? (event.blockedType || 'Blocked') : 'Unassigned')}
                        </span>
                        {assignedStaffRole && (
                          <span className="truncate text-slate-400">
                            · {assignedStaffRole}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {event.isGroupBooking && (
                          <span className="flex items-center gap-0.5 rounded bg-zinc-900/10 px-1 py-0.5 text-[8px] font-bold text-slate-600">
                            <Users size={9} />
                            <span>{event.guestCount || 2}</span>
                          </span>
                        )}
                        {typeof event.price === 'number' && (
                          <span className="font-black font-mono text-slate-700">
                            {event.price}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {isMedium && variantDescription && (
                    <p className="mt-1 truncate text-[8px] italic text-slate-500">
                      {variantDescription}
                    </p>
                  )}

                  {!isCompact && event.notes && (
                    <p className={`mt-1 truncate text-[9px] italic ${event.kind === 'blocked' ? 'text-slate-500' : 'text-slate-500'}`}>
                      "{event.notes}"
                    </p>
                  )}

                  {isCompact && (
                    <div className="mt-1 flex items-center justify-between gap-1 text-[8px] font-bold text-slate-500">
                      <span className="truncate">
                        {event.subtitle || variantLabel || formatAppointmentStatusLabel(event.status, event.kind)}
                      </span>
                      {typeof event.price === 'number' && <span className="font-mono text-slate-700">{event.price}</span>}
                    </div>
                  )}

                  {isEditable && event.kind !== 'blocked' && (
                    <button
                      type="button"
                      className="pointer-events-auto absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize bg-black/5 hover:bg-black/15"
                      onMouseDown={(mouseEvent) => onEventResizeStart?.(event, mouseEvent)}
                      aria-label="Resize appointment"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
