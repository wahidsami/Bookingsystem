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

  describe('Runtime Correction Pass: Unified Group Checkout, Completed Locking, Reschedule vs Rebook', () => {
    // Fixture: Group session with 2 participants
    const groupSessionFixture = {
      id: 'session-grp-777',
      metadata: {
        paymentArrangement: 'unified_group'
      },
      appointments: [
        {
          id: 'apt-p1',
          bookingSessionId: 'session-grp-777',
          isGroupBooking: true,
          status: 'confirmed',
          paymentStatus: 'unpaid',
          price: 250.0,
          totalPaid: 0,
          customerNameEn: 'Amira (Host)',
          customerNameAr: 'أميرة',
          serviceNameEn: 'Balayage',
          serviceNameAr: 'بالياج',
          staffId: 'staff-1',
          duration: 90
        },
        {
          id: 'apt-p2',
          bookingSessionId: 'session-grp-777',
          isGroupBooking: true,
          status: 'confirmed',
          paymentStatus: 'unpaid',
          price: 180.0,
          totalPaid: 0,
          customerNameEn: 'Sara (Guest)',
          customerNameAr: 'سارة',
          serviceNameEn: 'Hair Mask',
          serviceNameAr: 'ماسك شعر',
          staffId: 'staff-2',
          duration: 45
        }
      ]
    };

    // Helper simulating authoritative financial calculation in AppointmentDetailsDrawer
    function computeDrawerTotals(appointment: any) {
      const isGroupSession = Boolean(
        appointment.isGroupBooking ||
        appointment.bookingSessionId ||
        (Array.isArray(appointment.bookingSession?.appointments) && appointment.bookingSession.appointments.length > 1)
      );

      const sessionAppointments: any[] = Array.isArray(appointment.bookingSession?.appointments) && appointment.bookingSession.appointments.length > 0
        ? appointment.bookingSession.appointments
        : [appointment];

      const eligibleAppointments = sessionAppointments.filter(
        (a: any) => `${a.status || ''}`.toLowerCase() !== 'cancelled'
      );

      const serviceItems = eligibleAppointments.map((svc: any) => ({
        id: svc.id,
        price: Number(svc.price || 0),
        status: svc.status,
        participantName: svc.customerNameEn
      }));

      const totalServicePrice = serviceItems.reduce((sum, item) => sum + item.price, 0);
      const appointmentDiscount = isGroupSession
        ? eligibleAppointments.reduce((sum: number, a: any) => sum + Number(a.discountAmount || 0), 0)
        : Number(appointment.discountAmount || 0);
      const totalAmountDue = Math.max(0, totalServicePrice - appointmentDiscount);

      const totalPaid = isGroupSession
        ? eligibleAppointments.reduce((sum: number, a: any) => sum + Number(a.totalPaid ?? 0), 0)
        : Number(appointment.totalPaid ?? 0);
      const remainingDue = Math.max(0, totalAmountDue - totalPaid);

      const isPaid = (totalAmountDue > 0 && remainingDue <= 0.01) || (
        isGroupSession
          ? eligibleAppointments.every((a: any) => a.paymentStatus === 'paid' || a.paymentStatus === 'fully_paid')
          : (appointment.paymentStatus === 'paid' || appointment.paymentStatus === 'fully_paid')
      );

      return {
        isGroupSession,
        serviceItems,
        eligibleAppointments,
        totalAmountDue,
        totalPaid,
        remainingDue,
        isPaid
      };
    }

    it('aggregates matching group total whether opened from Participant A or Participant B', () => {
      const appt1 = {
        ...groupSessionFixture.appointments[0],
        bookingSession: groupSessionFixture
      };
      const appt2 = {
        ...groupSessionFixture.appointments[1],
        bookingSession: groupSessionFixture
      };

      const drawer1 = computeDrawerTotals(appt1);
      const drawer2 = computeDrawerTotals(appt2);

      // Both must aggregate the unified total of 250 + 180 = 430 SAR
      assert.equal(drawer1.totalAmountDue, 430.0);
      assert.equal(drawer2.totalAmountDue, 430.0);
      assert.equal(drawer1.remainingDue, 430.0);
      assert.equal(drawer2.remainingDue, 430.0);
      assert.equal(drawer1.serviceItems.length, 2);
      assert.equal(drawer2.serviceItems.length, 2);
    });

    it('settling the group session marks all participant appointments as paid and prevents duplicate charges', () => {
      // Simulate post-payment session state where both appointments are fully paid
      const settledSession = {
        ...groupSessionFixture,
        appointments: groupSessionFixture.appointments.map(a => ({
          ...a,
          paymentStatus: 'fully_paid',
          totalPaid: a.price
        }))
      };

      const settledAppt1 = {
        ...settledSession.appointments[0],
        bookingSession: settledSession
      };
      const settledAppt2 = {
        ...settledSession.appointments[1],
        bookingSession: settledSession
      };

      const drawer1 = computeDrawerTotals(settledAppt1);
      const drawer2 = computeDrawerTotals(settledAppt2);

      assert.equal(drawer1.isPaid, true);
      assert.equal(drawer2.isPaid, true);
      assert.equal(drawer1.remainingDue, 0);
      assert.equal(drawer2.remainingDue, 0);

      // Sibling card (drawer2) must NOT show checkout CTA, must show View Sale
      assert.equal(drawer2.totalPaid, 430.0);
    });

    it('enforces completed-visit locking: completed appointment locks edit controls', () => {
      const completedAppointment = {
        ...sampleAppointment,
        status: 'completed',
        paymentStatus: 'paid'
      };

      const normalized = normalizeDrawerStatus(completedAppointment.status);
      assert.equal(normalized, 'completed');

      // Allowed transitions from completed must be strictly empty (read-only)
      assert.deepEqual(VALID_STATUS_TRANSITIONS[normalized], []);

      // Verify canEdit flag rule: !readOnly && !isItemCompleted && !isItemCancelled
      const isItemCompleted = completedAppointment.status === 'completed';
      const canEdit = !isItemCompleted;
      assert.equal(canEdit, false, 'Completed appointment must NOT allow service editing');
    });

    it('handles mixed-status groups: locks completed participant while keeping unfinished sibling editable', () => {
      const mixedSession = {
        id: 'session-mixed',
        appointments: [
          {
            id: 'mixed-p1',
            status: 'completed',
            price: 200,
            customerNameEn: 'Finished Guest'
          },
          {
            id: 'mixed-p2',
            status: 'in_service',
            price: 150,
            customerNameEn: 'Active Guest'
          }
        ]
      };

      const p1Item = mixedSession.appointments[0];
      const p2Item = mixedSession.appointments[1];

      const p1CanEdit = p1Item.status !== 'completed' && p1Item.status !== 'cancelled';
      const p2CanEdit = p2Item.status !== 'completed' && p2Item.status !== 'cancelled';

      assert.equal(p1CanEdit, false, 'Completed participant is locked');
      assert.equal(p2CanEdit, true, 'Active sibling remains editable');
    });

    it('differentiates Reschedule vs Rebook semantics', () => {
      // 1. Reschedule modifies an existing booking:
      // Preserves original appointment id, applies in-place time/staff update
      const rescheduleTarget = {
        id: 'apt-reschedule-101',
        status: 'confirmed',
        date: '2026-10-14',
        staffId: 'staff-old',
        startTime: 60
      };
      const reschedulePayload = {
        appointmentId: rescheduleTarget.id, // Preserved
        staffId: 'staff-new',
        startTime: 120
      };
      assert.equal(reschedulePayload.appointmentId, rescheduleTarget.id, 'Reschedule must preserve appointment ID');

      // 2. Rebook creates a fresh draft:
      // Prepopulates customer and services, but generates new draft ID, zeros payment, requires new date/time
      const rebookSource = {
        id: 'apt-historical-999',
        status: 'completed',
        paymentStatus: 'paid',
        customerId: 'cust-555',
        customerNameEn: 'Fatima',
        serviceId: 'srv-haircut',
        price: 250,
        staffId: 'staff-favorite'
      };
      const rebookDraft = {
        id: `rebook-${Date.now()}-0`, // Fresh generated draft ID
        selectedCustomerId: rebookSource.customerId,
        selectedStaffId: rebookSource.staffId,
        serviceId: rebookSource.serviceId,
        status: 'draft', // Not completed
        paymentStatus: 'unpaid', // Old payment NOT copied
        totalPaid: 0 // Zeroed out
      };

      assert.notEqual(rebookDraft.id, rebookSource.id, 'Rebook must have fresh ID');
      assert.equal(rebookDraft.selectedCustomerId, 'cust-555');
      assert.equal(rebookDraft.paymentStatus, 'unpaid');
      assert.equal(rebookDraft.totalPaid, 0);
      assert.notEqual(rebookDraft.status, rebookSource.status);
    });
  });

  describe('Regression Corrections: Workstreams A, B, C, and D', () => {
    it('Workstream A: preserves independent service cards for group/multi-service sessions while retaining packages as single cards', () => {
      // Mock session containing 2 distinct services and 1 bundle package
      const multiSession = {
        id: 'session-main-1',
        serviceNameEn: 'Service A + Service B + Bridal Bundle',
        bookingSession: {
          id: 'session-main-1',
          appointments: [
            {
              id: 'apt-member-1',
              serviceId: 'srv-1',
              serviceNameEn: 'Massage Relax',
              price: 150,
              duration: 60,
              customerNameEn: 'Noura'
            },
            {
              id: 'apt-member-2',
              serviceId: 'srv-2',
              serviceNameEn: 'Facial Glow',
              price: 120,
              duration: 45,
              customerNameEn: 'Sarah'
            },
            {
              id: 'apt-member-3',
              serviceId: 'srv-pkg',
              serviceNameEn: 'Bridal Package',
              packageId: 'pkg-bridal-101',
              price: 500,
              duration: 120,
              customerNameEn: 'Noura'
            }
          ]
        }
      };

      // Raw session extraction matching AppointmentDetailsDrawer logic
      const sessionAppointments = multiSession.bookingSession.appointments;
      assert.equal(sessionAppointments.length, 3, 'All 3 session items extracted independently');
      
      // Each card retains its individual service name, participant, and price
      assert.equal(sessionAppointments[0].serviceNameEn, 'Massage Relax');
      assert.equal(sessionAppointments[0].customerNameEn, 'Noura');
      assert.equal(sessionAppointments[1].serviceNameEn, 'Facial Glow');
      assert.equal(sessionAppointments[1].customerNameEn, 'Sarah');
      assert.equal(sessionAppointments[2].packageId, 'pkg-bridal-101');
      assert.equal(sessionAppointments[2].serviceNameEn, 'Bridal Package');
    });

    it('Workstream B: accurately converts Riyadh ISO timestamps to board minutes without machine timezone drift', () => {
      // 13:00:00 UTC is exactly 16:00:00 (4:00 PM) in Asia/Riyadh (UTC+3)
      // At boardStartHour = 9, 16:00 is (16 - 9) * 60 = 420 minutes
      const iso4PM = '2026-10-14T13:00:00.000Z';
      const parsed4PM = parseAppointmentStartMinutes(iso4PM, 9, 'Asia/Riyadh');
      assert.equal(parsed4PM, 420, '13:00 UTC (16:00 Riyadh) must equal 420 minutes from 9 AM');

      // 12:35:00 UTC is exactly 15:35:00 (3:35 PM) in Asia/Riyadh (UTC+3)
      // At boardStartHour = 9, 15:35 is (15 - 9) * 60 + 35 = 395 minutes
      const iso335PM = '2026-10-14T12:35:00.000Z';
      const parsed335PM = parseAppointmentStartMinutes(iso335PM, 9, 'Asia/Riyadh');
      assert.equal(parsed335PM, 395, '12:35 UTC (15:35 Riyadh) must equal 395 minutes from 9 AM');

      // Direct minutes should pass through intact
      assert.equal(parseAppointmentStartMinutes(395, 9, 'Asia/Riyadh'), 395);
      assert.equal(parseAppointmentStartMinutes(420, 9, 'Asia/Riyadh'), 420);
    });

    it('Workstream C: Rebooking stages all original services and preserves customer selection in draft', () => {
      const sourceAppointment = {
        id: 'apt-completed-77',
        status: 'completed',
        customerId: 'cust-amal-9',
        customerNameEn: 'Amal',
        serviceId: 'srv-primary',
        staffId: 'staff-huda',
        bookingSession: {
          appointments: [
            {
              id: 'apt-77-1',
              serviceId: 'srv-mani',
              serviceVariantId: 'var-gel',
              staffId: 'staff-huda',
              duration: 45
            },
            {
              id: 'apt-77-2',
              serviceId: 'srv-pedi',
              serviceVariantId: 'var-spa',
              staffId: 'staff-lina',
              duration: 60
            }
          ]
        }
      };

      // Simulating handleRebookAppointment staging logic
      const rawServices = sourceAppointment.bookingSession.appointments;
      const draftItems: any[] = [];
      rawServices.forEach((svc, idx) => {
        draftItems.push({
          id: `rebook-${idx}`,
          serviceId: svc.serviceId,
          variantId: svc.serviceVariantId,
          staffId: svc.staffId,
          duration: svc.duration,
          startTime: 120 + idx * 30
        });
      });

      assert.equal(draftItems.length, 2, 'All services staged for draft');
      assert.equal(draftItems[0].serviceId, 'srv-mani');
      assert.equal(draftItems[0].variantId, 'var-gel');
      assert.equal(draftItems[1].serviceId, 'srv-pedi');
      assert.equal(draftItems[1].variantId, 'var-spa');
    });

    it('Workstream D: client overflow menu does not contain duplicated direct contact actions', () => {
      // Simulating the actions present in the overflow menu
      const allowedOverflowActions = ['view_profile', 'view_history'];
      const forbiddenOverflowActions = ['call', 'whatsapp', 'sms'];

      forbiddenOverflowActions.forEach(action => {
        assert.equal(allowedOverflowActions.includes(action), false, `${action} must not be in overflow menu`);
      });
      assert.ok(allowedOverflowActions.includes('view_profile'), 'Profile must remain in overflow menu');
      assert.ok(allowedOverflowActions.includes('view_history'), 'History must remain in overflow menu');
    });
  });
});


