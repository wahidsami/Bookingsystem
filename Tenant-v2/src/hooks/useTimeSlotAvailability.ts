import { useState, useEffect, useMemo } from 'react';
import { getDatePartsInTimeZone, resolveTenantTimezone } from '../lib/tenantTime';
import { to12HourTime } from '../lib/employeeHelpers';

export interface TimeSlotOption {
  value: string; // "HH:MM" 24h
  label: string; // "hh:mm AM/PM"
  minutes: number; // absolute minutes of day (0-1440)
  available: boolean;
  reason?: string;
  reasonType?: 'available' | 'booked' | 'break' | 'time_off' | 'outside_working_hours' | 'outside_operating_hours' | 'buffer' | 'conflict';
}

export interface StagedItemContext {
  id?: string;
  staffId?: string;
  startTime?: number; // offset minutes from boardStartHour
  duration?: number;
}

interface UseTimeSlotAvailabilityProps {
  tenantId: string;
  tenantTimezone: string;
  dateKey: string;
  serviceId: string;
  variantId?: string;
  staffId?: string;
  duration: number;
  bufferBefore?: number;
  bufferAfter?: number;
  boardStartHour?: number;
  slotMinutes?: number;
  otherStagedServices?: StagedItemContext[];
  isRtl?: boolean;
}

export function useTimeSlotAvailability({
  tenantId,
  tenantTimezone,
  dateKey,
  serviceId,
  variantId,
  staffId,
  duration,
  bufferBefore = 0,
  bufferAfter = 0,
  boardStartHour = 9,
  slotMinutes = 5,
  otherStagedServices = [],
  isRtl = false
}: UseTimeSlotAvailabilityProps) {
  const [scheduleContext, setScheduleContext] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const timezone = resolveTenantTimezone(tenantTimezone);
  const offsetBaseMinutes = boardStartHour * 60;

  // Fetch schedule context from backend availability service whenever staff, service, or date changes
  useEffect(() => {
    if (!tenantId || !staffId || !dateKey || !serviceId) {
      setScheduleContext(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const fetchContext = async () => {
      try {
        const { tenantApiAdapter } = await import('../lib/tenantApiAdapter');
        const response = await tenantApiAdapter.searchAvailability({
          tenantId,
          serviceId,
          staffId,
          date: dateKey,
          variantId
        });

        if (!isMounted) return;

        if (response?.scheduleContext) {
          setScheduleContext(response.scheduleContext);
        } else {
          setScheduleContext(null);
        }
      } catch (err) {
        if (isMounted) {
          setScheduleContext(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchContext();

    return () => {
      isMounted = false;
    };
  }, [tenantId, staffId, dateKey, serviceId, variantId]);

  // Evaluates all candidate time slots for the day
  const slots = useMemo(() => {
    const options: TimeSlotOption[] = [];
    const step = Math.max(1, slotMinutes);
    const resolvedDuration = Math.max(1, Number(duration) || 30);
    const safeBufferBefore = Math.max(0, Number(bufferBefore) || 0);
    const safeBufferAfter = Math.max(0, Number(bufferAfter) || 0);

    // Parse parsed intervals from scheduleContext
    let tenantOpenMinutes = 0;
    let tenantCloseMinutes = 24 * 60;
    let hasTenantHours = false;

    if (scheduleContext?.tenantHours) {
      const { start, end } = scheduleContext.tenantHours;
      if (start && end) {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        tenantOpenMinutes = sh * 60 + sm;
        tenantCloseMinutes = eh * 60 + em;
        hasTenantHours = true;
      }
    }

    // Convert employee duty windows to minutes of day
    const dutyWindows: Array<{ startMin: number; endMin: number }> = (scheduleContext?.employeeDutyWindows || []).map((w: any) => {
      const sParts = getDatePartsInTimeZone(new Date(w.startTime), timezone);
      const eParts = getDatePartsInTimeZone(new Date(w.endTime), timezone);
      return {
        startMin: Number(sParts.hour) * 60 + Number(sParts.minute),
        endMin: Number(eParts.hour) * 60 + Number(eParts.minute)
      };
    });

    // Convert breaks to minutes of day
    const breaks: Array<{ startMin: number; endMin: number; label?: string; type?: string }> = (scheduleContext?.breaks || []).map((b: any) => {
      const sParts = getDatePartsInTimeZone(new Date(b.startTime), timezone);
      const eParts = getDatePartsInTimeZone(new Date(b.endTime), timezone);
      return {
        startMin: Number(sParts.hour) * 60 + Number(sParts.minute),
        endMin: Number(eParts.hour) * 60 + Number(eParts.minute),
        label: b.label,
        type: b.type
      };
    });

    // Convert time-off to minutes of day
    const timeOff: Array<{ startMin: number; endMin: number }> = (scheduleContext?.timeOff || []).map((t: any) => {
      const sParts = getDatePartsInTimeZone(new Date(t.startTime), timezone);
      const eParts = getDatePartsInTimeZone(new Date(t.endTime), timezone);
      return {
        startMin: Number(sParts.hour) * 60 + Number(sParts.minute),
        endMin: Number(eParts.hour) * 60 + Number(eParts.minute)
      };
    });

    // Convert existing appointments to minutes of day
    const existingAppointments: Array<{ id: string; startMin: number; endMin: number }> = (scheduleContext?.existingAppointments || []).map((a: any) => {
      const sParts = getDatePartsInTimeZone(new Date(a.startTime), timezone);
      const eParts = getDatePartsInTimeZone(new Date(a.endTime), timezone);
      return {
        id: a.id,
        startMin: Number(sParts.hour) * 60 + Number(sParts.minute),
        endMin: Number(eParts.hour) * 60 + Number(eParts.minute)
      };
    });

    // Convert other staged services for this staff member to minutes of day
    const stagedItemsForStaff = (otherStagedServices || [])
      .filter((item) => item.staffId && item.staffId === staffId && item.startTime !== undefined)
      .map((item) => {
        const startMin = offsetBaseMinutes + Math.max(0, Math.round(Number(item.startTime || 0)));
        const itemDuration = Math.max(1, Number(item.duration || 30));
        return {
          startMin,
          endMin: startMin + itemDuration
        };
      });

    // Loop through all candidate minutes of the day from offsetBaseMinutes to 24*60
    for (let candidateMinutes = offsetBaseMinutes; candidateMinutes < 24 * 60; candidateMinutes += step) {
      const hours = Math.floor(candidateMinutes / 60);
      const minutes = candidateMinutes % 60;
      const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      const label = to12HourTime(value);

      const candidateStart = candidateMinutes;
      const candidateEnd = candidateStart + resolvedDuration;

      // If no staff member is selected, treat all slots as available (subject to operating hours if present)
      if (!staffId) {
        options.push({
          value,
          label,
          minutes: candidateMinutes,
          available: true,
          reason: isRtl ? 'متاح' : 'Available',
          reasonType: 'available'
        });
        continue;
      }

      // If staff member is selected but scheduleContext has not loaded yet
      if (!scheduleContext) {
        options.push({
          value,
          label,
          minutes: candidateMinutes,
          available: true,
          reason: isRtl ? 'جاري التحقق...' : 'Checking...',
          reasonType: 'available'
        });
        continue;
      }

      // Check 1: Tenant Operating Hours
      if (hasTenantHours && (candidateStart < tenantOpenMinutes || candidateEnd > tenantCloseMinutes)) {
        options.push({
          value,
          label,
          minutes: candidateMinutes,
          available: false,
          reason: isRtl ? 'خارج ساعات العمل' : 'Outside Operating Hours',
          reasonType: 'outside_operating_hours'
        });
        continue;
      }

      // Check 2: Employee Duty / Working Hours
      if (dutyWindows.length > 0) {
        const fitsInDuty = dutyWindows.some((w) => candidateStart >= w.startMin && candidateEnd <= w.endMin);
        if (!fitsInDuty) {
          options.push({
            value,
            label,
            minutes: candidateMinutes,
            available: false,
            reason: isRtl ? 'خارج الدوام' : 'Outside Working Hours',
            reasonType: 'outside_working_hours'
          });
          continue;
        }
      } else {
        // Staff has no scheduled duty on this date
        options.push({
          value,
          label,
          minutes: candidateMinutes,
          available: false,
          reason: isRtl ? 'خارج الدوام' : 'Outside Working Hours',
          reasonType: 'outside_working_hours'
        });
        continue;
      }

      // Check 3: Staff Breaks
      const breakBlocker = breaks.find((b) => candidateStart < b.endMin && candidateEnd > b.startMin);
      if (breakBlocker) {
        const label = breakBlocker.type === 'meeting' || breakBlocker.type === 'other'
          ? (isRtl ? 'وقت محجوز' : 'Blocked')
          : (isRtl ? 'استراحة' : 'Break');
        options.push({
          value,
          label,
          minutes: candidateMinutes,
          available: false,
          reason: breakBlocker.label || label,
          reasonType: 'break'
        });
        continue;
      }

      // Check 4: Staff Time-Off
      const timeOffBlocker = timeOff.find((t) => candidateStart < t.endMin && candidateEnd > t.startMin);
      if (timeOffBlocker) {
        options.push({
          value,
          label,
          minutes: candidateMinutes,
          available: false,
          reason: isRtl ? 'إجازة' : 'Time Off',
          reasonType: 'time_off'
        });
        continue;
      }

      // Check 5: Existing Appointments (with service buffers)
      const candidateReqStart = candidateStart - safeBufferBefore;
      const candidateReqEnd = candidateEnd + safeBufferAfter;

      const apptBlocker = existingAppointments.find((a) => {
        return candidateReqStart < a.endMin && candidateReqEnd > a.startMin;
      });

      if (apptBlocker) {
        const directOverlap = candidateStart < apptBlocker.endMin && candidateEnd > apptBlocker.startMin;
        options.push({
          value,
          label,
          minutes: candidateMinutes,
          available: false,
          reason: directOverlap ? (isRtl ? 'محجوز' : 'Booked') : (isRtl ? 'فاصل زمني' : 'Buffer'),
          reasonType: directOverlap ? 'booked' : 'buffer'
        });
        continue;
      }

      // Check 6: Other Staged Services for the same staff in current session
      const stagedConflict = stagedItemsForStaff.find((item) => {
        return candidateStart < item.endMin && candidateEnd > item.startMin;
      });

      if (stagedConflict) {
        options.push({
          value,
          label,
          minutes: candidateMinutes,
          available: false,
          reason: isRtl ? 'تعارض بالجلسة' : 'Conflict',
          reasonType: 'conflict'
        });
        continue;
      }

      // Slot is fully available
      options.push({
        value,
        label,
        minutes: candidateMinutes,
        available: true,
        reason: isRtl ? 'متاح' : 'Available',
        reasonType: 'available'
      });
    }

    return options;
  }, [
    scheduleContext,
    staffId,
    duration,
    bufferBefore,
    bufferAfter,
    boardStartHour,
    slotMinutes,
    otherStagedServices,
    isRtl,
    offsetBaseMinutes,
    timezone
  ]);

  return {
    slots,
    loading,
    scheduleContext
  };
}
