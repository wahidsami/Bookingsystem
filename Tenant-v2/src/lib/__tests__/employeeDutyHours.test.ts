import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimeToMinutes,
  getDayOfWeekFromDateKey,
  resolveEmployeeDutyIntervals,
  isSlotOnDuty,
  type StaffShiftRecord
} from '../employeeDutyHours';

test('parseTimeToMinutes handles 24h, 12h AM/PM, and edge cases', () => {
  assert.equal(parseTimeToMinutes('09:00'), 540);
  assert.equal(parseTimeToMinutes('14:00'), 840);
  assert.equal(parseTimeToMinutes('22:00'), 1320);
  assert.equal(parseTimeToMinutes('02:00 PM'), 840);
  assert.equal(parseTimeToMinutes('10:00 PM'), 1320);
  assert.equal(parseTimeToMinutes('12:00 PM'), 720);
  assert.equal(parseTimeToMinutes('12:00 AM'), 0);
  assert.equal(parseTimeToMinutes('09:30 AM'), 570);
  assert.equal(parseTimeToMinutes(''), 0);
});

test('getDayOfWeekFromDateKey returns correct UTC weekday', () => {
  // 2026-10-13 is Tuesday (day 2)
  assert.equal(getDayOfWeekFromDateKey('2026-10-13'), 2);
  // 2026-10-14 is Wednesday (day 3)
  assert.equal(getDayOfWeekFromDateKey('2026-10-14'), 3);
  // 2026-10-11 is Sunday (day 0)
  assert.equal(getDayOfWeekFromDateKey('2026-10-11'), 0);
});

test('Scenario 1: Fatima works 2:00 PM–10:00 PM (14:00–22:00) while salon is open 9:00 AM–9:00 PM', () => {
  const shifts: StaffShiftRecord[] = [
    {
      staffId: 'fatima-1',
      dayOfWeek: 3, // Wednesday
      startTime: '14:00',
      endTime: '22:00',
      isRecurring: true,
      isActive: true
    }
  ];

  // Selected date: Wednesday 2026-10-14
  const intervals = resolveEmployeeDutyIntervals({
    staffId: 'fatima-1',
    dateKey: '2026-10-14',
    shifts
  });

  assert.equal(intervals.length, 1);
  assert.equal(intervals[0].startMinutes, 840); // 14:00 = 840m
  assert.equal(intervals[0].endMinutes, 1320);  // 22:00 = 1320m

  // Morning slots before 2:00 PM must be off-duty (shaded gray)
  // 9:00 AM - 9:15 AM (540 - 555)
  assert.equal(isSlotOnDuty(540, 555, intervals), false, '9:00 AM slot is off duty');
  // 1:45 PM - 2:00 PM (825 - 840)
  assert.equal(isSlotOnDuty(825, 840, intervals), false, '1:45 PM slot is off duty');

  // Duty period slots must be on-duty (normal white/lane background)
  // 2:00 PM - 2:15 PM (840 - 855)
  assert.equal(isSlotOnDuty(840, 855, intervals), true, '2:00 PM slot is on duty');
  // 8:00 PM - 8:15 PM (1200 - 1215)
  assert.equal(isSlotOnDuty(1200, 1215, intervals), true, '8:00 PM slot is on duty');
  // 9:45 PM - 10:00 PM (1305 - 1320)
  assert.equal(isSlotOnDuty(1305, 1320, intervals), true, '9:45 PM slot is on duty');

  // After 10:00 PM
  // 10:00 PM - 10:15 PM (1320 - 1335)
  assert.equal(isSlotOnDuty(1320, 1335, intervals), false, '10:00 PM slot is off duty');
});

test('Scenario 2: Morning-only shift (09:00–13:00)', () => {
  const shifts: StaffShiftRecord[] = [
    {
      staffId: 'staff-morning',
      dayOfWeek: 2, // Tuesday
      startTime: '09:00',
      endTime: '13:00',
      isRecurring: true,
      isActive: true
    }
  ];

  const intervals = resolveEmployeeDutyIntervals({
    staffId: 'staff-morning',
    dateKey: '2026-10-13', // Tuesday
    shifts
  });

  assert.equal(intervals.length, 1);
  assert.equal(intervals[0].startMinutes, 540); // 9:00
  assert.equal(intervals[0].endMinutes, 780);   // 13:00

  assert.equal(isSlotOnDuty(540, 555, intervals), true, '9:00 AM is on duty');
  assert.equal(isSlotOnDuty(765, 780, intervals), true, '12:45 PM is on duty');
  assert.equal(isSlotOnDuty(780, 795, intervals), false, '1:00 PM is off duty (gray)');
  assert.equal(isSlotOnDuty(900, 915, intervals), false, '3:00 PM is off duty (gray)');
});

test('Scenario 3: Multiple split shifts with gray gaps (09:00–13:00 and 17:00–21:00)', () => {
  const shifts: StaffShiftRecord[] = [
    {
      staffId: 'staff-split',
      dayOfWeek: 2, // Tuesday
      startTime: '09:00',
      endTime: '13:00',
      isRecurring: true,
      isActive: true,
      label: 'Morning Shift'
    },
    {
      staffId: 'staff-split',
      dayOfWeek: 2, // Tuesday
      startTime: '17:00',
      endTime: '21:00',
      isRecurring: true,
      isActive: true,
      label: 'Evening Shift'
    }
  ];

  const intervals = resolveEmployeeDutyIntervals({
    staffId: 'staff-split',
    dateKey: '2026-10-13',
    shifts
  });

  assert.equal(intervals.length, 2);
  assert.equal(intervals[0].startMinutes, 540);
  assert.equal(intervals[0].endMinutes, 780);
  assert.equal(intervals[1].startMinutes, 1020);
  assert.equal(intervals[1].endMinutes, 1260);

  // Shift 1: on duty
  assert.equal(isSlotOnDuty(540, 555, intervals), true);
  assert.equal(isSlotOnDuty(765, 780, intervals), true);

  // Gray gap between shifts (13:00–17:00): off duty
  assert.equal(isSlotOnDuty(780, 795, intervals), false, 'Gap slot 13:00 is off duty');
  assert.equal(isSlotOnDuty(900, 915, intervals), false, 'Gap slot 15:00 is off duty');
  assert.equal(isSlotOnDuty(1005, 1020, intervals), false, 'Gap slot 16:45 is off duty');

  // Shift 2: on duty
  assert.equal(isSlotOnDuty(1020, 1035, intervals), true, 'Evening slot 17:00 is on duty');
  assert.equal(isSlotOnDuty(1245, 1260, intervals), true, 'Evening slot 20:45 is on duty');

  // After shift 2: off duty
  assert.equal(isSlotOnDuty(1260, 1275, intervals), false, 'Post-shift slot 21:00 is off duty');
});

test('Scenario 4: No applicable shift on the selected day (scheduled off)', () => {
  const shifts: StaffShiftRecord[] = [
    {
      staffId: 'staff-off',
      dayOfWeek: 0, // Sunday only
      startTime: '09:00',
      endTime: '17:00',
      isRecurring: true,
      isActive: true
    }
  ];

  // Checking on Tuesday 2026-10-13
  const intervals = resolveEmployeeDutyIntervals({
    staffId: 'staff-off',
    dateKey: '2026-10-13',
    shifts
  });

  assert.deepEqual(intervals, []);
  assert.equal(isSlotOnDuty(540, 555, intervals), false, 'Every slot is off-duty');
  assert.equal(isSlotOnDuty(840, 855, intervals), false, 'Every slot is off-duty');
});

test('Scenario 5: Date-specific one-time schedule overrides recurring roster', () => {
  const shifts: StaffShiftRecord[] = [
    // Regular Tuesday shift: 09:00–17:00
    {
      staffId: 'staff-override',
      dayOfWeek: 2,
      startTime: '09:00',
      endTime: '17:00',
      isRecurring: true,
      isActive: true
    },
    // Special one-time shift on 2026-10-13: 12:00–20:00
    {
      staffId: 'staff-override',
      specificDate: '2026-10-13',
      startTime: '12:00',
      endTime: '20:00',
      isRecurring: false,
      isActive: true
    }
  ];

  const intervals = resolveEmployeeDutyIntervals({
    staffId: 'staff-override',
    dateKey: '2026-10-13',
    shifts
  });

  assert.equal(intervals.length, 1);
  assert.equal(intervals[0].startMinutes, 720);  // 12:00
  assert.equal(intervals[0].endMinutes, 1200);   // 20:00

  // 9:00 AM was regular but overridden -> off duty
  assert.equal(isSlotOnDuty(540, 555, intervals), false);
  // 12:00 PM is one-time shift -> on duty
  assert.equal(isSlotOnDuty(720, 735, intervals), true);
  // 19:45 PM is on duty
  assert.equal(isSlotOnDuty(1185, 1200, intervals), true);
  // 20:00 PM is off duty
  assert.equal(isSlotOnDuty(1200, 1215, intervals), false);
});

test('Scenario 6: Recurring shift respects effective date window (startDate / endDate)', () => {
  const shifts: StaffShiftRecord[] = [
    {
      staffId: 'staff-window',
      dayOfWeek: 2,
      startTime: '09:00',
      endTime: '17:00',
      startDate: '2026-11-01', // Starts in November
      isRecurring: true,
      isActive: true
    }
  ];

  // In October (before startDate):
  const intervalsOct = resolveEmployeeDutyIntervals({
    staffId: 'staff-window',
    dateKey: '2026-10-13',
    shifts
  });
  assert.deepEqual(intervalsOct, [], 'Shift not effective in October');

  // In November (after startDate):
  const intervalsNov = resolveEmployeeDutyIntervals({
    staffId: 'staff-window',
    dateKey: '2026-11-03', // First Tuesday in November
    shifts
  });
  assert.equal(intervalsNov.length, 1);
  assert.equal(intervalsNov[0].startMinutes, 540);
});

test('Scenario 7: Timeline cells crossing shift boundaries use half-open interval rule', () => {
  // Duty period: [840, 1320) (14:00 to 22:00)
  const duty = [{ startMinutes: 840, endMinutes: 1320 }];

  // Slot exactly adjacent before [825, 840): does not overlap duty
  assert.equal(isSlotOnDuty(825, 840, duty), false);

  // Slot touching start [840, 855): overlaps duty
  assert.equal(isSlotOnDuty(840, 855, duty), true);

  // Slot touching end [1305, 1320): overlaps duty
  assert.equal(isSlotOnDuty(1305, 1320, duty), true);

  // Slot exactly adjacent after [1320, 1335): does not overlap duty
  assert.equal(isSlotOnDuty(1320, 1335, duty), false);
});
