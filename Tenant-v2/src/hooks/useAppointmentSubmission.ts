import { useState } from 'react';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';
import { extractBookingErrorMeta, isBookingConflictError, isBookingTooSoonError, BookingErrorMeta } from '../lib/bookingUiDialogs';

export interface BaseBookingPayload {
  staffId: string;
  startTime: string; // Must be guaranteed to be ISO string!
  notes?: string | null;
  assignmentMode?: 'tenant_reassigned' | 'auto_assigned';
  notifyCustomer?: boolean;
  paymentMethod?: string;
  platformUserId?: string;
  customer?: any | null;
  paymentAllocations?: any[];
  skipAdvanceValidation?: boolean;
}

export interface SubmissionOptions {
  enablePaymentAllocations?: boolean;
}

export interface SubmissionCallbacks {
  onSuccess: (appointment: any) => void;
  onConflict: (items: any[], errorMeta: BookingErrorMeta) => void;
  onTooSoon: (errorMeta: BookingErrorMeta) => void;
  onError: (error: Error) => void;
}

/**
 * Shared hook to execute the final appointment submission to the backend.
 * Extracted from InteractiveDrawers.tsx / AppointmentWorkspace.tsx.
 */
export const useAppointmentSubmission = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const executeFinalSubmission = async (
    itemsToSubmit: any[],
    basePayload: BaseBookingPayload,
    callbacks: SubmissionCallbacks
  ) => {
    setIsSubmitting(true);
    try {
      const payload: any = {
        ...basePayload,
        items: itemsToSubmit
      };

      const response = await tenantApiAdapter.createAppointment(payload);

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to create appointment');
      }

      const createdAppointment = response?.appointment || response?.appointments?.[0] || null;
      callbacks.onSuccess(createdAppointment);

    } catch (err: any) {
      console.error('Failed to create appointment', err);
      const errorMeta = extractBookingErrorMeta(err);

      if (isBookingTooSoonError(errorMeta)) {
        callbacks.onTooSoon(errorMeta);
      } else if (isBookingConflictError(errorMeta)) {
        callbacks.onConflict(itemsToSubmit, errorMeta);
      } else {
        callbacks.onError(err);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    executeFinalSubmission
  };
};
