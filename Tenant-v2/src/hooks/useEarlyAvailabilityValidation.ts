import { useState, useEffect } from 'react';
import { AvailabilityDiagnostic } from '../lib/bookingConflictDiagnostics';
import { buildTenantIsoFromMinutes } from '../lib/tenantTime';

export interface EarlyValidationResult {
  status: 'idle' | 'loading' | 'available' | 'unavailable' | 'needs_overtime';
  diagnostic?: AvailabilityDiagnostic;
  overtimeRequired?: boolean;
  workingHoursEnd?: string;
  reasonType?: string;
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
        const proposedStartTimeIso = buildTenantIsoFromMinutes(dateKey, startTimeMinutes, tenantTimezone, boardStartHour);
        const { tenantApiAdapter } = await import('../lib/tenantApiAdapter');
        const response = await tenantApiAdapter.evaluateScheduling({
          tenantId,
          serviceId,
          variantId,
          staffId,
          startTime: proposedStartTimeIso
        });

        if (!isMounted) return;

        if (response?.success && response?.decision?.valid) {
          setResult({ status: 'available' });
        } else {
          const decision = response?.decision || {};
          const isOvertimeCandidate = decision.overtimeRequired || 
            ['after_tenant_close', 'after_employee_duty'].includes(decision.reasonType);

          setResult({
            status: isOvertimeCandidate && !decision.hardConflict ? 'needs_overtime' : 'unavailable',
            diagnostic: decision,
            overtimeRequired: decision.overtimeRequired,
            reasonType: decision.reasonType,
            workingHoursEnd: decision.workingHoursEnd
          });
        }
      } catch (err) {
        if (isMounted) {
          setResult({
            status: 'unavailable',
            diagnostic: (err as any)?.payload?.decision || { reasonType: 'unknown' }
          });
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
