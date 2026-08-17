import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Users, ChevronDown, Link2 } from 'lucide-react';

export type SchedulerViewMode = 'day' | 'week' | 'agenda' | 'team-day' | 'team-week' | 'employee-day' | 'employee-week';

export interface SchedulerColumn {
  id: string;
  kind?: 'employee' | 'day';
  resourceId?: string;
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
  resourceId?: string;
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
  normalEndHour?: number;
  timeColumnWidth?: number;
  slotHeight?: number;
  staffColumnWidth?: number;
  showCurrentTimeIndicator?: boolean;
  showLunchBreaks?: boolean;
  showStaffPhotos?: boolean;
  showAppointmentStatusBadges?: boolean;
  onSlotContextMenu?: (event: React.MouseEvent, slot: SchedulerSlot) => void;
  onSlotDrop?: (slot: SchedulerSlot, draggedEventId: string) => void;
  onSlotRangeSelect?: (range: SchedulerSlotRange) => void;
  onEventClick?: (event: SchedulerEvent) => void;
  onEventContextMenu?: (event: React.MouseEvent, schedulerEvent: SchedulerEvent) => void;
  onEventDragStart?: (schedulerEvent: SchedulerEvent) => void;
  onEventDragEnd?: (schedulerEvent: SchedulerEvent) => void;
  onEventResizeStart?: (schedulerEvent: SchedulerEvent, event: React.MouseEvent) => void;
  onAddSlotHover?: (slot: SchedulerSlot | null) => void;
  onColumnHeaderClick?: (event: React.MouseEvent<HTMLElement>, columnId: string) => void;
  onColumnHeaderContextMenu?: (event: React.MouseEvent<HTMLElement>, columnId: string) => void;
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

const getInitials = (value?: string | null) => {
  const words = `${value || ''}`.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '•';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
};

const formatAppointmentStatusLabel = (status?: string | null, kind?: SchedulerEvent['kind']) => {
  if (kind === 'blocked') {
    return 'Blocked';
  }
  const normalized = normalizeAppointmentStatus(status);
  if (normalized === 'booked') return 'Booked';
  if (normalized === 'confirmed') return 'Confirmed';
  if (normalized === 'arrived') return 'Arrived';
  if (normalized === 'started') return 'Started';
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'cancelled') return 'Cancelled';
  if (normalized === 'no_show') return 'No Show';
  return 'Booked';
};

type AppointmentStatusKey = 'booked' | 'confirmed' | 'arrived' | 'started' | 'completed' | 'no_show' | 'cancelled' | 'blocked';

type AppointmentStatusTheme = {
  shell: string;
  accent: string;
  primaryText: string;
  secondaryText: string;
  mutedText: string;
  serviceBadge: string;
  statusBadge: string;
  paymentBadgePaid: string;
  paymentBadgePartial: string;
  paymentBadgeUnpaid: string;
  staffAvatar: string;
};

const normalizeAppointmentStatus = (status?: string | null, kind?: SchedulerEvent['kind']): AppointmentStatusKey => {
  if (kind === 'blocked') {
    return 'blocked';
  }

  const normalized = `${status || ''}`.trim().toLowerCase();
  if (!normalized || normalized === 'pending' || normalized === 'booked') return 'booked';
  if (['confirmed', 'scheduled'].includes(normalized)) return 'confirmed';
  if (['checked_in', 'checked-in', 'arrived'].includes(normalized)) return 'arrived';
  if (['in_service', 'in-service', 'started'].includes(normalized)) return 'started';
  if (normalized === 'completed' || normalized === 'done' || normalized === 'served') return 'completed';
  if (['cancelled', 'canceled'].includes(normalized)) return 'cancelled';
  if (['no_show', 'no-show', 'noshow'].includes(normalized)) return 'no_show';
  return 'booked';
};

const getAppointmentStatusTheme = (status?: string | null, kind?: SchedulerEvent['kind']): AppointmentStatusTheme => {
  const normalized = normalizeAppointmentStatus(status, kind);

  switch (normalized) {
    case 'blocked':
      return {
        shell: 'bg-slate-50 border-slate-200 text-slate-700',
        accent: 'bg-slate-400',
        primaryText: 'text-slate-900',
        secondaryText: 'text-slate-500',
        mutedText: 'text-slate-400',
        serviceBadge: 'border-slate-200 bg-slate-100 text-slate-700',
        statusBadge: 'border-slate-200 bg-slate-100 text-slate-700',
        paymentBadgePaid: 'border-slate-200 bg-slate-100 text-slate-700',
        paymentBadgePartial: 'border-slate-200 bg-slate-100 text-slate-700',
        paymentBadgeUnpaid: 'border-slate-200 bg-slate-100 text-slate-700',
        staffAvatar: 'border-slate-200 bg-white text-slate-600',
      };
    case 'confirmed':
      return {
        shell: 'bg-amber-50 border-amber-200 text-amber-950',
        accent: 'bg-amber-500',
        primaryText: 'text-amber-950',
        secondaryText: 'text-amber-800/90',
        mutedText: 'text-amber-700/70',
        serviceBadge: 'border-amber-200 bg-amber-100 text-amber-800',
        statusBadge: 'border-amber-200 bg-amber-100 text-amber-800',
        paymentBadgePaid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        paymentBadgePartial: 'border-amber-200 bg-amber-100 text-amber-800',
        paymentBadgeUnpaid: 'border-rose-200 bg-rose-50 text-rose-700',
        staffAvatar: 'border-amber-200 bg-white text-amber-800',
      };
    case 'arrived':
      return {
        shell: 'bg-emerald-50 border-emerald-200 text-emerald-950',
        accent: 'bg-emerald-500',
        primaryText: 'text-emerald-950',
        secondaryText: 'text-emerald-800/90',
        mutedText: 'text-emerald-700/70',
        serviceBadge: 'border-emerald-200 bg-emerald-100 text-emerald-800',
        statusBadge: 'border-emerald-200 bg-emerald-100 text-emerald-800',
        paymentBadgePaid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        paymentBadgePartial: 'border-amber-200 bg-amber-100 text-amber-800',
        paymentBadgeUnpaid: 'border-rose-200 bg-rose-50 text-rose-700',
        staffAvatar: 'border-emerald-200 bg-white text-emerald-800',
      };
    case 'started':
      return {
        shell: 'bg-indigo-50 border-indigo-200 text-indigo-950',
        accent: 'bg-indigo-500',
        primaryText: 'text-indigo-950',
        secondaryText: 'text-indigo-800/90',
        mutedText: 'text-indigo-700/70',
        serviceBadge: 'border-indigo-200 bg-indigo-100 text-indigo-800',
        statusBadge: 'border-indigo-200 bg-indigo-100 text-indigo-800',
        paymentBadgePaid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        paymentBadgePartial: 'border-amber-200 bg-amber-100 text-amber-800',
        paymentBadgeUnpaid: 'border-rose-200 bg-rose-50 text-rose-700',
        staffAvatar: 'border-indigo-200 bg-white text-indigo-800',
      };
    case 'completed':
      return {
        shell: 'bg-zinc-100 border-zinc-300 text-zinc-800',
        accent: 'bg-zinc-500',
        primaryText: 'text-zinc-800',
        secondaryText: 'text-zinc-600',
        mutedText: 'text-zinc-500',
        serviceBadge: 'border-zinc-200 bg-white text-zinc-700',
        statusBadge: 'border-zinc-200 bg-zinc-50 text-zinc-700',
        paymentBadgePaid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        paymentBadgePartial: 'border-amber-200 bg-amber-100 text-amber-800',
        paymentBadgeUnpaid: 'border-rose-200 bg-rose-50 text-rose-700',
        staffAvatar: 'border-zinc-200 bg-white text-zinc-700',
      };
    case 'cancelled':
      return {
        shell: 'bg-rose-50 border-rose-200 text-rose-950',
        accent: 'bg-rose-500',
        primaryText: 'text-rose-950',
        secondaryText: 'text-rose-800/90',
        mutedText: 'text-rose-700/70',
        serviceBadge: 'border-rose-200 bg-rose-100 text-rose-800',
        statusBadge: 'border-rose-200 bg-rose-100 text-rose-800',
        paymentBadgePaid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        paymentBadgePartial: 'border-amber-200 bg-amber-100 text-amber-800',
        paymentBadgeUnpaid: 'border-rose-200 bg-rose-100 text-rose-800',
        staffAvatar: 'border-rose-200 bg-white text-rose-800',
      };
    case 'no_show':
      return {
        shell: 'bg-slate-800 border-slate-700 text-slate-50',
        accent: 'bg-slate-300',
        primaryText: 'text-white',
        secondaryText: 'text-slate-200',
        mutedText: 'text-slate-300',
        serviceBadge: 'border-white/15 bg-white/10 text-white',
        statusBadge: 'border-white/15 bg-white/10 text-white',
        paymentBadgePaid: 'border-white/15 bg-white/10 text-white',
        paymentBadgePartial: 'border-white/15 bg-white/10 text-white',
        paymentBadgeUnpaid: 'border-white/15 bg-white/10 text-white',
        staffAvatar: 'border-white/20 bg-white/10 text-white',
      };
    case 'booked':
    default:
      return {
        shell: 'bg-slate-50 border-slate-200 text-slate-900',
        accent: 'bg-slate-400',
        primaryText: 'text-slate-900',
        secondaryText: 'text-slate-600',
        mutedText: 'text-slate-500',
        serviceBadge: 'border-slate-200 bg-white text-slate-700',
        statusBadge: 'border-slate-200 bg-slate-100 text-slate-700',
        paymentBadgePaid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        paymentBadgePartial: 'border-amber-200 bg-amber-100 text-amber-800',
        paymentBadgeUnpaid: 'border-rose-200 bg-rose-50 text-rose-700',
        staffAvatar: 'border-slate-200 bg-white text-slate-600',
      };
  }
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

const CHAIN_COLORS = [
  { border: 'border-purple-400/80', ring: 'ring-purple-400/80', shadow: 'shadow-purple-500/20', text: 'text-purple-500/90' },
  { border: 'border-cyan-400/80', ring: 'ring-cyan-400/80', shadow: 'shadow-cyan-500/20', text: 'text-cyan-500/90' },
  { border: 'border-emerald-400/80', ring: 'ring-emerald-400/80', shadow: 'shadow-emerald-500/20', text: 'text-emerald-500/90' },
  { border: 'border-pink-400/80', ring: 'ring-pink-400/80', shadow: 'shadow-pink-500/20', text: 'text-pink-500/90' },
  { border: 'border-blue-400/80', ring: 'ring-blue-400/80', shadow: 'shadow-blue-500/20', text: 'text-blue-500/90' },
  { border: 'border-orange-400/80', ring: 'ring-orange-400/80', shadow: 'shadow-orange-500/20', text: 'text-orange-500/90' },
  { border: 'border-rose-400/80', ring: 'ring-rose-400/80', shadow: 'shadow-rose-500/20', text: 'text-rose-500/90' },
  { border: 'border-teal-400/80', ring: 'ring-teal-400/80', shadow: 'shadow-teal-500/20', text: 'text-teal-500/90' }
];

const getChainColor = (sessionId: string) => {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = sessionId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CHAIN_COLORS[Math.abs(hash) % CHAIN_COLORS.length];
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
  normalEndHour,
  timeColumnWidth = DEFAULT_TIME_COLUMN_WIDTH,
  slotHeight = DEFAULT_SLOT_HEIGHT,
  staffColumnWidth = 200,
  showCurrentTimeIndicator = true,
  showLunchBreaks = true,
  showStaffPhotos = true,
  showAppointmentStatusBadges = true,
  onSlotContextMenu,
  onSlotDrop,
  onEventClick,
  onEventContextMenu,
  onEventDragStart,
  onEventDragEnd,
  onEventResizeStart,
  onAddSlotHover,
  onSlotRangeSelect,
  onColumnHeaderClick,
  onColumnHeaderContextMenu,
}: SchedulerGridProps) {
  const [hoveredSlot, setHoveredSlot] = useState<SchedulerSlot | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  const [selectionAnchor, setSelectionAnchor] = useState<SchedulerSlot | null>(null);
  const [selectionFocus, setSelectionFocus] = useState<SchedulerSlot | null>(null);
  const suppressNextClickRef = useRef(false);
  const slotsPerHour = 60 / slotMinutes;
  const slotCount = Math.max(1, Math.round(((endHour - startHour) * 60) / slotMinutes));
  const gridTemplateColumns = useMemo(
    () => `${timeColumnWidth}px repeat(${Math.max(columns.length, 1)}, ${Math.max(50, staffColumnWidth)}px)`,
    [columns.length, staffColumnWidth, timeColumnWidth]
  );
  const visibleDateKey = getRiyadhDateKey(boardCurrentTime);
  const currentMinutesSinceMidnight = getRiyadhMinutesSinceMidnight(boardCurrentTime);
  const isDayBoardMode = viewMode === 'day' || viewMode === 'team-day' || viewMode === 'employee-day';
  const normalizedNormalEndHour = Math.max(startHour + 1, Math.min(endHour, normalEndHour ?? endHour));
  const currentTimeLinePosition = showCurrentTimeIndicator && isDayBoardMode && visibleDateKey === selectedDateKey && currentMinutesSinceMidnight >= startHour * 60 && currentMinutesSinceMidnight <= endHour * 60
    ? ((currentMinutesSinceMidnight - (startHour * 60)) / slotMinutes) * slotHeight
    : null;
  const pastAreaHeight = currentTimeLinePosition !== null ? Math.max(0, currentTimeLinePosition) : null;
  const showAssignedStaffIdentity = !isDayBoardMode;
  const eventLayerInsetStyle = isRtl
    ? {
        right: `${timeColumnWidth}px`,
        left: 0,
      }
    : {
        left: `${timeColumnWidth}px`,
        right: 0,
      };

  const rows = useMemo(() => Array.from({ length: slotCount }, (_, slotIndex) => {
    const startMinutes = slotIndex * slotMinutes;
    const endMinutes = startMinutes + slotMinutes;
    return { slotIndex, startMinutes, endMinutes };
  }), [slotCount, slotMinutes]);

  const resolveSlot = (column: SchedulerColumn, columnIndex: number, slotIndex: number): SchedulerSlot => {
    const startMinutes = slotIndex * slotMinutes;
    const endMinutes = (slotIndex + 1) * slotMinutes;
    const resourceId = `${column.resourceId || column.id}`.replace(/^(employee:|day:)/, '');
    return {
      columnId: column.id,
      dateKey: column.dateKey || selectedDateKey,
      employeeId: column.kind === 'employee' ? resourceId : '',
      resourceId,
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

  const chainedSessionColors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ev of positionedEvents) {
        if (ev.kind !== 'appointment' || !ev.raw?.bookingSessionId) continue;
        const sid = ev.raw.bookingSessionId;
        counts.set(sid, (counts.get(sid) || 0) + 1);
    }
    const chained = new Map<string, typeof CHAIN_COLORS[0]>();
    for (const [sid, count] of counts.entries()) {
        if (count > 1) {
            chained.set(sid, getChainColor(sid));
        }
    }
    return chained;
  }, [positionedEvents]);

  const chainConnectors = useMemo(() => {
    const groups = new Map<string, typeof positionedEvents>();
    for (const ev of positionedEvents) {
        if (ev.kind !== 'appointment' || !ev.raw?.bookingSessionId) continue;
        const sid = ev.raw.bookingSessionId;
        if (!groups.has(sid)) groups.set(sid, []);
        groups.get(sid)!.push(ev);
    }
    
    const lines: Array<{
      key: string;
      x1: number; y1: number;
      x2: number; y2: number;
      isSameColumn: boolean;
    }> = [];
    
    Array.from(groups.values()).forEach(group => {
        if (group.length <= 1) return;
        
        // Sort chronologically
        group.sort((a,b) => a.startMinutes - b.startMinutes);
        
        for (let i = 0; i < group.length - 1; i++) {
            const ev1 = group[i];
            const ev2 = group[i+1];
            
            const colIdx1 = getColumnIndex(ev1.columnId);
            const colIdx2 = getColumnIndex(ev2.columnId);
            if (colIdx1 === -1 || colIdx2 === -1) continue;
            
            const cellWidth = Math.max(50, staffColumnWidth);
            
            // Calc x1, y1
            const top1 = (Math.max(0, ev1.startMinutes) / slotMinutes) * slotHeight;
            const height1 = Math.max(slotHeight, (Math.max(ev1.durationMinutes, slotMinutes) / slotMinutes) * slotHeight);
            const laneWidthPx1 = cellWidth / Math.max(1, ev1.laneCount);
            const eventCardWidth1 = laneWidthPx1 - 8;
            const inlineStart1 = (colIdx1 * cellWidth) + (ev1.laneIndex * laneWidthPx1);
            const cx1 = inlineStart1 + (eventCardWidth1 / 2);
            const y1 = top1 + height1;
            
            // Calc x2, y2
            const top2 = (Math.max(0, ev2.startMinutes) / slotMinutes) * slotHeight;
            const laneWidthPx2 = cellWidth / Math.max(1, ev2.laneCount);
            const eventCardWidth2 = laneWidthPx2 - 8;
            const inlineStart2 = (colIdx2 * cellWidth) + (ev2.laneIndex * laneWidthPx2);
            const cx2 = inlineStart2 + (eventCardWidth2 / 2);
            const y2 = top2;
            
            lines.push({
                key: `chain-${ev1.id}-${ev2.id}`,
                x1: cx1,
                y1,
                x2: cx2,
                y2,
                isSameColumn: colIdx1 === colIdx2
            });
        }
    });
    
    return lines;
  }, [positionedEvents, slotMinutes, slotHeight, staffColumnWidth, getColumnIndex]);

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm overflow-visible" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="sticky top-0 z-50 grid border-b border-slate-200 bg-slate-50/95 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-sm" style={{ gridTemplateColumns, minWidth: 'min-content' }}>
        <div
          className="flex items-center justify-center border-r border-slate-200 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 bg-slate-50"
          style={{ width: timeColumnWidth }}
        >
          {isRtl ? 'الفترة' : 'Time'}
        </div>

        {columns.map((column, columnIndex) => {
          const isActiveLane = hoveredSlot?.columnId === column.id;
          const laneShade = columnIndex % 2 === 0 ? 'bg-slate-50/80' : 'bg-white';
          const isEmployeeHeader = column.kind === 'employee';
          const headerResourceId = column.resourceId || column.id;
          return (
          <div
            key={column.id}
            onClick={isEmployeeHeader ? (e) => onColumnHeaderClick?.(e, headerResourceId) : undefined}
            onContextMenu={isEmployeeHeader ? (e) => onColumnHeaderContextMenu?.(e, headerResourceId) : undefined}
            className={`min-w-0 overflow-hidden border-r last:border-r-0 border-slate-200 px-1.5 py-2 flex items-center justify-between gap-1 transition-colors ${laneShade} ${column.isToday ? 'bg-amber-500/10' : ''} ${isActiveLane ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-400/50' : ''} ${isEmployeeHeader && (onColumnHeaderClick || onColumnHeaderContextMenu) ? 'cursor-pointer hover:bg-slate-100' : ''}`}
          >
            <div className="min-w-0 flex items-center gap-2">
              {column.avatar ? (
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                  <img src={column.avatar} alt={column.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className={`h-8 w-8 shrink-0 rounded-full text-[10px] font-black text-white flex items-center justify-center ${toneClasses[column.statusTone || 'neutral']}`}>
                  {String(column.title || '•').charAt(0).toUpperCase()}
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

            <div className="flex items-center gap-2">
              {column.isToday && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700">
                  {isRtl ? 'اليوم' : 'Today'}
                </span>
              )}
              {isEmployeeHeader && (onColumnHeaderClick || onColumnHeaderContextMenu) && (
                <ChevronDown size={14} className="text-slate-400 opacity-60 shrink-0" />
              )}
            </div>
          </div>
        );})}
      </div>

      <div className="relative isolate" style={{ minHeight: `${slotCount * slotHeight}px`, minWidth: 'min-content' }}>
        {pastAreaHeight !== null && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[5]"
            style={{ height: `${pastAreaHeight}px` }}
          >
            <div className="h-full bg-slate-200/80" />
          </div>
        )}

        {normalEndHour !== undefined && normalEndHour < endHour && (
          <div
            className="pointer-events-none absolute inset-x-0 z-[6]"
            style={{ top: `${Math.max(0, ((normalizedNormalEndHour - startHour) * 60 / slotMinutes) * slotHeight)}px` }}
          >
            <div className="relative h-0 border-t border-dashed border-slate-400/70">
              <span
                className="absolute -top-2 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500 shadow-sm"
                style={isRtl ? { right: '0.75rem' } : { left: '0.75rem' }}
              >
                {isRtl ? 'ساعات ممتدة' : 'Extended Hours'}
              </span>
            </div>
          </div>
        )}

        {currentTimeLinePosition !== null && (
          <div
            className="pointer-events-none absolute inset-x-0 z-20"
            style={{ top: `${currentTimeLinePosition}px` }}
          >
            <div className="relative h-px bg-rose-500 shadow-[0_0_0_1px_rgba(244,63,94,0.18)]">
              <div
                className="absolute -top-2 flex items-center gap-2"
                style={isRtl ? { right: '0.75rem' } : { left: '0.75rem' }}
              >
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

        <div className="relative z-10">
          {rows.map((row) => {
            const hourBoundary = row.slotIndex % slotsPerHour === 0;
            const rowLabel = hourBoundary ? formatSlotTime(row.startMinutes, startHour, isRtl) : '';
            const isExtendedHourRow = normalEndHour !== undefined && row.startMinutes >= (normalizedNormalEndHour - startHour) * 60;
            return (
              <div
                key={row.slotIndex}
                className="grid"
                style={{ gridTemplateColumns, height: `${slotHeight}px`, minWidth: 'min-content' }}
              >
                <div
                  className={`relative flex items-start justify-center pr-2 text-[10px] font-black font-mono tracking-tight text-slate-400 ${isExtendedHourRow ? 'bg-slate-100/80' : 'bg-slate-50/60'} border-r border-slate-200 ${hourBoundary ? 'border-b border-slate-200' : 'border-b border-slate-100/80'}`}
                  style={{ width: timeColumnWidth }}
                >
                  {hourBoundary && <span className="mt-[-1px]">{rowLabel}</span>}
                </div>

                {columns.map((column, columnIndex) => {
                  const slot = resolveSlot(column, columnIndex, row.slotIndex);
                  const isHovered = hoveredSlot?.columnId === slot.columnId && hoveredSlot.slotIndex === slot.slotIndex;
                  const isSelected = isSlotInsideSelection(slot);
                  const laneShade = isExtendedHourRow
                    ? (columnIndex % 2 === 0 ? 'bg-slate-100/80' : 'bg-slate-50/80')
                    : (columnIndex % 2 === 0 ? 'bg-slate-50/70' : 'bg-white');
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
                      onMouseEnter={(event) => {
                        if (selectionAnchor && isSameAxis(selectionAnchor, slot)) {
                          setSelectionFocus(slot);
                        }
                        setHoveredSlot(slot);
                        setHoverTooltip({
                          x: event.clientX,
                          y: event.clientY,
                          label: formatSlotTime(slot.startMinutes, startHour, isRtl),
                        });
                        onAddSlotHover?.(slot);
                      }}
                      onMouseMove={(event) => {
                        setHoverTooltip({
                          x: event.clientX,
                          y: event.clientY,
                          label: formatSlotTime(slot.startMinutes, startHour, isRtl),
                        });
                      }}
                      onMouseUp={() => {
                        if (!isEditable) return;
                        commitSelection();
                      }}
                      onMouseLeave={() => {
                        setHoveredSlot((current) => (current?.columnId === slot.columnId && current.slotIndex === slot.slotIndex ? null : current));
                        setHoverTooltip(null);
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
                        event.preventDefault();
                        event.stopPropagation();
                        // Unify click behavior: left click opens the context menu
                        onSlotContextMenu?.(event, slot);
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

        <div
          className="pointer-events-none absolute inset-y-0 z-20 overflow-hidden"
          style={eventLayerInsetStyle}
        >
          {positionedEvents.map((event) => {
            const columnIndex = getColumnIndex(event.columnId);
            if (columnIndex === -1) return null;

            const top = (Math.max(0, event.startMinutes) / slotMinutes) * slotHeight;
            const height = Math.max(slotHeight, (Math.max(event.durationMinutes, slotMinutes) / slotMinutes) * slotHeight);
            const cellWidth = Math.max(50, staffColumnWidth);
            const laneWidthPx = cellWidth / Math.max(1, event.laneCount);
            const inlineStart = `calc(${columnIndex * cellWidth}px + ${event.laneIndex * laneWidthPx}px)`;
            const statusTheme = getAppointmentStatusTheme(event.status, event.kind);
            const customerAvatar = event.avatar || event.raw?.user?.photo || event.raw?.user?.profileImage || null;
            const staffAvatar = event.staffAvatar || event.raw?.staff?.photo || null;
            const assignedStaffName = event.assignedStaffName || event.raw?.staff?.name || event.role || '';
            const assignedStaffRole = event.assignedStaffRole || event.role || '';
            const variantLabel = event.variantLabel || event.raw?.serviceVariantName || event.raw?.serviceVariantDescription || '';
            const variantDescription = event.variantDescription || event.raw?.serviceVariantDescription || '';
            const isCompact = height < 42;
            const isMedium = height >= 42 && height < 64;
            const showStatusMeta = showAppointmentStatusBadges;
            
            const chainColor = (event.kind === 'appointment' && event.raw?.bookingSessionId) ? chainedSessionColors.get(event.raw.bookingSessionId) : null;

            return (
              <div
                key={event.id}
              className="absolute"
              style={{
                  ...(isRtl ? { right: inlineStart } : { left: inlineStart }),
                  width: `calc(${laneWidthPx}px - 8px)`,
                  maxWidth: `calc(${laneWidthPx}px - 8px)`,
                  top: `${top}px`,
                  height: `${height}px`,
                  maxHeight: '100%',
                  boxSizing: 'border-box',
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
                  className={`pointer-events-auto relative flex h-full min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-xl border p-2 shadow-xs transition-all ${statusTheme.shell} ${isEditable && event.kind !== 'blocked' ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'cursor-default'} ${chainColor ? `ring-2 ${chainColor.ring} ${chainColor.shadow}` : ''}`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${statusTheme.accent}`} />

                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[10px] font-black ${statusTheme.staffAvatar}`}>
                        {customerAvatar ? (
                          <img src={customerAvatar} alt={event.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span>{getInitials(event.title)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[11px] font-black leading-tight ${statusTheme.primaryText}`}>
                          {event.title}
                        </p>
                        {!isCompact && (
                          <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
                            <span className={`max-w-full truncate rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${statusTheme.serviceBadge}`}>
                              {event.subtitle || 'Service'}
                            </span>
                            {variantLabel && (
                              <span className={`truncate text-[9px] font-semibold ${statusTheme.secondaryText}`}>
                                {variantLabel}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tight ${statusTheme.statusBadge}`}>
                        {formatSlotTime(event.startMinutes, startHour, isRtl)}
                      </span>
                      {!isCompact && showStatusMeta && (
                        <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${statusTheme.statusBadge}`}>
                          {formatAppointmentStatusLabel(event.status, event.kind)}
                        </span>
                      )}
                      {!isCompact && event.kind !== 'blocked' && showStatusMeta && (
                        <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${
                          event.paymentStatus === 'paid'
                            ? statusTheme.paymentBadgePaid
                            : event.paymentStatus === 'partial'
                              ? statusTheme.paymentBadgePartial
                              : statusTheme.paymentBadgeUnpaid
                        }`}>
                          {event.paymentStatus === 'paid' ? 'Paid' : event.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
                        </span>
                      )}
                    </div>
                  </div>

                  {!isCompact && (showStaffPhotos || assignedStaffName || assignedStaffRole) && (
                    <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-[9px]">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {showStaffPhotos && staffAvatar ? (
                          <div className={`h-4 w-4 shrink-0 overflow-hidden rounded-full border shadow-sm ${statusTheme.staffAvatar}`}>
                            <img src={staffAvatar} alt={assignedStaffName || 'Staff'} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ) : assignedStaffName ? (
                          <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[7px] font-black ${statusTheme.staffAvatar}`}>
                            {getInitials(assignedStaffName)}
                          </div>
                        ) : null}
                        <span className={`truncate font-bold ${statusTheme.secondaryText}`}>
                          {assignedStaffName || (event.kind === 'blocked' ? (event.blockedType || 'Blocked') : 'Unassigned')}
                        </span>
                        {assignedStaffRole && (
                          <span className={`truncate ${statusTheme.mutedText}`}>
                            · {assignedStaffRole}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {event.isGroupBooking && (
                          <span className={`flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] font-bold ${statusTheme.secondaryText}`}>
                            <Users size={9} />
                            <span>{event.guestCount || 2}</span>
                          </span>
                        )}
                        {typeof event.price === 'number' && (
                          <span className={`font-black font-mono ${statusTheme.secondaryText}`}>
                            {event.price}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {isCompact && showAssignedStaffIdentity && assignedStaffName && (
                    <div className={`mt-1 flex min-w-0 items-center gap-1.5 text-[8px] font-bold ${statusTheme.secondaryText}`}>
                      {showStaffPhotos && staffAvatar ? (
                        <div className={`h-3.5 w-3.5 shrink-0 overflow-hidden rounded-full border shadow-sm ${statusTheme.staffAvatar}`}>
                          <img src={staffAvatar} alt={assignedStaffName || 'Staff'} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[6px] font-black ${statusTheme.staffAvatar}`}>
                          {getInitials(assignedStaffName)}
                        </div>
                      )}
                      <span className="truncate">{assignedStaffName}</span>
                    </div>
                  )}

                  {isMedium && variantDescription && (
                    <p className={`mt-1 truncate text-[8px] italic ${statusTheme.mutedText}`}>
                      {variantDescription}
                    </p>
                  )}

                  {!isCompact && event.notes && (
                    <p className={`mt-1 truncate text-[9px] italic ${statusTheme.mutedText}`}>
                      "{event.notes}"
                    </p>
                  )}

                  {isCompact && (
                    <div className={`mt-1 flex items-center justify-between gap-1 text-[8px] font-bold ${statusTheme.secondaryText}`}>
                      <span className="truncate">
                        {event.subtitle || variantLabel || formatAppointmentStatusLabel(event.status, event.kind)}
                      </span>
                      {typeof event.price === 'number' && <span className={`font-mono ${statusTheme.secondaryText}`}>{event.price}</span>}
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

        {hoverTooltip && (
          <div
            className="pointer-events-none fixed z-[60] rounded-full border border-slate-200 bg-zinc-950 px-2.5 py-1 text-[10px] font-black text-white shadow-xl"
            style={{
              left: `${hoverTooltip.x + 14}px`,
              top: `${hoverTooltip.y + 14}px`,
              transform: 'translate3d(0, 0, 0)'
            }}
          >
            {hoverTooltip.label}
          </div>
        )}

      </div>
    </div>
  );
}
