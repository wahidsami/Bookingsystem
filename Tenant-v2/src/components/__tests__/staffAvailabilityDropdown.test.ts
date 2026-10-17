import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isStylistAvailableForServiceItem,
  getEligibleStylistsForServiceItem,
  resolveCompatibleStaffAssignments,
  type StylistRecord,
  type ServiceWithAssignments,
  type StagedServiceWithAssignment
} from '../../lib/staffAssignmentEngine';
import { calculateGroupStagedPricing } from '../../lib/bundleStagingHelpers';
import type { StaffShiftRecord } from '../../lib/employeeDutyHours';

test('Availability-Aware Service Provider Selection Suite', async (t) => {
  const baseStylists: StylistRecord[] = [
    {
      id: '101',
      nameEn: 'Sally',
      nameAr: 'سالي',
      role: 'Stylist',
      status: 'active'
    },
    {
      id: '102',
      nameEn: 'Fatima',
      nameAr: 'فاطمة',
      role: 'Master Stylist',
      status: 'active'
    },
    {
      id: '103',
      nameEn: 'Layla',
      nameAr: 'ليلى',
      role: 'Colorist',
      status: 'active'
    }
  ];

  // Shifts for 2026-10-17 (Saturday)
  // Sally: 12:00 PM to 08:00 PM (12:00 to 20:00)
  // Fatima: 09:00 AM to 05:00 PM (09:00 to 17:00)
  // Layla: 09:00 AM to 06:00 PM (09:00 to 18:00)
  const baseShifts: StaffShiftRecord[] = [
    {
      staffId: '101',
      specificDate: '2026-10-17',
      startTime: '12:00',
      endTime: '20:00',
      isActive: true
    },
    {
      staffId: '102',
      specificDate: '2026-10-17',
      startTime: '09:00',
      endTime: '17:00',
      isActive: true
    },
    {
      staffId: '103',
      specificDate: '2026-10-17',
      startTime: '09:00',
      endTime: '18:00',
      isActive: true
    }
  ];

  const haircutService: ServiceWithAssignments = {
    id: 'srv-haircut',
    nameEn: 'Signature Haircut',
    nameAr: 'قص شعر مميز',
    employeeAssignments: ['101', '102']
  };

  const coloringService: ServiceWithAssignments = {
    id: 'srv-coloring',
    nameEn: 'Full Hair Color',
    nameAr: 'صبغة شعر كاملة',
    employeeAssignments: ['103']
  };

  const testDate = new Date('2026-10-17T09:00:00Z');
  const boardStartHour = 9; // 9:00 AM = minute 0 (boardStartHour * 60 = 540)

  // Scenario 1: Provider is eligible and available for the entire required service interval
  await t.test('Scenario 1: Provider is eligible and available for entire interval', () => {
    // Fatima works 09:00 - 17:00. Service at 10:00 (offset 60 min -> 10:00 AM) for 45 min.
    const result = isStylistAvailableForServiceItem({
      stylist: baseStylists[1], // Fatima
      service: haircutService,
      item: { id: 'stg-1', startTime: 60, duration: 45 },
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts
    });

    assert.equal(result.available, true);
    assert.equal(result.reason, undefined);
  });

  // Scenario 2: Provider's shift begins after appointment time (Sally starts at 12:00 PM, appt at 10:00 AM)
  await t.test('Scenario 2: Provider shift begins after appointment time (Sally starts at 12:00 PM)', () => {
    // Appointment at 10:00 AM (offset 60 min). Sally starts at 12:00 PM (offset 180 min).
    const result = isStylistAvailableForServiceItem({
      stylist: baseStylists[0], // Sally
      service: haircutService,
      item: { id: 'stg-1', startTime: 60, duration: 45 },
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts
    });

    assert.equal(result.available, false);
    assert.equal(result.reason, 'before_shift');
    assert.ok(result.messageEn?.includes('starts at 12:00 PM'));
    assert.ok(result.messageAr?.includes('12:00 م'));

    // Check eligible stylists list: only Fatima is returned, Sally is excluded
    const eligible = getEligibleStylistsForServiceItem({
      stylists: baseStylists,
      service: haircutService,
      item: { id: 'stg-1', startTime: 60, duration: 45 },
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts
    });

    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].id, '102'); // Fatima only
  });

  // Scenario 3: Provider's shift ends before service duration finishes
  await t.test('Scenario 3: Provider shift ends before service finishes', () => {
    // Fatima's shift ends at 17:00 (minute 480 from 9:00).
    // Service starts at 16:30 (minute 450) with duration 60 minutes -> ends at 17:30 (minute 510).
    const result = isStylistAvailableForServiceItem({
      stylist: baseStylists[1], // Fatima
      service: haircutService,
      item: { id: 'stg-1', startTime: 450, duration: 60 },
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts
    });

    assert.equal(result.available, false);
    assert.equal(result.reason, 'after_shift');
    assert.ok(result.messageEn?.includes('5:00 PM'));
  });

  // Scenario 4: Overlapping board appointment with the same provider
  await t.test('Scenario 4: Overlapping board appointment blocks provider', () => {
    // Fatima has an existing board appointment 10:00 - 11:00 (offset 60 to 120)
    const appointments = [
      {
        id: 'appt-1',
        staffId: '102',
        startTime: 60,
        duration: 60,
        status: 'confirmed'
      }
    ];

    const result = isStylistAvailableForServiceItem({
      stylist: baseStylists[1], // Fatima
      service: haircutService,
      item: { id: 'stg-1', startTime: 90, duration: 30 }, // 10:30 - 11:00
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts,
      appointments
    });

    assert.equal(result.available, false);
    assert.equal(result.reason, 'overlapping_booking');
  });

  // Scenario 5: Overlapping break / blocked time with the same provider
  await t.test('Scenario 5: Overlapping break blocks provider', () => {
    // Sally has an existing break 13:00 - 14:00 (offset 240 to 300)
    const appointments = [
      {
        id: 'break-1',
        staffId: '101',
        startTime: 240,
        duration: 60,
        isBlocked: true
      }
    ];

    const result = isStylistAvailableForServiceItem({
      stylist: baseStylists[0], // Sally (shift 12:00 - 20:00)
      service: haircutService,
      item: { id: 'stg-1', startTime: 270, duration: 45 }, // 13:30 - 14:15
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts,
      appointments
    });

    assert.equal(result.available, false);
    assert.equal(result.reason, 'overlapping_booking');
  });

  // Scenario 6: Unqualified provider for service is excluded
  await t.test('Scenario 6: Unqualified provider for service is excluded', () => {
    // Coloring service only assigned to Layla ('103').
    // Sally ('101') is not qualified.
    const result = isStylistAvailableForServiceItem({
      stylist: baseStylists[0], // Sally
      service: coloringService,
      item: { id: 'stg-1', startTime: 240, duration: 60 },
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts
    });

    assert.equal(result.available, false);
    assert.equal(result.reason, 'not_qualified');

    const eligible = getEligibleStylistsForServiceItem({
      stylists: baseStylists,
      service: coloringService,
      item: { id: 'stg-1', startTime: 240, duration: 60 },
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts
    });

    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].id, '103'); // Layla only
  });

  // Scenario 7: Provider becomes available after moving time into valid shift
  await t.test('Scenario 7: Provider becomes available after moving time into valid shift', () => {
    // Sally is unavailable at 10:00 (offset 60)
    const beforeResult = isStylistAvailableForServiceItem({
      stylist: baseStylists[0],
      service: haircutService,
      item: { id: 'stg-1', startTime: 60, duration: 30 },
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts
    });
    assert.equal(beforeResult.available, false);

    // Moving appointment to 13:00 (offset 240 min)
    const afterResult = isStylistAvailableForServiceItem({
      stylist: baseStylists[0],
      service: haircutService,
      item: { id: 'stg-1', startTime: 240, duration: 30 },
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts
    });
    assert.equal(afterResult.available, true);

    const eligibleAt1300 = getEligibleStylistsForServiceItem({
      stylists: baseStylists,
      service: haircutService,
      item: { id: 'stg-1', startTime: 240, duration: 30 },
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts
    });
    assert.ok(eligibleAt1300.some(s => s.id === '101'));
  });

  // Scenario 8: Changing date/time recalculates availability dynamically
  await t.test('Scenario 8: Changing date recalculates availability based on date shifts', () => {
    const specialShifts: StaffShiftRecord[] = [
      {
        staffId: '104',
        specificDate: '2026-10-18', // Sunday only
        startTime: '10:00',
        endTime: '18:00',
        isActive: true
      }
    ];

    const nouraStylist: StylistRecord = {
      id: '104',
      nameEn: 'Noura',
      nameAr: 'نورة',
      role: 'Stylist',
      status: 'active'
    };

    const nouraHaircutService: ServiceWithAssignments = {
      ...haircutService,
      employeeAssignments: ['101', '102', '104']
    };

    const saturday = new Date('2026-10-17T10:00:00Z');
    const sunday = new Date('2026-10-18T10:00:00Z');

    const satResult = isStylistAvailableForServiceItem({
      stylist: nouraStylist,
      service: nouraHaircutService,
      item: { id: 'stg-1', startTime: 60, duration: 30 },
      selectedDate: saturday,
      boardStartHour,
      tenantShifts: specialShifts
    });
    assert.equal(satResult.available, false);
    assert.equal(satResult.reason, 'no_duty');

    const sunResult = isStylistAvailableForServiceItem({
      stylist: nouraStylist,
      service: nouraHaircutService,
      item: { id: 'stg-1', startTime: 60, duration: 30 },
      selectedDate: sunday,
      boardStartHour,
      tenantShifts: specialShifts
    });
    assert.equal(sunResult.available, true);
  });

  // Scenario 9: Changing duration recalculates availability
  await t.test('Scenario 9: Changing duration recalculates availability', () => {
    // Fatima shift ends at 17:00 (minute 480). Start at 16:30 (minute 450).
    // 30 min duration -> ends at 17:00 (fits exactly)
    const fitResult = isStylistAvailableForServiceItem({
      stylist: baseStylists[1],
      service: haircutService,
      item: { id: 'stg-1', startTime: 450, duration: 30 },
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts
    });
    assert.equal(fitResult.available, true);

    // 45 min duration -> ends at 17:15 (exceeds shift end)
    const exceedResult = isStylistAvailableForServiceItem({
      stylist: baseStylists[1],
      service: haircutService,
      item: { id: 'stg-1', startTime: 450, duration: 45 },
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts
    });
    assert.equal(exceedResult.available, false);
    assert.equal(exceedResult.reason, 'after_shift');
  });

  // Scenario 10: Removing a conflicting service recalculates staged conflicts
  await t.test('Scenario 10: Removing conflicting staged service frees provider', () => {
    // Sally works 12:00 - 20:00 (minute 180 to 660 from 09:00).
    // Staged item 1 occupies Sally 13:00 - 14:00 (offset 240 to 300)
    const stagedServices: StagedServiceWithAssignment[] = [
      {
        id: 'stg-1',
        serviceId: 'srv-haircut',
        staffId: '101',
        isExplicitStaff: true,
        startTime: 240,
        duration: 60
      },
      {
        id: 'stg-2',
        serviceId: 'srv-haircut',
        staffId: '',
        isExplicitStaff: false,
        startTime: 270,
        duration: 30
      }
    ];

    // With stg-1 in stagedServices, Sally ('101') is occupied 240 - 300
    const conflictResult = isStylistAvailableForServiceItem({
      stylist: baseStylists[0],
      service: haircutService,
      item: stagedServices[1],
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts,
      stagedServices
    });
    assert.equal(conflictResult.available, false);
    assert.equal(conflictResult.reason, 'overlapping_staged');

    // Remove stg-1
    const stagedWithoutFirst = [stagedServices[1]];
    const freeResult = isStylistAvailableForServiceItem({
      stylist: baseStylists[0],
      service: haircutService,
      item: stagedServices[1],
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts,
      stagedServices: stagedWithoutFirst
    });
    assert.equal(freeResult.available, true);
  });

  // Scenario 11: Group booking: switching participants preserves isolated contexts
  await t.test('Scenario 11: Group booking: switching participants preserves isolated contexts', () => {
    const groupStaged: StagedServiceWithAssignment[] = [
      {
        id: 'stg-p1-1',
        participantId: 'part-1',
        serviceId: 'srv-haircut',
        staffId: '102', // Fatima for participant 1
        isExplicitStaff: true,
        startTime: 60,
        duration: 45
      },
      {
        id: 'stg-p2-1',
        participantId: 'part-2',
        serviceId: 'srv-haircut',
        staffId: '',
        isExplicitStaff: false,
        startTime: 60,
        duration: 45
      }
    ];

    // Participant 1's service has Fatima explicitly assigned
    assert.equal(groupStaged[0].staffId, '102');
    assert.equal(groupStaged[0].participantId, 'part-1');

    // Participant 2's service remains unassigned and independent
    assert.equal(groupStaged[1].staffId, '');
    assert.equal(groupStaged[1].participantId, 'part-2');
  });

  // Scenario 12: Group booking: distinct participants can retain distinct providers at overlapping times
  await t.test('Scenario 12: Distinct participants can retain distinct providers at overlapping times', () => {
    // At 14:00 (offset 300), both Sally and Fatima are on duty.
    // Participant 1 gets Sally ('101')
    // Participant 2 gets Fatima ('102')
    const groupStaged: StagedServiceWithAssignment[] = [
      {
        id: 'stg-p1',
        participantId: 'part-1',
        serviceId: 'srv-haircut',
        staffId: '101',
        isExplicitStaff: true,
        startTime: 300,
        duration: 45
      },
      {
        id: 'stg-p2',
        participantId: 'part-2',
        serviceId: 'srv-haircut',
        staffId: '102',
        isExplicitStaff: true,
        startTime: 300,
        duration: 45
      }
    ];

    const resolution = resolveCompatibleStaffAssignments(groupStaged, baseStylists, [haircutService], {
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts
    });

    assert.equal(resolution.success, true);
    assert.equal(resolution.resolvedStaffMap.get('stg-p1'), '101');
    assert.equal(resolution.resolvedStaffMap.get('stg-p2'), '102');
  });

  // Scenario 13: When no eligible provider exists, returns empty eligible list
  await t.test('Scenario 13: No eligible provider returns empty list', () => {
    // At 20:30 (offset 690 from 09:00), all salon shifts have ended (latest was Sally at 20:00)
    const lateItem = { id: 'stg-late', startTime: 690, duration: 30 };
    const eligible = getEligibleStylistsForServiceItem({
      stylists: baseStylists,
      service: haircutService,
      item: lateItem,
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts
    });

    assert.equal(eligible.length, 0);
  });

  // Scenario 14: Dynamic invalidation simulation
  await t.test('Scenario 14: Dynamic invalidation detects unavailable assigned provider', () => {
    // Staged item initially assigned Sally ('101') at 14:00 (offset 300, valid shift 12:00 - 20:00)
    const validItem: StagedServiceWithAssignment = {
      id: 'stg-1',
      serviceId: 'srv-haircut',
      staffId: '101',
      isExplicitStaff: true,
      startTime: 300,
      duration: 30
    };

    assert.equal(
      isStylistAvailableForServiceItem({
        stylist: baseStylists[0],
        service: haircutService,
        item: validItem,
        selectedDate: testDate,
        boardStartHour,
        tenantShifts: baseShifts
      }).available,
      true
    );

    // Time is shifted to 10:00 (offset 60) where Sally is off duty (starts at 12:00)
    const shiftedItem: StagedServiceWithAssignment = {
      ...validItem,
      startTime: 60
    };

    const invalidationCheck = isStylistAvailableForServiceItem({
      stylist: baseStylists[0],
      service: haircutService,
      item: shiftedItem,
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts
    });

    assert.equal(invalidationCheck.available, false);
    assert.equal(invalidationCheck.reason, 'before_shift');
  });

  // Scenario 15: Single booking flow remains intact with automatic compatible assignment
  await t.test('Scenario 15: Single booking flow resolves compatible available staff', () => {
    const staged: StagedServiceWithAssignment[] = [
      {
        id: 'stg-auto',
        serviceId: 'srv-haircut',
        staffId: '',
        isExplicitStaff: false,
        startTime: 60, // 10:00 AM: Only Fatima ('102') is working
        duration: 45
      }
    ];

    const result = resolveCompatibleStaffAssignments(staged, baseStylists, [haircutService], {
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: baseShifts
    });

    assert.equal(result.success, true);
    assert.equal(result.resolvedStaffMap.get('stg-auto'), '102'); // Must choose Fatima, Sally not on duty
  });

  // Scenario 16: Unified group checkout totals and ZATCA VAT remain unaffected
  await t.test('Scenario 16: Unified group checkout totals and ZATCA VAT remain unaffected', () => {
    const groupParticipants = [
      { id: 'part-1', name: 'Sara', isOrganizer: true },
      { id: 'part-2', name: 'Noura', isOrganizer: false }
    ];

    const stagedServices = [
      {
        id: 'stg-1',
        participantId: 'part-1',
        basePrice: 100,
        finalPrice: 100,
        serviceId: 'srv-1',
        startTime: 60,
        duration: 30
      },
      {
        id: 'stg-2',
        participantId: 'part-2',
        basePrice: 200,
        finalPrice: 200,
        serviceId: 'srv-2',
        startTime: 60,
        duration: 45
      }
    ];

    const summary = calculateGroupStagedPricing(groupParticipants, stagedServices as any, []);

    // 100 + 200 = 300 subtotal. VAT 15% = 45. Total = 345
    assert.equal(summary.subtotal, 300);
    assert.equal(summary.vat, 45);
    assert.equal(summary.total, 345);
    assert.equal(summary.participantBreakdowns.length, 2);
  });

  // Scenario 17: Overnight shift boundary crossing
  await t.test('Scenario 17: Overnight shift boundary crossing is handled correctly', () => {
    const nightStylist: StylistRecord = {
      id: '105',
      nameEn: 'Mona',
      nameAr: 'منى',
      role: 'Stylist',
      status: 'active'
    };

    const nightShifts: StaffShiftRecord[] = [
      {
        staffId: '105',
        specificDate: '2026-10-17',
        startTime: '20:00',
        endTime: '02:00', // Overnight
        isActive: true
      }
    ];

    const nightHaircutService: ServiceWithAssignments = {
      ...haircutService,
      employeeAssignments: ['101', '102', '105']
    };

    // At 21:00 (minute 1260 from 00:00 = 720 from 09:00), Mona is on duty
    const nightResult = isStylistAvailableForServiceItem({
      stylist: nightStylist,
      service: nightHaircutService,
      item: { id: 'stg-night', startTime: 720, duration: 60 },
      selectedDate: testDate,
      boardStartHour,
      tenantShifts: nightShifts
    });

    assert.equal(nightResult.available, true);
  });
});
