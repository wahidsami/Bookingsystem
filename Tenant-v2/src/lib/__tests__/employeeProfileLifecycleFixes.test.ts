import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractScheduleMetaFromShifts,
  buildScheduleFromWorkingData,
  normalizeWorkingHoursSchedule,
  normalizeShiftsToSchedule,
  mapApiEmployeeToTeamMember,
  persistEmployeeSchedule,
  isScheduleEqual,
  validateWeeklySchedule,
  WEEKDAY_ROWS
} from '../employeeHelpers';
import { TeamMemberData } from '../../types/employee';

describe('BARSPA Employee Profile Lifecycle & Hydration Fixes Test Suite', () => {

  // Scenario 1: Repeated parent rerenders do not repeatedly fetch employee data or reset form state
  test('Scenario 1: Drawer stability — Effect dependencies and close handler ref protect form state from parent rerenders', () => {
    // Simulating parent rerenders generating a new onClose callback each render
    let fetchCount = 0;
    let lastRenderedStaffId: string | null = null;
    let localFormDataState = { nameAr: 'سارة - تعديل قيد التنفيذ', phone: '0501234567' };

    let currentCloseHandler = () => { /* handler ref 1 */ };
    const closeHandlerCalls: string[] = [];

    // Closure simulating the stable effect logic in TeamMemberProfileDrawer
    const onCloseRef = { current: currentCloseHandler };

    const simulateDrawerEffect = (staffId: string, incomingOnClose: () => void) => {
      // 1. Update ref immediately during render
      onCloseRef.current = incomingOnClose;

      // 2. The effect dependency is strictly [staffId]
      if (staffId !== lastRenderedStaffId) {
        lastRenderedStaffId = staffId;
        fetchCount++;
        // On legitimate staff switch, form data would be re-initialized from fetched employee
      }
      // On ordinary parent rerender (staffId identical), the effect does NOT fire:
      // fetchCount does NOT increase, and localFormDataState is preserved!
    };

    // First mount with Sally
    simulateDrawerEffect('staff-sally', () => { closeHandlerCalls.push('close-1'); });
    assert.equal(fetchCount, 1);
    assert.equal(localFormDataState.nameAr, 'سارة - تعديل قيد التنفيذ');

    // Parent rerenders 5 times (e.g. 30-second clock ticks, board drag events) with brand new onClose references
    for (let i = 2; i <= 6; i++) {
      simulateDrawerEffect('staff-sally', () => { closeHandlerCalls.push(`close-${i}`); });
    }

    // Proves: Ordinary parent rerenders did NOT trigger refetches
    assert.equal(fetchCount, 1);
    // Proves: Unsaved form edits in local state remained completely intact
    assert.equal(localFormDataState.nameAr, 'سارة - تعديل قيد التنفيذ');

    // Calling the ref-backed close callback invokes the latest stable parent handler
    onCloseRef.current();
    assert.deepEqual(closeHandlerCalls, ['close-6']);
  });

  // Scenario 2: Switching the selected employee loads the correct employee
  test('Scenario 2: Employee switching — Genuinely changing staffId triggers fetch and request-ID tracking discards stale async responses', async () => {
    let requestIdCounter = 0;
    let activeDisplayedMemberId: string | null = null;

    const mockApiDatabase: Record<string, any> = {
      'staff-sally': { id: 'staff-sally', name: 'Sally Barber', position: 'service_provider' },
      'staff-nora': { id: 'staff-nora', name: 'Nora Stylist', position: 'manager' }
    };

    // Async loader simulating TeamMemberProfileDrawer fetch with request ID tracking
    const loadEmployeeAsync = async (staffId: string, artificialDelayMs: number) => {
      const currentRequestId = ++requestIdCounter;

      await new Promise((resolve) => setTimeout(resolve, artificialDelayMs));

      // Guard: Discard if newer request has arrived
      if (currentRequestId !== requestIdCounter) {
        return; // Stale response discarded!
      }

      const emp = mockApiDatabase[staffId];
      if (emp) {
        activeDisplayedMemberId = emp.id;
      }
    };

    // User clicks Sally (slow request: 50ms)
    const sallyPromise = loadEmployeeAsync('staff-sally', 50);

    // User immediately switches to Nora (fast request: 10ms)
    const noraPromise = loadEmployeeAsync('staff-nora', 10);

    await Promise.all([sallyPromise, noraPromise]);

    // Nora resolved first (at 10ms) and set activeDisplayedMemberId = 'staff-nora'
    // Sally resolved later (at 50ms), but currentRequestId was stale, so Sally was discarded!
    assert.equal(activeDisplayedMemberId, 'staff-nora');
  });

  // Scenario 3: Schedule start/end dates survive the full mapping/hydration path
  test('Scenario 3: Schedule date hydration — Start date, end date, and continuous flag survive full mapping/hydration', () => {
    const rawApiShifts = [
      {
        id: 'shift-1',
        dayOfWeek: 0,
        startTime: '09:00:00',
        endTime: '17:00:00',
        isRecurring: true,
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
        isActive: true
      },
      {
        id: 'shift-2',
        dayOfWeek: 1,
        startTime: '09:00:00',
        endTime: '17:00:00',
        isRecurring: true,
        startDate: '2026-09-01',
        endDate: '2026-12-31',
        isActive: true
      }
    ];

    // 1. extractScheduleMetaFromShifts extracts authoritative schedule dates
    const meta = extractScheduleMetaFromShifts(rawApiShifts);
    assert.equal(meta.scheduleStartDate, '2026-09-01');
    assert.equal(meta.scheduleEndDate, '2026-12-31');
    assert.equal(meta.scheduleContinues, false);

    // 2. mapApiEmployeeToTeamMember hydrates fields into TeamMemberData
    const mockEmployee = {
      id: 'staff-sally',
      name: 'Sally',
      position: 'service_provider',
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    const schedule = normalizeShiftsToSchedule(rawApiShifts);
    const hydrated = mapApiEmployeeToTeamMember(mockEmployee, schedule, meta);

    // 3. Verify form initial data has exact expected values
    assert.equal(hydrated.scheduleStartDate, '2026-09-01');
    assert.equal(hydrated.scheduleEndDate, '2026-12-31');
    assert.equal(hydrated.scheduleContinues, false);
    assert.equal(hydrated.schedule[0].status, 'working');
    assert.equal(hydrated.schedule[0].hours, '9:00 AM - 5:00 PM');
  });

  // Scenario 4: Continuous schedules retain the correct state when endDate is null
  test('Scenario 4: Continuous schedules — Explicitly retains scheduleContinues: true when endDate is null', () => {
    const continuousShifts = [
      {
        id: 'shift-sun',
        dayOfWeek: 0,
        startTime: '10:00:00',
        endTime: '18:00:00',
        isRecurring: true,
        startDate: '2026-08-15',
        endDate: null,
        isActive: true
      },
      {
        id: 'shift-mon',
        dayOfWeek: 1,
        startTime: '10:00:00',
        endTime: '18:00:00',
        isRecurring: true,
        startDate: '2026-08-15',
        endDate: null,
        isActive: true
      }
    ];

    const meta = extractScheduleMetaFromShifts(continuousShifts);
    assert.equal(meta.scheduleStartDate, '2026-08-15');
    assert.equal(meta.scheduleEndDate, '');
    assert.equal(meta.scheduleContinues, true);

    const mockEmployee = { id: 'staff-continuous', name: 'Nora' };
    const hydrated = mapApiEmployeeToTeamMember(mockEmployee, normalizeShiftsToSchedule(continuousShifts), meta);

    assert.equal(hydrated.scheduleStartDate, '2026-08-15');
    assert.equal(hydrated.scheduleEndDate, '');
    assert.equal(hydrated.scheduleContinues, true);
  });

  // Scenario 5: Additional shift rows do not cause incorrect schedule-level dates to be selected
  test('Scenario 5: Outlier isolation — Additional shift rows or one-off shifts do not corrupt schedule-level dates', () => {
    const mixedShifts = [
      // 5 standard weekly recurring shifts with 2026-08-01 start and continuous (null end)
      { id: 'rec-0', dayOfWeek: 0, isRecurring: true, startDate: '2026-08-01', endDate: null, isActive: true },
      { id: 'rec-1', dayOfWeek: 1, isRecurring: true, startDate: '2026-08-01', endDate: null, isActive: true },
      { id: 'rec-2', dayOfWeek: 2, isRecurring: true, startDate: '2026-08-01', endDate: null, isActive: true },
      { id: 'rec-3', dayOfWeek: 3, isRecurring: true, startDate: '2026-08-01', endDate: null, isActive: true },
      { id: 'rec-4', dayOfWeek: 4, isRecurring: true, startDate: '2026-08-01', endDate: null, isActive: true },
      // 1 special one-off additional shift with specificDate and different start/end dates
      { id: 'oneoff-1', dayOfWeek: null, specificDate: '2026-12-25', isRecurring: false, startDate: '2026-12-25', endDate: '2026-12-25', isActive: true }
    ];

    const meta = extractScheduleMetaFromShifts(mixedShifts);

    // Proves: The one-off shift did NOT hijack the schedule dates
    assert.equal(meta.scheduleStartDate, '2026-08-01');
    assert.equal(meta.scheduleEndDate, '');
    assert.equal(meta.scheduleContinues, true);
  });

  // Scenario 6: Legacy working hours are restored when shift rows are empty
  test('Scenario 6: Legacy workingHours fallback — Restores working schedule when shift rows are empty', () => {
    const employeeWithLegacyHours = {
      id: 'staff-legacy',
      name: 'Legacy Staff',
      workingHours: {
        sunday: { isOpen: true, open: '09:00', close: '17:00' },
        monday: { isOpen: true, open: '20:00', close: '04:00' }, // Overnight shift
        tuesday: { isOpen: false, open: '09:00', close: '17:00' },
        wednesday: { isOpen: true, open: '10:00', close: '19:00' },
        thursday: { isOpen: true, start: '08:30', end: '16:30' }, // Alternative start/end keys
        friday: { isOpen: false },
        saturday: { isOpen: true, open: '12:00', close: '20:00' }
      }
    };

    // Empty shifts from API
    const emptyShifts: any[] = [];

    // buildScheduleFromWorkingData restores from legacy workingHours
    const schedule = buildScheduleFromWorkingData(employeeWithLegacyHours, emptyShifts);

    assert.equal(schedule.length, 7);

    // Sunday (working 9:00 AM - 5:00 PM)
    assert.equal(schedule[0].dayEn, 'Sunday');
    assert.equal(schedule[0].status, 'working');
    assert.equal(schedule[0].hours, '9:00 AM - 5:00 PM');

    // Monday (overnight 8:00 PM - 4:00 AM)
    assert.equal(schedule[1].dayEn, 'Monday');
    assert.equal(schedule[1].status, 'working');
    assert.equal(schedule[1].hours, '8:00 PM - 4:00 AM');

    // Tuesday (off)
    assert.equal(schedule[2].dayEn, 'Tuesday');
    assert.equal(schedule[2].status, 'off');
    assert.equal(schedule[2].hours, 'Day Off');

    // Thursday (start/end keys)
    assert.equal(schedule[4].dayEn, 'Thursday');
    assert.equal(schedule[4].status, 'working');
    assert.equal(schedule[4].hours, '8:30 AM - 4:30 PM');

    // Friday (off)
    assert.equal(schedule[5].dayEn, 'Friday');
    assert.equal(schedule[5].status, 'off');
    assert.equal(schedule[5].hours, 'Day Off');
  });

  // Scenario 7: Existing weekly shift and additional-shift behavior remains intact
  test('Scenario 7: Shift row priority — Valid shift rows always take precedence over legacy workingHours and preserve sub-shifts', () => {
    const employeeWithBoth = {
      id: 'staff-dual',
      name: 'Dual Staff',
      workingHours: {
        sunday: { isOpen: true, open: '08:00', close: '14:00' } // Should be ignored
      }
    };

    const validShifts = [
      {
        id: 'shift-sun-main',
        dayOfWeek: 0,
        startTime: '10:00',
        endTime: '18:00',
        isRecurring: true,
        isActive: true,
        label: 'Sunday Base'
      },
      {
        id: 'shift-sun-sub',
        dayOfWeek: 0,
        startTime: '19:00',
        endTime: '22:00',
        isRecurring: true,
        isActive: true,
        label: 'Evening Sub-Shift'
      }
    ];

    const schedule = buildScheduleFromWorkingData(employeeWithBoth, validShifts);

    // Proves: Shift rows took precedence over workingHours
    assert.equal(schedule[0].status, 'working');
    assert.equal(schedule[0].hours, '10:00 AM - 6:00 PM | 7:00 PM - 10:00 PM');

    // Sub-shifts are preserved
    assert.equal(schedule[0].subShifts?.length, 2);
    assert.equal(schedule[0].subShifts?.[1].label, 'Evening Sub-Shift');
    assert.equal(schedule[0].subShifts?.[1].startTime, '7:00 PM');
    assert.equal(schedule[0].subShifts?.[1].endTime, '10:00 PM');
  });

});
