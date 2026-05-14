"use client";

import { useState, useEffect, useMemo, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { Currency } from "@/components/Currency";
import { getImageUrl } from "@/lib/api";

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_service' | 'completed' | 'cancelled' | 'no_show';
  paymentStatus:
    | 'pending'
    | 'deposit_paid'
    | 'fully_paid'
    | 'paid'
    | 'refunded'
    | 'partially_refunded';
  price: number;
  bookingNumber?: string | null;
  notes?: string;
  paymentMethod?: string | null;
  serviceVariantName?: string | null;
  serviceVariantDuration?: number | null;
  requestedStaffId?: string | null;
  assignmentMode?: 'unknown' | 'customer_selected' | 'auto_assigned' | 'tenant_reassigned';
  service: {
    id: string;
    name_en: string;
    name_ar: string;
    duration: number;
  };
  staff: {
    id: string;
    name: string;
    photo?: string;
  };
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage?: string | null;
    phone?: string;
    photo?: string;
  };
}

interface EmployeeBreak {
  id: string;
  staffId: string;
  type: string;
  label?: string | null;
  isRecurring?: boolean;
  specificDate?: string | null;
  startTime: string;
  endTime: string;
  startDateTime?: string | null;
  endDateTime?: string | null;
}

interface CalendarViewProps {
  appointments: Appointment[];
  breaks?: EmployeeBreak[];
  employees: Array<{ id: string; name: string; photo?: string }>;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onReassignAppointment?: (appointmentId: string, staffId: string) => Promise<void> | void;
  onDropAppointmentChange?: (payload: {
    appointmentId: string;
    staffId: string;
    startTime: string;
    endTime: string;
    changedTime: boolean;
    changedStaff: boolean;
  }) => Promise<void> | void;
  onAppointmentClick?: (appointmentId: string) => void;
  onGridContextMenu?: (payload: {
    clientX: number;
    clientY: number;
    staffId: string;
    startTime: string;
    appointmentId?: string;
  }) => void;
  onStaffHeaderMenuRequest?: (payload: {
    clientX: number;
    clientY: number;
    staffId: string;
    date: string;
  }) => void;
  onBreakClick?: (breakItem: EmployeeBreak) => void;
  onAppointmentSettingsClick?: (appointmentId: string) => void;
  onOpenTools?: () => void;
  onShowAllProviders?: () => void;
  activeFilterCount?: number;
  serviceCapabilityMap?: Map<string, Set<string>>;
  locale: string;
  isRTL: boolean;
  t: (key: string) => string;
  sectionTitle?: string;
  hourHeight?: number;
}

// Time configuration
const START_HOUR = 6; // 6 AM
const END_HOUR = 22; // 10 PM
const MINUTES_PER_SLOT = 30; // 30-minute intervals
const MIN_APPOINTMENT_HEIGHT = 88;
const MIN_BREAK_HEIGHT = 72;

export function CalendarView({
  appointments,
  breaks = [],
  employees,
  selectedDate,
  onDateChange,
  onReassignAppointment,
  onDropAppointmentChange,
  onAppointmentClick,
  onGridContextMenu,
  onStaffHeaderMenuRequest,
  onBreakClick,
  onAppointmentSettingsClick,
  onOpenTools,
  onShowAllProviders,
  activeFilterCount = 0,
  serviceCapabilityMap,
  locale,
  isRTL,
  t,
  sectionTitle,
  hourHeight = 240
}: CalendarViewProps) {
  const router = useRouter();
  const params = useParams();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [openNoteAppointmentId, setOpenNoteAppointmentId] = useState<string | null>(null);
  const [draggedAppointmentId, setDraggedAppointmentId] = useState<string | null>(null);
  const [dragOverStaffId, setDragOverStaffId] = useState<string | null>(null);
  const [visibleStaffIds, setVisibleStaffIds] = useState<Set<string>>(
    new Set(employees.map(emp => emp.id))
  );
  const pixelsPerHour = Math.max(120, Math.min(360, Number(hourHeight) || 240));
  const pixelsPerMinute = pixelsPerHour / 60;
  const boardScale = Math.max(0.85, Math.min(1.35, pixelsPerHour / 240));
  const timeColumnWidth = Math.round(72 * boardScale);
  const staffColumnWidth = Math.round(240 * boardScale);

  useEffect(() => {
    setVisibleStaffIds((previous) => {
      const nextIds = employees.map((employee) => employee.id);

      if (nextIds.length === 0) {
        return new Set();
      }

      const retained = nextIds.filter((id) => previous.has(id));
      return new Set(retained.length > 0 ? retained : nextIds);
    });
  }, [employees]);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!openNoteAppointmentId) {
      return;
    }

    const handleDocumentPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      if (target.closest('[data-note-trigger="true"]') || target.closest('[data-note-panel="true"]')) {
        return;
      }

      setOpenNoteAppointmentId(null);
    };

    document.addEventListener('mousedown', handleDocumentPointerDown);
    document.addEventListener('touchstart', handleDocumentPointerDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown);
      document.removeEventListener('touchstart', handleDocumentPointerDown);
    };
  }, [openNoteAppointmentId]);

  // Filter appointments for selected date
  // Use local date comparison to avoid timezone issues
  const dayAppointments = useMemo(() => {
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedDay = selectedDate.getDate();
    
    return appointments.filter(apt => {
      const aptDate = new Date(apt.startTime);
      const aptYear = aptDate.getFullYear();
      const aptMonth = aptDate.getMonth();
      const aptDay = aptDate.getDate();
      
      return aptYear === selectedYear && 
             aptMonth === selectedMonth && 
             aptDay === selectedDay;
    });
  }, [appointments, selectedDate]);

  const dayBreaks = useMemo(() => {
    return breaks.filter((breakItem) => {
      if (!breakItem.startDateTime) {
        return true;
      }

      const breakDate = new Date(breakItem.startDateTime);
      return (
        breakDate.getFullYear() === selectedDate.getFullYear() &&
        breakDate.getMonth() === selectedDate.getMonth() &&
        breakDate.getDate() === selectedDate.getDate()
      );
    });
  }, [breaks, selectedDate]);

  // Filter visible staff
  const visibleStaff = useMemo(() => {
    return employees.filter(emp => visibleStaffIds.has(emp.id));
  }, [employees, visibleStaffIds]);
  const boardMinWidth = timeColumnWidth + (visibleStaff.length * staffColumnWidth);
  const selectedDateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

  // Generate time slots
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      for (let minute = 0; minute < 60; minute += MINUTES_PER_SLOT) {
        slots.push({
          hour,
          minute,
          label: formatTime(hour, minute, locale),
          position: (hour - START_HOUR) * pixelsPerHour + minute * pixelsPerMinute
        });
      }
    }
    return slots;
  }, [locale, pixelsPerHour, pixelsPerMinute]);

  // Calculate appointment position and height
  const getAppointmentStyle = (appointment: Appointment) => {
    const start = new Date(appointment.startTime);
    const end = new Date(appointment.endTime);
    
    const startHour = start.getHours();
    const startMinute = start.getMinutes();
    const endHour = end.getHours();
    const endMinute = end.getMinutes();

    // Check if appointment is on selected date (using local date comparison)
    const aptYear = start.getFullYear();
    const aptMonth = start.getMonth();
    const aptDay = start.getDate();
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedDay = selectedDate.getDate();
    
    if (aptYear !== selectedYear || aptMonth !== selectedMonth || aptDay !== selectedDay) {
      return { display: 'none' };
    }

    const boardStartMinutes = START_HOUR * 60;
    const boardEndMinutes = END_HOUR * 60;
    const appointmentStartMinutes = (startHour * 60) + startMinute;
    const appointmentEndMinutes = (endHour * 60) + endMinute;

    // If appointment is fully outside the board range, pin it to the closest edge
    // instead of hiding it, so operators can still see and investigate it.
    if (appointmentEndMinutes <= boardStartMinutes) {
      return {
        top: '2px',
        height: `${Math.max(18, MIN_APPOINTMENT_HEIGHT * 0.35)}px`
      };
    }

    if (appointmentStartMinutes >= boardEndMinutes) {
      return {
        top: `${Math.max(0, totalHeight - Math.max(18, MIN_APPOINTMENT_HEIGHT * 0.35) - 2)}px`,
        height: `${Math.max(18, MIN_APPOINTMENT_HEIGHT * 0.35)}px`
      };
    }

    const clampedStartMinutes = Math.max(appointmentStartMinutes, boardStartMinutes);
    const clampedEndMinutes = Math.min(appointmentEndMinutes, boardEndMinutes);
    const top = (clampedStartMinutes - boardStartMinutes) * pixelsPerMinute;
    const duration = Math.max(0, clampedEndMinutes - clampedStartMinutes);
    const height = duration * pixelsPerMinute;
    const appointmentHeight = Math.max(height, MIN_APPOINTMENT_HEIGHT);

    return {
      top: `${top}px`,
      height: `${appointmentHeight}px`,
      position: 'absolute' as const,
      width: 'calc(100% - 8px)',
      left: '4px',
      right: '4px'
    };
  };

  const getSnappedDateTimeFromPointer = (clientY: number, containerTop: number) => {
    const offsetMinutes = (clientY - containerTop) / pixelsPerMinute;
    const snappedMinutes = Math.round(offsetMinutes / MINUTES_PER_SLOT) * MINUTES_PER_SLOT;
    const totalAvailableMinutes = (END_HOUR - START_HOUR) * 60;
    const clampedMinutes = Math.max(0, Math.min(totalAvailableMinutes - MINUTES_PER_SLOT, snappedMinutes));
    const baseDate = new Date(selectedDate);
    baseDate.setHours(START_HOUR, 0, 0, 0);
    baseDate.setMinutes(baseDate.getMinutes() + clampedMinutes);
    return baseDate;
  };

  const getBreakStyle = (breakItem: EmployeeBreak) => {
    const startParts = `${breakItem.startTime}`.split(':').map((value) => parseInt(value, 10));
    const endParts = `${breakItem.endTime}`.split(':').map((value) => parseInt(value, 10));

    const startHour = startParts[0] || 0;
    const startMinute = startParts[1] || 0;
    const endHour = endParts[0] || 0;
    const endMinute = endParts[1] || 0;

    const top = (startHour - START_HOUR) * pixelsPerHour + startMinute * pixelsPerMinute;
    const duration = (endHour - startHour) * 60 + (endMinute - startMinute);
    const height = duration * pixelsPerMinute;

    return {
      top: `${top}px`,
      height: `${Math.max(height, MIN_BREAK_HEIGHT)}px`,
      position: 'absolute' as const,
      width: 'calc(100% - 12px)',
      left: '6px',
      right: '6px'
    };
  };

  // Get appointment color based on status
  const getAppointmentColor = (appointment: Appointment) => {
    if (appointment.assignmentMode === 'auto_assigned') {
      return 'bg-slate-500 hover:bg-slate-600';
    }

    switch (appointment.status) {
      case 'confirmed':
        return 'bg-purple-500';
      case 'checked_in':
        return 'bg-sky-500';
      case 'in_service':
        return 'bg-indigo-600';
      case 'pending':
        return 'bg-yellow-500';
      case 'completed':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      case 'no_show':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getStatusLabel = (status: Appointment['status']) => {
    switch (status) {
      case 'pending':
        return locale === 'ar' ? 'غير مؤكد' : 'Unconfirmed';
      case 'confirmed':
        return t("confirmed");
      case 'checked_in':
        return t("checkedIn");
      case 'in_service':
        return t("inProgress");
      case 'completed':
        return t("completed");
      case 'cancelled':
        return t("cancelled");
      case 'no_show':
        return t("noShow");
      default:
        return status;
    }
  };

  const getPaymentBadgeLabel = (appointment: Appointment) => {
    if (appointment.paymentStatus === 'pending') {
      return locale === 'ar' ? 'بانتظار الدفع' : 'Awaiting payment';
    }

    if (appointment.paymentStatus === 'fully_paid' || appointment.paymentStatus === 'paid') {
      return locale === 'ar' ? 'مدفوع' : 'Paid';
    }

    if (appointment.paymentStatus === 'deposit_paid') {
      return locale === 'ar' ? 'عربون' : 'Deposit';
    }

    return locale === 'ar' ? 'معلّق' : 'Pending';
  };

  const getPaymentBadgeClasses = (appointment: Appointment) => {
    if (appointment.paymentStatus === 'fully_paid' || appointment.paymentStatus === 'paid') {
      return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200';
    }

    if (appointment.paymentStatus === 'deposit_paid') {
      return 'bg-amber-100 text-amber-900 ring-1 ring-amber-200';
    }

    return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
  };

  const getPaymentBadgeTitle = (appointment: Appointment) => {
    if (appointment.paymentStatus === 'pending') {
      if (appointment.paymentMethod === 'at-center' || appointment.paymentMethod === 'pay_on_visit' || appointment.paymentMethod === 'cash') {
        return locale === 'ar' ? 'الدفع عند الوصول' : 'Pay on arrival';
      }

      return locale === 'ar' ? 'الحجز بانتظار الدفع' : 'Booking awaiting payment';
    }

    if (appointment.paymentStatus === 'deposit_paid') {
      return locale === 'ar' ? 'تم دفع العربون ويتبقى جزء عند الوصول' : 'Deposit paid, remainder still due';
    }

    if (appointment.paymentStatus === 'fully_paid' || appointment.paymentStatus === 'paid') {
      return locale === 'ar' ? 'تم سداد الحجز بالكامل' : 'Booking fully paid';
    }

    if (appointment.paymentMethod === 'at-center' || appointment.paymentMethod === 'pay_on_visit') {
      return locale === 'ar' ? 'الدفع عند الوصول' : 'Pay on arrival';
    }

    return locale === 'ar' ? 'الحجز بانتظار الدفع' : 'Booking still pending payment';
  };

  const getPaymentTypeLabel = (appointment: Appointment) => {
    const normalizedMethod = `${appointment.paymentMethod || ''}`.toLowerCase();

    if (appointment.paymentStatus === 'pending') {
      if (
        normalizedMethod.includes('at-center')
        || normalizedMethod.includes('pay_on_visit')
        || normalizedMethod.includes('cash')
      ) {
        return locale === 'ar' ? 'الدفع عند الوصول' : 'Pay on arrival';
      }

      return locale === 'ar' ? 'بانتظار الدفع' : 'Awaiting payment';
    }

    if (
      appointment.paymentStatus === 'deposit_paid'
      || normalizedMethod.includes('booking')
      || normalizedMethod.includes('deposit')
    ) {
      return locale === 'ar' ? 'عربون الحجز' : 'Booking fee';
    }

    if (
      appointment.paymentStatus === 'fully_paid'
      || appointment.paymentStatus === 'paid'
      || normalizedMethod.includes('online')
    ) {
      return locale === 'ar' ? 'دفع كامل' : 'Paid in full';
    }

    if (
      normalizedMethod.includes('at-center')
      || normalizedMethod.includes('pay_on_visit')
      || normalizedMethod.includes('cash')
    ) {
      return locale === 'ar' ? 'الدفع عند الوصول' : 'Pay on arrival';
    }

    return appointment.paymentMethod
      ? `${appointment.paymentMethod}`
      : (locale === 'ar' ? 'غير محدد' : 'Unspecified');
  };

  const getPaymentTypeSymbol = (appointment: Appointment) => {
    const normalizedMethod = `${appointment.paymentMethod || ''}`.toLowerCase();

    if (appointment.paymentStatus === 'pending') {
      return normalizedMethod.includes('at-center') || normalizedMethod.includes('pay_on_visit') || normalizedMethod.includes('cash')
        ? '🏢'
        : '⏳';
    }

    if (
      appointment.paymentStatus === 'deposit_paid'
      || normalizedMethod.includes('booking')
      || normalizedMethod.includes('deposit')
    ) {
      return '💰';
    }

    if (
      appointment.paymentStatus === 'fully_paid'
      || appointment.paymentStatus === 'paid'
      || normalizedMethod.includes('online')
    ) {
      return '💳';
    }

    return '🏢';
  };

  const getBreakLabel = (breakItem: EmployeeBreak) => {
    if (breakItem.label?.trim()) {
      return breakItem.label.trim();
    }

    const labels: Record<string, { ar: string; en: string }> = {
      lunch: { ar: 'استراحة', en: 'Break' },
      prayer: { ar: 'صلاة', en: 'Prayer' },
      cleaning: { ar: 'تنظيف', en: 'Cleaning' },
      other: { ar: 'استراحة', en: 'Break' }
    };

    const resolved = labels[breakItem.type] || labels.other;
    return locale === 'ar' ? resolved.ar : resolved.en;
  };

  // Calculate current time position
  const getCurrentTimePosition = () => {
    const now = currentTime;
    // Compare local dates
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedDay = selectedDate.getDate();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    const nowDay = now.getDate();
    
    if (selectedYear !== nowYear || selectedMonth !== nowMonth || selectedDay !== nowDay) {
      return null; // Don't show current time line if not today
    }

    const hour = now.getHours();
    const minute = now.getMinutes();
    const position = (hour - START_HOUR) * pixelsPerHour + minute * pixelsPerMinute;

    if (hour < START_HOUR || hour >= END_HOUR) {
      return null; // Outside visible range
    }

    return position;
  };

  // Date navigation
  const goToToday = () => {
    onDateChange(new Date());
  };

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const isToday = () => {
    const today = new Date();
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedDay = selectedDate.getDate();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    
    return selectedYear === todayYear && 
           selectedMonth === todayMonth && 
           selectedDay === todayDay;
  };

  // Toggle staff visibility
  const toggleStaffVisibility = (staffId: string) => {
    setVisibleStaffIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(staffId)) {
        newSet.delete(staffId);
      } else {
        newSet.add(staffId);
      }
      return newSet;
    });
  };

  const showAllProviders = () => {
    setVisibleStaffIds(new Set(employees.map((employee) => employee.id)));
    onShowAllProviders?.();
  };

  const handleStaffDragOver = (event: DragEvent<HTMLDivElement>, staffId: string) => {
    if (!(onReassignAppointment || onDropAppointmentChange) || !draggedAppointmentId) {
      return;
    }

    const appointment = dayAppointments.find((item) => item.id === draggedAppointmentId);
    if (!appointment || appointment.staff.id === staffId) {
      return;
    }

    const allowedStaffIds = serviceCapabilityMap?.get(appointment.service.id);
    if (allowedStaffIds && !allowedStaffIds.has(staffId)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverStaffId(staffId);
  };

  const handleStaffDrop = async (event: DragEvent<HTMLDivElement>, staffId: string) => {
    event.preventDefault();

    const appointmentId = draggedAppointmentId;
    setDraggedAppointmentId(null);
    setDragOverStaffId(null);

    if (!(onReassignAppointment || onDropAppointmentChange) || !appointmentId) {
      return;
    }

    const appointment = dayAppointments.find((item) => item.id === appointmentId);
    if (!appointment || appointment.staff.id === staffId) {
      return;
    }

    const allowedStaffIds = serviceCapabilityMap?.get(appointment.service.id);
    if (allowedStaffIds && !allowedStaffIds.has(staffId)) {
      const message = locale === 'ar'
        ? 'لا يمكن نقل هذا الموعد لأن الموظف المحدد غير مخصّص لهذه الخدمة.'
        : 'Cannot move this booking because the selected staff member is not assigned to this service.';
      alert(message);
      return;
    }

    const snappedTargetStart = getSnappedDateTimeFromPointer(
      event.clientY,
      event.currentTarget.getBoundingClientRect().top
    );
    const currentStart = new Date(appointment.startTime);
    const currentEnd = new Date(appointment.endTime);
    const durationMinutes = Math.max(15, Math.round((currentEnd.getTime() - currentStart.getTime()) / 60000));
    const targetEnd = new Date(snappedTargetStart.getTime() + durationMinutes * 60000);
    const appointmentStart = snappedTargetStart.getTime();
    const appointmentEnd = targetEnd.getTime();
    const hasConflict = dayAppointments.some((item) => {
      if (item.id === appointment.id) {
        return false;
      }

      if (item.staff.id !== staffId) {
        return false;
      }

      if (['cancelled', 'no_show'].includes(item.status)) {
        return false;
      }

      const itemStart = new Date(item.startTime).getTime();
      const itemEnd = new Date(item.endTime).getTime();
      return itemStart < appointmentEnd && itemEnd > appointmentStart;
    });

    if (hasConflict) {
      const message = locale === 'ar'
        ? 'لا يمكن نقل الموعد لأن الموظف المحدد لديه حجز متداخل في نفس الفترة.'
        : 'Cannot move this booking because the selected staff member has an overlapping appointment.';
      alert(message);
      return;
    }

    const changedTime = snappedTargetStart.getTime() !== currentStart.getTime();
    const changedStaff = appointment.staff.id !== staffId;

    if (onDropAppointmentChange) {
      await onDropAppointmentChange({
        appointmentId,
        staffId,
        startTime: snappedTargetStart.toISOString(),
        endTime: targetEnd.toISOString(),
        changedTime,
        changedStaff
      });
      return;
    }

    await onReassignAppointment?.(appointmentId, staffId);
  };

  const handleStaffDropLeave = (staffId: string) => {
    if (dragOverStaffId === staffId) {
      setDragOverStaffId(null);
    }
  };

  const handleAppointmentClick = (appointmentId: string) => {
    if (onAppointmentClick) {
      onAppointmentClick(appointmentId);
      return;
    }

    router.push(`/${params.locale}/dashboard/appointments/${appointmentId}`);
  };

  const totalHeight = (END_HOUR - START_HOUR) * pixelsPerHour;
  const currentTimePosition = getCurrentTimePosition();
  const summaryCounts = {
    appointments: dayAppointments.length,
    breaks: dayBreaks.length,
    visibleStaff: visibleStaff.length
  };

  return (
    <div className="space-y-4">
      {/* Date Navigation */}
      <div className={`flex flex-col md:flex-row items-start md:items-center justify-between bg-white rounded-lg p-4 shadow-sm gap-4 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
        <div className={`flex flex-col gap-1 ${isRTL ? 'items-end' : 'items-start'}`}>
          <h3 className="text-2xl font-bold text-gray-900">
            {sectionTitle || (locale === 'ar' ? 'المواعيد' : 'Appointments')}
          </h3>
          <p className="text-sm text-gray-500">
            {locale === 'ar'
              ? 'اسحب الموعد بين الموظفين لتغيير مقدم الخدمة.'
              : 'Drag appointments between staff columns to reassign the provider.'}
          </p>
        </div>

        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={goToToday}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
              isToday()
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('today')}
          </button>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              onClick={goToPreviousDay}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRTL ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
              </svg>
            </button>
            <div className="px-4 py-2 font-semibold text-gray-900 min-w-[120px] text-center text-sm md:text-base">
              {formatDate(selectedDate, locale)}
            </div>
            <button
              onClick={goToNextDay}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRTL ? "M15 19l-7-7-7 7" : "M9 5l7 7-7 7"} />
              </svg>
            </button>
          </div>
        </div>

        {/* Staff Filter */}
        <div className={`flex flex-col md:flex-row items-start md:items-center gap-2 w-full md:w-auto ${isRTL ? 'md:flex-row-reverse' : ''}`}>
          <span className="text-sm text-gray-600 whitespace-nowrap">{t('scheduledTeam')}:</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={showAllProviders}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
              title={locale === 'ar' ? 'إظهار جميع مقدمي الخدمة' : 'Show all service providers'}
              aria-label={locale === 'ar' ? 'إظهار جميع مقدمي الخدمة' : 'Show all service providers'}
            >
              <svg className="h-4 w-4 text-gray-700" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM3 17a4 4 0 014-4h6a4 4 0 014 4v1H3v-1zM2 8a2 2 0 100-4 2 2 0 000 4zm16 0a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
              <span>{locale === 'ar' ? 'الكل' : 'All'}</span>
            </button>
            {employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => toggleStaffVisibility(emp.id)}
                className={`px-3 py-1 rounded-lg text-xs md:text-sm transition-colors ${
                  visibleStaffIds.has(emp.id)
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
                title={emp.name}
              >
                {emp.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </button>
            ))}
            {onOpenTools && (
              <button
                type="button"
                onClick={onOpenTools}
                className="relative inline-flex h-8 items-center gap-2 rounded-lg bg-white px-3 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50"
                aria-label={locale === 'ar' ? 'فتح أدوات الجدول' : 'Open board tools'}
              >
                <svg className="h-4 w-4 text-gray-700" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M11.983 1.75a1 1 0 00-1.966 0l-.12.74a7.52 7.52 0 00-1.426.588l-.63-.44a1 1 0 00-1.352.115l-1.3 1.3a1 1 0 00-.115 1.352l.44.63c-.22.46-.42.935-.588 1.426l-.74.12a1 1 0 000 1.966l.74.12c.168.49.368.966.588 1.426l-.44.63a1 1 0 00.115 1.352l1.3 1.3a1 1 0 001.352.115l.63-.44c.46.22.935.42 1.426.588l.12.74a1 1 0 001.966 0l.12-.74c.49-.168.966-.368 1.426-.588l.63.44a1 1 0 001.352-.115l1.3-1.3a1 1 0 00.115-1.352l-.44-.63c.22-.46.42-.935.588-1.426l.74-.12a1 1 0 000-1.966l-.74-.12a7.52 7.52 0 00-.588-1.426l.44-.63a1 1 0 00-.115-1.352l-1.3-1.3a1 1 0 00-1.352-.115l-.63.44a7.52 7.52 0 00-1.426-.588l-.12-.74zM10 13.25a3.25 3.25 0 100-6.5 3.25 3.25 0 000 6.5z" />
                </svg>
                <span>{locale === 'ar' ? 'الأدوات' : 'Tools'}</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={`rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 ${isRTL ? 'text-right' : ''}`}>
        <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {locale === 'ar' ? 'مفاتيح اللوحة' : 'Board Guide'}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
            {locale === 'ar' ? `${summaryCounts.appointments} حجوزات` : `${summaryCounts.appointments} bookings`}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
            {locale === 'ar' ? `${summaryCounts.breaks} استراحات` : `${summaryCounts.breaks} breaks`}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
            {locale === 'ar' ? `${summaryCounts.visibleStaff} موظفين ظاهرين` : `${summaryCounts.visibleStaff} visible staff`}
          </span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-360px)]">
          <div
            className="inline-flex min-w-full items-start"
            style={{ minWidth: `${boardMinWidth}px` }}
          >
            {/* Time Column */}
            <div
              className="flex-shrink-0 border-r border-gray-200 sticky left-0 z-20 bg-white"
              style={{ width: `${timeColumnWidth}px` }}
            >
              <div className="sticky top-0 z-40 h-24 md:h-20 border-b border-gray-200 bg-gray-50"></div>
              <div className="relative" style={{ height: `${totalHeight}px` }}>
                {timeSlots.map((slot, index) => (
                  <div
                    key={index}
                    className="absolute text-xs text-gray-500 px-1 md:px-2 z-10 bg-white"
                    style={{ top: `${slot.position}px`, transform: 'translateY(-50%)' }}
                  >
                    {slot.label}
                  </div>
                ))}
                {/* Dotted lines for each time slot */}
                {timeSlots.map((slot, index) => (
                  <div
                    key={`line-${index}`}
                    className="absolute left-0 right-0 border-t border-dotted border-gray-300"
                    style={{ top: `${slot.position}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Staff Columns */}
            {visibleStaff.length === 0 ? (
              <div className="flex-1 p-8 text-center text-gray-500">
                {t('noStaffSelected')}
              </div>
            ) : (
              visibleStaff.map(staff => {
                const staffAppointments = dayAppointments.filter(
                  apt => apt.staff.id === staff.id
                );
                const staffBreaks = dayBreaks.filter(
                  breakItem => breakItem.staffId === staff.id
                );

                return (
                  <div
                    key={staff.id}
                    className={`flex-shrink-0 border-r border-gray-200 transition-colors ${dragOverStaffId === staff.id ? 'bg-primary/5' : ''}`}
                    style={{ minWidth: `${staffColumnWidth}px`, width: `${staffColumnWidth}px` }}
                  >
                    {/* Staff Header */}
                    <div className="sticky top-0 z-40 h-24 md:h-20 border-b border-gray-200 bg-gray-50 p-2 md:p-3 flex flex-col items-center justify-center">
                      <div className="flex w-full items-start justify-between">
                        <button
                          type="button"
                          onClick={(event) => {
                            if (!onStaffHeaderMenuRequest) {
                              return;
                            }
                            event.stopPropagation();
                            onStaffHeaderMenuRequest({
                              clientX: event.clientX,
                              clientY: event.clientY,
                              staffId: staff.id,
                              date: selectedDateKey
                            });
                          }}
                          className="rounded-full border border-gray-200 bg-white p-1.5 text-gray-600 shadow-sm transition hover:bg-gray-50"
                          aria-label={locale === 'ar' ? 'فتح قائمة الموظف' : 'Open staff menu'}
                          title={locale === 'ar' ? 'إجراءات الموظف' : 'Staff actions'}
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.1 1.02l-4.25 4.5a.75.75 0 01-1.1 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <div className="w-7" />
                      </div>
                      <div className="flex-shrink-0 mb-1.5 relative -mt-2">
                        {staff.photo ? (
                          <>
                            <img
                              src={getImageUrl(staff.photo)}
                              alt={staff.name}
                              className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center border-2 border-white shadow-sm hidden">
                              <span className="text-primary font-semibold text-xs">
                                {staff.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border-2 border-white shadow-sm">
                            <span className="text-primary font-semibold text-xs">
                              {staff.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-gray-900 text-center px-1 w-full flex items-center justify-center" style={{ 
                        minHeight: '2.5rem',
                        lineHeight: '1.3'
                      }} title={staff.name}>
                        <div className="break-words" style={{ 
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          wordBreak: 'break-word',
                          hyphens: 'auto',
                          textOverflow: 'ellipsis'
                        }}>
                          {staff.name}
                        </div>
                      </div>
                    </div>

                    {/* Appointments Column */}
                    <div
                      className="relative overflow-hidden"
                      style={{ height: `${totalHeight}px` }}
                      onDragOver={(event) => handleStaffDragOver(event, staff.id)}
                      onDrop={(event) => handleStaffDrop(event, staff.id)}
                      onDragLeave={() => handleStaffDropLeave(staff.id)}
                      onContextMenu={(event) => {
                        if (!onGridContextMenu) {
                          return;
                        }

                        event.preventDefault();
                        event.stopPropagation();

                        const startTime = getSnappedDateTimeFromPointer(
                          event.clientY,
                          event.currentTarget.getBoundingClientRect().top
                        );

                        onGridContextMenu({
                          clientX: event.clientX,
                          clientY: event.clientY,
                          staffId: staff.id,
                          startTime: startTime.toISOString()
                        });
                      }}
                    >
                      {/* Dotted lines for each time slot (extend into columns) */}
                      {timeSlots.map((slot, index) => (
                        <div
                          key={`column-line-${index}`}
                          className="absolute left-0 right-0 border-t border-dotted border-gray-200 pointer-events-none"
                          style={{ top: `${slot.position}px` }}
                        />
                      ))}

                      {/* Current Time Indicator */}
                      {currentTimePosition !== null && (
                        <div
                          className="absolute left-0 right-0 z-10 pointer-events-none"
                          style={{ top: `${currentTimePosition}px` }}
                        >
                          <div className="h-0.5 bg-red-500 relative">
                            <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full"></div>
                          </div>
                        </div>
                      )}

                      {/* Appointment Blocks */}
                      {staffBreaks.map((breakItem) => {
                        const breakStyle = getBreakStyle(breakItem);
                        const startLabel = `${breakItem.startTime}`.slice(0, 5);
                        const endLabel = `${breakItem.endTime}`.slice(0, 5);

                        return (
                          <div
                            key={`break-${breakItem.id}`}
                            className={`absolute z-[1] rounded-xl border border-rose-200 bg-rose-100/90 px-3 py-2 text-rose-700 shadow-sm transition hover:shadow-md ${onBreakClick ? 'cursor-pointer hover:border-rose-300 hover:bg-rose-100' : ''}`}
                            style={breakStyle}
                            title={`${getBreakLabel(breakItem)} • ${startLabel} - ${endLabel}`}
                            onClick={() => onBreakClick?.(breakItem)}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                              <span className="truncate">{getBreakLabel(breakItem)}</span>
                              <span className="whitespace-nowrap opacity-80">{startLabel} - {endLabel}</span>
                            </div>
                          </div>
                        );
                      })}

                      {staffAppointments.length === 0 && staffBreaks.length === 0 && (
                        <div className="absolute inset-x-3 top-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-400">
                          {locale === 'ar' ? 'لا توجد حجوزات لهذا اليوم' : 'No bookings for this day'}
                        </div>
                      )}

                      {staffAppointments.map((appointment) => {
                        const customerFirstName =
                          appointment.user?.firstName?.trim() ||
                          appointment.user?.lastName?.trim() ||
                          t('unknownCustomer');
                        const serviceName =
                          locale === 'ar' ? appointment.service.name_ar : appointment.service.name_en;
                        const variantName = appointment.serviceVariantName?.trim() || "";
                        const startTime = new Date(appointment.startTime);
                        const endTime = new Date(appointment.endTime);
                        const timeLabel = `${formatTime(startTime.getHours(), startTime.getMinutes(), locale)} - ${formatTime(endTime.getHours(), endTime.getMinutes(), locale)}`;

                        const style = getAppointmentStyle(appointment);
                        const calculatedHeight = Number.parseFloat(String(style.height ?? '0')) || MIN_APPOINTMENT_HEIGHT;
                        const minHeight = Math.max(calculatedHeight, MIN_APPOINTMENT_HEIGHT);
                        const isCompactCard = minHeight < 160;
                        const userInitials = appointment.user
                          ? `${appointment.user.firstName?.[0] || ''}${appointment.user.lastName?.[0] || ''}`.toUpperCase() || '?'
                          : '?';
                        const hasCustomerSelectedStaff = appointment.assignmentMode === 'customer_selected';
                        const hasBookingNote = Boolean(appointment.notes?.trim());
                        const paymentTypeLabel = getPaymentTypeLabel(appointment);
                        const paymentStatusLabel = getPaymentBadgeLabel(appointment);
                        const paymentStatusTitle = getPaymentBadgeTitle(appointment);
                        const paymentToneClass = (() => {
                          if (appointment.paymentStatus === 'fully_paid' || appointment.paymentStatus === 'paid') {
                            return 'border-emerald-400/35 bg-emerald-400/12 text-emerald-50';
                          }

                          if (appointment.paymentStatus === 'deposit_paid') {
                            return 'border-amber-300/35 bg-amber-300/12 text-amber-50';
                          }

                          return 'border-slate-300/20 bg-white/8 text-slate-50';
                        })();
                        const isNoteOpen = openNoteAppointmentId === appointment.id;
                        const allowedStaffIds = serviceCapabilityMap?.get(appointment.service.id);
                        const hasAlternativeEligibleStaff = !allowedStaffIds || employees.some((employee) => {
                          if (employee.id === appointment.staff.id) {
                            return false;
                          }
                          return allowedStaffIds.has(employee.id);
                        });
                        const canReassign = Boolean(onReassignAppointment || onDropAppointmentChange) &&
                          !['completed', 'cancelled', 'no_show'].includes(appointment.status) &&
                          hasAlternativeEligibleStaff;
                        const isDragged = draggedAppointmentId === appointment.id;

                        return (
                          <div
                            key={appointment.id}
                            onClick={() => handleAppointmentClick(appointment.id)}
                            onContextMenu={(event) => {
                              if (!onGridContextMenu) {
                                return;
                              }

                              event.preventDefault();
                              event.stopPropagation();
                              onGridContextMenu({
                                clientX: event.clientX,
                                clientY: event.clientY,
                                staffId: appointment.staff.id,
                                startTime: appointment.startTime,
                                appointmentId: appointment.id
                              });
                            }}
                            draggable={canReassign}
                            onDragStart={(event) => {
                              if (!canReassign) {
                                event.preventDefault();
                                return;
                              }
                              event.stopPropagation();
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData('text/plain', appointment.id);
                              setDraggedAppointmentId(appointment.id);
                              setDragOverStaffId(appointment.staff.id);
                            }}
                            onDragEnd={() => {
                              setDraggedAppointmentId(null);
                              setDragOverStaffId(null);
                            }}
                            className={`${getAppointmentColor(appointment)} group relative z-[2] text-white rounded-2xl cursor-pointer transition-all shadow-md hover:shadow-lg overflow-visible border border-white/15 ${appointment.assignmentMode === 'auto_assigned' ? 'ring-1 ring-slate-300/70' : ''} ${canReassign ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragged ? 'opacity-70 ring-2 ring-dashed ring-white/50' : ''}`}
                            style={{ ...style, height: `${minHeight}px` }}
                            title={`${customerFirstName} - ${serviceName} - ${timeLabel}`}
                          >
                              <div className={`pointer-events-none absolute z-[9999] w-72 rounded-3xl border border-white/20 bg-slate-950/95 p-4 text-white shadow-2xl ring-1 ring-black/25 backdrop-blur-xl opacity-0 transition-all duration-150 group-hover:z-[9999] group-hover:opacity-100 group-hover:translate-y-0 ${isRTL ? 'right-full mr-3 translate-y-2' : 'left-full ml-3 translate-y-2'} top-0`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-base font-semibold leading-tight">{serviceName}</div>
                                    <div className="mt-1 flex items-center gap-2 text-xs text-white/70">
                                      <span className="truncate">{customerFirstName}</span>
                                    </div>
                                  </div>
                                </div>

                                {appointment.bookingNumber ? (
                                  <div className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80">
                                    #{appointment.bookingNumber}
                                  </div>
                                ) : null}

                              <div className={`mt-3 rounded-3xl border p-3 shadow-inner ${paymentToneClass}`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                                      {locale === 'ar' ? 'حالة الدفع' : 'Payment status'}
                                    </div>
                                    <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
                                      <span className="h-2.5 w-2.5 rounded-full bg-current/80 shadow-[0_0_0_4px_rgba(255,255,255,0.10)]" />
                                      <span className="truncate">{paymentStatusLabel}</span>
                                    </div>
                                    <div className="mt-1 text-xs leading-relaxed text-white/75">
                                      {paymentStatusTitle}
                                    </div>
                                  </div>
                                  <div className="shrink-0 rounded-2xl bg-black/20 px-3 py-2 text-right ring-1 ring-white/10">
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                                      {locale === 'ar' ? 'نوع الدفع' : 'Type'}
                                    </div>
                                    <div className="mt-1 max-w-[8rem] truncate text-xs font-semibold">
                                      {paymentTypeLabel}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                                <div className="rounded-2xl bg-white/8 px-3 py-2">
                                  <div className="text-white/60">{locale === 'ar' ? 'الوقت' : 'Time'}</div>
                                  <div className="mt-1 font-semibold">{timeLabel}</div>
                                </div>
                                <div className="rounded-2xl bg-white/8 px-3 py-2">
                                  <div className="text-white/60">{locale === 'ar' ? 'الحالة' : 'Status'}</div>
                                  <div className="mt-1 font-semibold">{getStatusLabel(appointment.status)}</div>
                                </div>
                                <div className="rounded-2xl bg-white/8 px-3 py-2">
                                  <div className="text-white/60">{locale === 'ar' ? 'الموظف' : 'Provider'}</div>
                                  <div className="mt-1 truncate font-semibold">{appointment.staff.name}</div>
                                </div>
                                <div className="rounded-2xl bg-white/8 px-3 py-2">
                                  <div className="text-white/60">{locale === 'ar' ? 'السعر' : 'Price'}</div>
                                  <div className="mt-1 font-semibold">
                                    <Currency amount={appointment.price} locale={locale === 'ar' ? 'ar-SA' : 'en-US'} />
                                  </div>
                                </div>
                              </div>

                              {(variantName || appointment.notes?.trim()) && (
                                <div className="mt-3 space-y-2 text-xs text-white/85">
                                  {variantName ? (
                                    <div className="rounded-2xl bg-white/8 px-3 py-2">
                                      <div className="text-white/60">{locale === 'ar' ? 'النسخة' : 'Variant'}</div>
                                      <div className="mt-1 truncate font-semibold">{variantName}</div>
                                    </div>
                                  ) : null}
                                  {appointment.notes?.trim() ? (
                                    <div className="rounded-2xl bg-white/8 px-3 py-2">
                                      <div className="text-white/60">{locale === 'ar' ? 'ملاحظة' : 'Note'}</div>
                                      <div className="mt-1 line-clamp-2 whitespace-pre-wrap leading-relaxed">
                                        {appointment.notes.trim()}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>

                            <div className={`flex h-full flex-col overflow-hidden rounded-2xl ${isCompactCard ? 'text-[11px]' : ''}`}>
                              <div className={`flex flex-shrink-0 items-center justify-between gap-2 bg-black/25 ${isCompactCard ? 'px-3 py-2' : 'px-4 py-3'}`}>
                                <div className="min-w-0">
                                  <div className={`break-words font-semibold leading-tight ${isCompactCard ? 'text-sm' : 'text-sm'}`}>
                                    {serviceName}
                                  </div>
                                </div>
                                {hasCustomerSelectedStaff && (
                                  <span
                                    className={`inline-flex flex-shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/25 ${isCompactCard ? 'h-7 w-7' : 'h-8 w-8'}`}
                                    title={locale === 'ar' ? 'اختار الموظف بنفسه' : 'Customer selected a specific employee'}
                                  >
                                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  </span>
                                )}
                              </div>

                              <div className={`flex flex-1 flex-col bg-black/15 backdrop-blur-[1px] ${isCompactCard ? 'gap-1.5 px-3 py-2.5' : 'gap-2 px-4 py-4'}`}>
                                <div className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3">
                                  <div className="relative flex h-8 w-8 items-center justify-center">
                                    {(() => {
                                      const userPhoto = appointment.user?.photo || appointment.user?.profileImage;
                                      const hasValidPhoto = Boolean(
                                        userPhoto && typeof userPhoto === 'string' && userPhoto.trim() !== ''
                                      );

                                      if (hasValidPhoto) {
                                        return (
                                          <>
                                            <img
                                              src={getImageUrl(userPhoto as string)}
                                              alt={customerFirstName}
                                              className={`relative z-10 rounded-full border border-white/30 object-cover ${isCompactCard ? 'h-6 w-6' : 'h-7 w-7'}`}
                                              onError={(e) => {
                                                const img = e.currentTarget;
                                                img.style.display = 'none';
                                                const fallback = img.parentElement?.querySelector('.avatar-fallback') as HTMLElement;
                                                if (fallback) {
                                                  fallback.style.display = 'flex';
                                                }
                                              }}
                                            />
                                            <div className={`avatar-fallback absolute inset-0 hidden items-center justify-center rounded-full border border-white/30 bg-white/20 ${isCompactCard ? 'h-6 w-6' : 'h-7 w-7'}`}>
                                              <span className={`${isCompactCard ? 'text-[10px]' : 'text-xs'} font-semibold`}>{userInitials}</span>
                                            </div>
                                          </>
                                        );
                                      }

                                      return (
                                        <div className={`flex items-center justify-center rounded-full border border-white/30 bg-white/20 ${isCompactCard ? 'h-6 w-6' : 'h-7 w-7'}`}>
                                          <span className={`${isCompactCard ? 'text-[10px]' : 'text-xs'} font-semibold`}>{userInitials}</span>
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  <div className="min-w-0 pt-0.5">
                                    <div className={`min-w-0 truncate font-semibold leading-tight ${isCompactCard ? 'text-[13px]' : 'text-sm'}`}>{customerFirstName}</div>
                                  </div>

                                  <div className="flex items-center justify-end gap-1.5">
                                    {hasBookingNote && (
                                      <button
                                        type="button"
                                        data-note-trigger="true"
                                        className={`inline-flex items-center justify-center rounded-full bg-white/20 ring-1 ring-white/20 transition hover:bg-white/30 ${isCompactCard ? 'h-5 w-5' : 'h-6 w-6'}`}
                                        title={locale === 'ar' ? 'توجد ملاحظة من العميل' : 'Customer added a booking note'}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setOpenNoteAppointmentId((current) => (current === appointment.id ? null : appointment.id));
                                        }}
                                      >
                                        <svg className={`${isCompactCard ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                          <path
                                            fillRule="evenodd"
                                            d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123A6.921 6.921 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7zm-10-1a1 1 0 112 0v.01a1 1 0 11-2 0V9zm0 3a1 1 0 112 0v.01a1 1 0 11-2 0V12zm4-3a1 1 0 112 0v.01a1 1 0 11-2 0V9z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className={`flex items-center gap-2 font-medium opacity-90 ${isCompactCard ? 'text-[11px]' : 'text-xs'}`}>
                                  <span className="opacity-70">{locale === 'ar' ? 'نوع الدفع' : 'Payment type'}</span>
                                  <span className={`inline-flex max-w-full items-center gap-1 rounded-full bg-white/15 ${isCompactCard ? 'px-2 py-0.5' : 'px-2 py-1'}`}>
                                    <span aria-hidden="true">{getPaymentTypeSymbol(appointment)}</span>
                                    <span className="min-w-0 max-w-[8rem] truncate">{paymentTypeLabel}</span>
                                  </span>
                                </div>

                                <div className={`flex items-center gap-1.5 leading-tight opacity-90 ${isCompactCard ? 'text-[11px]' : 'text-xs'}`}>
                                  <span className="whitespace-nowrap opacity-70">{locale === 'ar' ? 'وقت الحجز' : 'Booked time'}</span>
                                  <svg className={`${isCompactCard ? 'h-2.5 w-2.5' : 'h-3 w-3'} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="truncate">{timeLabel}</span>
                                </div>

                                <div className={`mt-auto flex items-center justify-between gap-2 ${isCompactCard ? 'pt-0.5' : 'pt-1.5'}`}>
                                  <div className="flex items-center gap-1">
                                    <div className="h-1.5 w-1.5 rounded-full bg-white/70"></div>
                                    <span className={`${isCompactCard ? 'text-[11px]' : 'text-xs'} capitalize opacity-80`}>{getStatusLabel(appointment.status)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`rounded-full font-semibold ${getPaymentBadgeClasses(appointment)} ${isCompactCard ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'}`}
                                      title={getPaymentBadgeTitle(appointment)}
                                    >
                                      {getPaymentBadgeLabel(appointment)}
                                    </span>
                                    {onAppointmentSettingsClick && (
                                      <button
                                        type="button"
                                        data-appointment-settings="true"
                                        className={`inline-flex items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 transition hover:bg-white/25 ${isCompactCard ? 'h-6 w-6' : 'h-7 w-7'}`}
                                        title={locale === 'ar' ? 'إعدادات الموعد' : 'Appointment settings'}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          onAppointmentSettingsClick(appointment.id);
                                        }}
                                      >
                                        <svg className={`${isCompactCard ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                          <path d="M11.983 1.75a1 1 0 00-1.966 0l-.12.74a7.52 7.52 0 00-1.426.588l-.63-.44a1 1 0 00-1.352.115l-1.3 1.3a1 1 0 00-.115 1.352l.44.63c-.22.46-.42.935-.588 1.426l-.74.12a1 1 0 000 1.966l.74.12c.168.49.368.966.588 1.426l-.44.63a1 1 0 00.115 1.352l1.3 1.3a1 1 0 001.352.115l.63-.44c.46.22.935.42 1.426.588l.12.74a1 1 0 001.966 0l.12-.74c.49-.168.966-.368 1.426-.588l.63.44a1 1 0 001.352-.115l1.3-1.3a1 1 0 00.115-1.352l-.44-.63c.22-.46.42-.935.588-1.426l.74-.12a1 1 0 000-1.966l-.74-.12a7.52 7.52 0 00-.588-1.426l.44-.63a1 1 0 00-.115-1.352l-1.3-1.3a1 1 0 00-1.352-.115l-.63.44a7.52 7.52 0 00-1.426-.588l-.12-.74zM10 13.25a3.25 3.25 0 100-6.5 3.25 3.25 0 000 6.5z" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {appointment.assignmentMode === 'auto_assigned' && (
                                  <div className={`opacity-75 ${isCompactCard ? 'pt-0 text-[10px]' : 'pt-1 text-[11px]'}`}>
                                    {locale === 'ar' ? 'تم تعيينه تلقائياً' : 'Auto-assigned'}
                                  </div>
                                )}
                              </div>

                              {isNoteOpen && appointment.notes ? (
                                <div
                                  data-note-panel="true"
                                  className={`absolute top-16 z-30 w-56 rounded-2xl bg-white px-3 py-2 text-xs text-slate-700 shadow-xl ring-1 ring-slate-200 ${isRTL ? 'left-3' : 'right-3'}`}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <div className="mb-1 flex items-start justify-between gap-2 font-semibold text-slate-900">
                                    <span>{locale === 'ar' ? 'ملاحظة العميل' : 'Customer note'}</span>
                                    <button
                                      type="button"
                                      className="rounded-full px-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                                      aria-label={locale === 'ar' ? 'إغلاق الملاحظة' : 'Close note'}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setOpenNoteAppointmentId(null);
                                      }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <div className="whitespace-pre-wrap leading-relaxed">{appointment.notes}</div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function formatTime(hour: number, minute: number, locale: string): string {
  const date = new Date();
  date.setHours(hour, minute, 0);
  return date.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}
