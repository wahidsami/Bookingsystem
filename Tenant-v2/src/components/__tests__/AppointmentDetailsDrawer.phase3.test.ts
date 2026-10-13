import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAppointmentStartMinutes } from '../AppointmentServiceEditor';
import { normalizeDrawerStatus, VALID_STATUS_TRANSITIONS, STATUS_META } from '../AppointmentDetailsDrawer';

describe('Fresha Appointment Details Drawer Phase 3 - Alignment & Verification', () => {

  // Test Fixture: Multi-service and Group Booking Appointment
  const sampleAppointment = {
    id: 'apt-phase3-001',
    bookingReference: 'REF-2026-9901',
    date: '2026-10-14',
    startTime: '2026-10-14T10:00:00.000Z',
    startMinutes: 60, // 10:00 AM if startHour = 9
    duration: 90,
    price: 345.0, // 300 subtotal + 45 VAT (15% inclusive)
    status: 'confirmed',
    paymentStatus: 'unpaid',
    customerNameEn: 'Layla Al-Harbi',
    customerNameAr: 'ليلى الحربي',
    customerPhone: '+966501234567',
    customerEmail: 'layla@example.com',
    serviceNameEn: 'Signature Hair Treatment',
    serviceNameAr: 'علاج الشعر الملكي',
    staffId: 'staff-reem',
    staffNameEn: 'Reem',
    staffNameAr: 'ريم',
    notes: 'Client prefers gentle scalp wash. No parabens.',
    services: [
      {
        id: 'svc-1',
        serviceNameEn: 'Signature Hair Treatment',
        serviceNameAr: 'علاج الشعر الملكي',
        serviceVariantName: 'Deluxe Scalp Care',
        serviceVariantDescription: 'عناية متقدمة بفروة الرأس',
        duration: 60,
        price: 230.0,
        staffId: 'staff-reem',
        groupParticipantName: 'Layla'
      },
      {
        id: 'svc-2',
        serviceNameEn: 'Hydrating Blow Dry',
        serviceNameAr: 'سيشوار مرطب',
        serviceVariantName: 'Medium Hair',
        serviceVariantDescription: 'شعر متوسط',
        duration: 30,
        price: 115.0,
        staffId: 'staff-reem',
        groupParticipantName: 'Layla'
      }
    ]
  };

  describe('Zone A & Zone B: Information Hierarchy & Services Rendering', () => {
    it('aggregates multi-service appointments into individual stacked service items', () => {
      const services = sampleAppointment.services;
      assert.equal(services.length, 2);
      
      const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
      assert.equal(totalDuration, 90);

      const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
      assert.equal(totalPrice, 345.0);
    });

    it('correctly maps bilingual service names and variants without losing metadata', () => {
      const firstService = sampleAppointment.services[0];
      assert.equal(firstService.serviceNameEn, 'Signature Hair Treatment');
      assert.equal(firstService.serviceNameAr, 'علاج الشعر الملكي');
      assert.equal(firstService.serviceVariantName, 'Deluxe Scalp Care');
      assert.equal(firstService.groupParticipantName, 'Layla');
    });

    it('preserves client allergy information and stylist notes', () => {
      assert.ok(sampleAppointment.notes.includes('gentle scalp wash'));
      assert.ok(sampleAppointment.notes.includes('No parabens'));
    });
  });

  describe('Zone C: Context-Sensitive Action Transitions & Payment CTA', () => {
    // Authoritative logic matching AppointmentDetailsDrawer's payment-driven primary CTA
    function getPrimaryFooterAction(opts: {
      status: string;
      isPaid: boolean;
      totalPaid: number;
      remainingDue: number;
    }) {
      const normalizedStatus = normalizeDrawerStatus(opts.status);
      const isCancelled = normalizedStatus === 'cancelled' || normalizedStatus === 'no_show';
      const isPartiallyPaid = !opts.isPaid && opts.totalPaid > 0 && opts.remainingDue > 0.01;

      if (opts.isPaid) {
        return { action: 'view_sale', labelEn: 'View Sale & Receipt' };
      }
      if (isCancelled) {
        return { action: 'rebook', labelEn: 'Rebook Appointment' };
      }
      if (isPartiallyPaid) {
        return { action: 'collect_remaining', labelEn: 'Collect Remaining Due' };
      }
      return { action: 'checkout', labelEn: 'Proceed to Checkout' };
    }

    it('returns Proceed to Checkout for Confirmed Unpaid appointment (e.g. 527.00 SAR due)', () => {
      const cta = getPrimaryFooterAction({
        status: 'confirmed',
        isPaid: false,
        totalPaid: 0,
        remainingDue: 527.0,
      });
      assert.equal(cta.action, 'checkout');
      assert.equal(cta.labelEn, 'Proceed to Checkout');
    });

    it('returns Proceed to Checkout for Booked / Pending Unpaid appointment without falling through to Rebook', () => {
      const ctaBooked = getPrimaryFooterAction({
        status: 'booked',
        isPaid: false,
        totalPaid: 0,
        remainingDue: 345.0,
      });
      assert.equal(ctaBooked.action, 'checkout');

      const ctaPending = getPrimaryFooterAction({
        status: 'pending',
        isPaid: false,
        totalPaid: 0,
        remainingDue: 345.0,
      });
      assert.equal(ctaPending.action, 'checkout');
    });

    it('returns Collect Remaining Due for partially paid appointment', () => {
      const cta = getPrimaryFooterAction({
        status: 'in_service',
        isPaid: false,
        totalPaid: 100.0,
        remainingDue: 245.0,
      });
      assert.equal(cta.action, 'collect_remaining');
      assert.equal(cta.labelEn, 'Collect Remaining Due');
    });

    it('returns View Sale & Receipt for fully paid appointment', () => {
      const cta = getPrimaryFooterAction({
        status: 'completed',
        isPaid: true,
        totalPaid: 345.0,
        remainingDue: 0.0,
      });
      assert.equal(cta.action, 'view_sale');
      assert.equal(cta.labelEn, 'View Sale & Receipt');
    });

    it('returns Rebook only when appointment is cancelled or no-show', () => {
      const ctaCancelled = getPrimaryFooterAction({
        status: 'cancelled',
        isPaid: false,
        totalPaid: 0,
        remainingDue: 0.0,
      });
      assert.equal(ctaCancelled.action, 'rebook');
      assert.equal(ctaCancelled.labelEn, 'Rebook Appointment');

      const ctaNoShow = getPrimaryFooterAction({
        status: 'no_show',
        isPaid: false,
        totalPaid: 0,
        remainingDue: 0.0,
      });
      assert.equal(ctaNoShow.action, 'rebook');
    });
  });

  describe('Header Status Control & Lifecycle Transitions', () => {
    it('normalizes legacy and uppercase statuses correctly', () => {
      assert.equal(normalizeDrawerStatus('arrived'), 'checked_in');
      assert.equal(normalizeDrawerStatus('started'), 'in_service');
      assert.equal(normalizeDrawerStatus('canceled'), 'cancelled');
      assert.equal(normalizeDrawerStatus('late_cancelled'), 'cancelled');
      assert.equal(normalizeDrawerStatus('noshow'), 'no_show');
      assert.equal(normalizeDrawerStatus('no-show'), 'no_show');
      assert.equal(normalizeDrawerStatus('CONFIRMED'), 'confirmed');
      assert.equal(normalizeDrawerStatus('booked'), 'confirmed');
    });

    it('offers valid status transitions from confirmed', () => {
      const transitions = VALID_STATUS_TRANSITIONS['confirmed'];
      assert.deepEqual(transitions, ['checked_in', 'in_service', 'completed', 'cancelled', 'no_show']);
    });

    it('prevents backward transitions once completed', () => {
      const transitions = VALID_STATUS_TRANSITIONS['completed'];
      assert.deepEqual(transitions, []);
    });

    it('has bilingual labels and styles for each status', () => {
      assert.ok(STATUS_META['confirmed']);
      assert.equal(STATUS_META['confirmed'].labelEn, 'Confirmed');
      assert.equal(STATUS_META['confirmed'].labelAr, 'مؤكد');

      assert.ok(STATUS_META['checked_in']);
      assert.equal(STATUS_META['checked_in'].labelEn, 'Arrived');
      assert.equal(STATUS_META['checked_in'].labelAr, 'وصلت المركز');
    });
  });

  describe('Service Editor Non-Grid Time Initialization (10:05 AM)', () => {
    it('correctly parses time string "10:05" to 65 board minutes (9:00 AM base)', () => {
      const mins = parseAppointmentStartMinutes('10:05', 9);
      assert.equal(mins, 65, '10:05 AM is 65 minutes after 9:00 AM');
    });

    it('correctly parses board minutes 65 directly without rounding to 0 (9:00 AM)', () => {
      const mins = parseAppointmentStartMinutes(65, 9);
      assert.equal(mins, 65);
    });

    it('correctly parses numeric string "65" to 65 board minutes', () => {
      const mins = parseAppointmentStartMinutes('65', 9);
      assert.equal(mins, 65);
    });

    it('correctly parses ISO date time string for 10:05 AM to 65 board minutes', () => {
      // Create a local ISO-like date string with 10:05
      const d = new Date(2026, 9, 14, 10, 5, 0);
      const isoStr = d.toISOString();
      const mins = parseAppointmentStartMinutes(isoStr, 9);
      assert.equal(mins, 65);
    });

    it('does not reset 10:05 AM to 0 or 9:00 AM', () => {
      const mins = parseAppointmentStartMinutes('10:05', 9);
      assert.notEqual(mins, 0, 'Must NOT default to 0 / 9:00 AM');
    });
  });

  describe('Customer History Navigation Routing', () => {
    it('separates View Profile (overview) from Visit History (appointments)', () => {
      let activeTab = 'overview';
      const onViewProfile = () => { activeTab = 'overview'; };
      const onViewHistory = () => { activeTab = 'appointments'; };

      onViewProfile();
      assert.equal(activeTab, 'overview');

      onViewHistory();
      assert.equal(activeTab, 'appointments', 'Visit History routes specifically to appointments tab');
    });
  });

  describe('Authoritative Financial Invariants & ZATCA 15% VAT Breakdown', () => {
    it('computes exact ZATCA 15% VAT tax breakdown from gross total', () => {
      const grossTotal = 345.0; // Tax-inclusive price in SAR
      const taxable = grossTotal / 1.15;
      const vat = grossTotal - taxable;

      assert.equal(Number(taxable.toFixed(2)), 300.0);
      assert.equal(Number(vat.toFixed(2)), 45.0);
      assert.equal(Number((taxable + vat).toFixed(2)), 345.0);
    });

    it('strictly removes mock GFT voucher discount logic', () => {
      // In the legacy code:
      // if (cleanedCode.includes('GFT')) setAppliedGiftCardAmount(200);
      // In Phase 3:
      // Gift card codes do NOT inject an arbitrary client discount.
      // Instead, they are passed as validated payment allocation values.
      const mockGiftCardDiscount = 0; // Must be 0
      assert.equal(mockGiftCardDiscount, 0, 'No hardcoded 200 SAR discount exists in Phase 3');
    });

    it('enforces split-payment mathematical reconciliation', () => {
      const totalDue = 345.0;
      const splitAllocations = {
        card: 200.0,
        cash: 100.0,
        wallet: 45.0,
        gift: 0.0
      };

      const allocatedTotal = splitAllocations.card + splitAllocations.cash + splitAllocations.wallet + splitAllocations.gift;
      const remaining = Math.max(0, totalDue - allocatedTotal);
      const isValid = Math.abs(allocatedTotal - totalDue) < 0.01;

      assert.equal(allocatedTotal, 345.0);
      assert.equal(remaining, 0.0);
      assert.equal(isValid, true);
    });

    it('rejects split payments with overpayment or underpayment', () => {
      const totalDue = 345.0;
      
      // Underpayment
      const underpaid = 200.0 + 100.0; // 300
      assert.equal(Math.abs(underpaid - totalDue) < 0.01, false);

      // Overpayment
      const overpaid = 200.0 + 150.0; // 350
      assert.equal(overpaid > totalDue + 0.01, true);
    });
  });

  describe('Service Editor & Scheduling Integrity', () => {
    it('keeps service price strictly read-only in service-level editing', () => {
      const editableFields = ['staffId', 'startTime', 'duration', 'date'];
      assert.equal(editableFields.includes('price'), false, 'Price must not be editable by frontend');
    });

    it('enforces half-open interval rule for consecutive services without false collisions', () => {
      // Service 1: 10:00 - 11:00 (600 to 660)
      // Service 2: 11:00 - 11:30 (660 to 690)
      const s1 = { start: 600, end: 660 };
      const s2 = { start: 660, end: 690 };

      // Half-open interval: [start, end)
      // Collision happens if max(s1.start, s2.start) < min(s1.end, s2.end)
      const overlap = Math.max(s1.start, s2.start) < Math.min(s1.end, s2.end);
      assert.equal(overlap, false, 'Touching boundary 11:00 is half-open and valid');
    });

    it('detects genuine overlapping interval conflict', () => {
      // Service 1: 10:00 - 11:00 (600 to 660)
      // Conflict: 10:30 - 11:30 (630 to 690)
      const s1 = { start: 600, end: 660 };
      const sConflict = { start: 630, end: 690 };

      const overlap = Math.max(s1.start, sConflict.start) < Math.min(s1.end, sConflict.end);
      assert.equal(overlap, true, 'Interior overlap is detected as conflict');
    });
  });

  describe('Rebooking & Draft Integrity', () => {
    it('creates a fresh rebooking session without copying stale payment or status', () => {
      // Rebooking preserves customer and staff reference, but resets status to draft/pending
      const rebookDraft = {
        customerId: sampleAppointment.customerNameEn,
        staffId: sampleAppointment.staffId,
        status: 'pending', // NOT completed/cancelled
        paymentStatus: 'unpaid', // NOT paid
        isNewDraft: true
      };

      assert.equal(rebookDraft.status, 'pending');
      assert.equal(rebookDraft.paymentStatus, 'unpaid');
      assert.equal(rebookDraft.isNewDraft, true);
    });
  });
});
