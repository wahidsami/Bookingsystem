import { useState, useEffect } from 'react';
import { fetchAvailabilityLayers } from '../services/availabilityService';
import { AvailabilityDiagnostic } from '../lib/bookingConflictDiagnostics';
import { buildTenantIsoFromMinutes } from '../lib/tenantTime';

export interface EarlyValidationResult {
  status: 'idle' | 'loading' | 'available' | 'unavailable';
  diagnostic?: AvailabilityDiagnostic;
}

export function useEarlyAvailabilityValidation({
  tenantId,
  serviceId,
  variantId,
  staffId,
  dateKey,
  startTimeMinutes,
  tenantTimezone,
  boardStartHour = 9,
}: {
  tenantId: string;
  serviceId: string;
  variantId?: string;
  staffId?: string;
  dateKey: string;
  startTimeMinutes: number;
  tenantTimezone: string;
  boardStartHour?: number;
}) {
  const [result, setResult] = useState<EarlyValidationResult>({ status: 'idle' });

  useEffect(() => {
    // 5. "Any Professional": Skip named-professional validation when no specific staff member is selected.
    if (!staffId || !serviceId || !dateKey || !tenantId) {
      setResult({ status: 'idle' });
      return;
    }

    let isMounted = true;
    setResult({ status: 'loading' });

    const validate = async () => {
      try {
        const { layers, diagnosticsByLayer, anyFailed } = await fetchAvailabilityLayers({
          tenantId,
          dateKey,
          items: [{
            serviceId,
            requestedStaffId: staffId,
            variantId
          }]
        });

        if (!isMounted) return;

        if (anyFailed || !layers[0]) {
          setResult({ status: 'unavailable', diagnostic: { reasonType: 'unknown' } });
          return;
        }

        const slots = layers[0];
        const diagnostics = diagnosticsByLayer[0] || [];
        
        // Convert the proposed startTime from minutes to an ISO string on the dateKey date
        const proposedStartTimeIso = buildTenantIsoFromMinutes(dateKey, startTimeMinutes, tenantTimezone, boardStartHour);
        const proposedStartTimeMs = new Date(proposedStartTimeIso).getTime();

        // Find the slot matching the proposed start time
        // We allow a small tolerance (e.g. exactly equal) because the UI clock aligns with backend steps
        const matchingSlot = slots.find((s: any) => new Date(s.startTime).getTime() === proposedStartTimeMs);

        if (matchingSlot && matchingSlot.available) {
          setResult({ status: 'available' });
        } else {
          // It's unavailable (either slot not found because outside working hours, or slot found but available = false)
          // Find the most relevant diagnostic that overlaps the proposed start time
          let relevantDiagnostic = diagnostics.find(d => {
            if (!d.startTime || !d.endTime) return false;
            const dStart = new Date(d.startTime).getTime();
            const dEnd = new Date(d.endTime).getTime();
            // We check if the proposed start time falls inside the diagnostic window
            // Since we don't know the exact end time on frontend, we assume if the start time is blocked, the whole thing is blocked.
            return proposedStartTimeMs >= dStart && proposedStartTimeMs < dEnd;
          });

          // Fallback if no exact overlap found (e.g. outside working hours for the whole day)
          if (!relevantDiagnostic && diagnostics.length > 0) {
            relevantDiagnostic = diagnostics[0];
          }

          setResult({
            status: 'unavailable',
            diagnostic: relevantDiagnostic || { reasonType: 'unknown' }
          });
        }
      } catch (err) {
        if (isMounted) {
          setResult({ status: 'unavailable', diagnostic: { reasonType: 'unknown' } });
        }
      }
    };

    // Debounce the validation slightly to avoid API spam while changing time quickly
    const timerId = setTimeout(validate, 300);

    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, [tenantId, serviceId, variantId, staffId, dateKey, startTimeMinutes, tenantTimezone, boardStartHour]);

  return result;
}
