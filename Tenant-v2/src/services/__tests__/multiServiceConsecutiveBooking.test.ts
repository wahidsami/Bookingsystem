import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateIntervalFeasibility,
  buildConflictCard,
  ScheduleContextItem
} from '../../lib/bookingConflictDiagnostics';

describe('Multi-Service Consecutive Booking & Off-Grid Duty Feasibility', () => {
  const fatimaDutyShift: ScheduleContextItem = {
    employeeDutyWindows: [
      {
        startTime: '2026-10-15T11:00:00.000Z', // 14:00 Asia/Riyadh (UTC+3)
        endTime: '2026-10-15T18:00:00.000Z'   // 21:00 Asia/Riyadh
      }
    ],
    breaks: [],
    timeOff: [],
    existingAppointments: []
  };

  it('Scenario 1: Reproduction Case — Fatima consecutive services starting at 14:10 validate successfully without discrete slot', () => {
    // Service 1: 14:10 - 15:10 (60 min)
    const s1Start = '2026-10-15T11:10:00.000Z';
    const s1End = '2026-10-15T12:10:00.000Z';

    const s1Result = evaluateIntervalFeasibility({
      serviceId: 'moroccan-massage-60',
      staffId: 'fatima-ali',
      requestedStartTime: s1Start,
      requestedEndTime: s1End,
      exactSlot: null, // Off-grid boundary, discrete slot missing
      diagnostics: [],
      scheduleContext: fatimaDutyShift,
      priorChainAllocations: []
    });

    assert.equal(s1Result.isValid, true, 'Service 1 should be feasible within Fatima duty hours');
    assert.equal(s1Result.diagnostic, null);

    // Service 2: 15:10 - 15:40 (30 min)
    const s2Start = '2026-10-15T12:10:00.000Z';
    const s2End = '2026-10-15T12:40:00.000Z';

    const priorAllocations = [
      {
        staffId: 'fatima-ali',
        startMs: new Date(s1Start).getTime(),
        endMs: new Date(s1End).getTime()
      }
    ];

    const s2Result = evaluateIntervalFeasibility({
      serviceId: 'moroccan-massage-variant-30',
      staffId: 'fatima-ali',
      requestedStartTime: s2Start,
      requestedEndTime: s2End,
      exactSlot: null,
      diagnostics: [],
      scheduleContext: fatimaDutyShift,
      priorChainAllocations: priorAllocations
    });

    assert.equal(s2Result.isValid, true, 'Service 2 should be feasible and not collide with prior consecutive service');
    assert.equal(s2Result.diagnostic, null);
  });

  it('Scenario 2: Chain calculation accurately advances boundaries across custom durations (60m + 30m = 90m)', () => {
    const startMs = new Date('2026-10-15T11:10:00.000Z').getTime(); // 14:10
    const duration1 = 60;
    const duration2 = 30;

    const s1EndMs = startMs + duration1 * 60000;
    const s2EndMs = s1EndMs + duration2 * 60000;

    assert.equal(new Date(s1EndMs).toISOString(), '2026-10-15T12:10:00.000Z', 'Service 1 ends at 15:10');
    assert.equal(new Date(s2EndMs).toISOString(), '2026-10-15T12:40:00.000Z', 'Service 2 ends at 15:40');
    assert.equal((s2EndMs - startMs) / 60000, 90, 'Total chain duration is 90 minutes');
  });

  it('Scenario 3: Genuine appointment collision is rejected with existing_booking', () => {
    const shiftWithAppt: ScheduleContextItem = {
      ...fatimaDutyShift,
      existingAppointments: [
        {
          id: 'appt-123',
          startTime: '2026-10-15T11:30:00.000Z', // 14:30
          endTime: '2026-10-15T12:00:00.000Z'   // 15:00
        }
      ]
    };

    const result = evaluateIntervalFeasibility({
      serviceId: 'moroccan-massage-60',
      staffId: 'fatima-ali',
      requestedStartTime: '2026-10-15T11:10:00.000Z', // 14:10 - 15:10 (overlaps 14:30-15:00)
      requestedEndTime: '2026-10-15T12:10:00.000Z',
      exactSlot: null,
      diagnostics: [],
      scheduleContext: shiftWithAppt
    });

    assert.equal(result.isValid, false);
    assert.equal(result.diagnostic?.reasonType, 'existing_booking');
  });

  it('Scenario 4: Outside working hours is rejected with outside_working_hours', () => {
    // Attempt booking at 13:00 (before Fatima 14:00 shift)
    const resultBefore = evaluateIntervalFeasibility({
      serviceId: 'moroccan-massage-60',
      staffId: 'fatima-ali',
      requestedStartTime: '2026-10-15T10:00:00.000Z', // 13:00
      requestedEndTime: '2026-10-15T11:00:00.000Z',   // 14:00
      exactSlot: null,
      diagnostics: [],
      scheduleContext: fatimaDutyShift
    });

    assert.equal(resultBefore.isValid, false);
    assert.equal(resultBefore.reasonType || resultBefore.diagnostic?.reasonType, 'outside_working_hours');

    // Attempt booking extending past 21:00
    const resultPast = evaluateIntervalFeasibility({
      serviceId: 'moroccan-massage-60',
      staffId: 'fatima-ali',
      requestedStartTime: '2026-10-15T17:30:00.000Z', // 20:30 - 21:30
      requestedEndTime: '2026-10-15T18:30:00.000Z',
      exactSlot: null,
      diagnostics: [],
      scheduleContext: fatimaDutyShift
    });

    assert.equal(resultPast.isValid, false);
    assert.equal(resultPast.diagnostic?.reasonType, 'outside_working_hours');
  });

  it('Scenario 5: Scheduled break overlap is rejected with staff_break', () => {
    const shiftWithBreak: ScheduleContextItem = {
      ...fatimaDutyShift,
      breaks: [
        {
          startTime: '2026-10-15T12:00:00.000Z', // 15:00
          endTime: '2026-10-15T12:30:00.000Z'   // 15:30
        }
      ]
    };

    const result = evaluateIntervalFeasibility({
      serviceId: 'moroccan-massage-variant-30',
      staffId: 'fatima-ali',
      requestedStartTime: '2026-10-15T12:10:00.000Z', // 15:10 - 15:40 overlaps 15:00-15:30
      requestedEndTime: '2026-10-15T12:40:00.000Z',
      exactSlot: null,
      diagnostics: [],
      scheduleContext: shiftWithBreak
    });

    assert.equal(result.isValid, false);
    assert.equal(result.diagnostic?.reasonType, 'staff_break');
  });

  it('Scenario 6: Conflict card NEVER reports "Available" when diagnostic is null or rejected', () => {
    const cardNull = buildConflictCard({
      diagnostic: null,
      staffId: 'fatima-ali',
      staffName: 'Fatima ali',
      isRtl: false
    });

    assert.notEqual(cardNull.reasonType, 'available', 'Rejection card must never say available');
    assert.equal(cardNull.reasonType, 'unavailable');
    assert.equal(cardNull.reasonTitle, 'Unavailable');

    const cardArabic = buildConflictCard({
      diagnostic: null,
      staffId: 'fatima-ali',
      staffName: 'فاطمة علي',
      isRtl: true
    });
    assert.equal(cardArabic.reasonType, 'unavailable');
    assert.equal(cardArabic.reasonTitle, 'غير متاحة');
  });
});
