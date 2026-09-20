import test from 'node:test';
import assert from 'node:assert/strict';

interface StagedService {
  id: string;
  itemType?: 'service' | 'package';
  packageId?: string;
  packageInstanceId?: string;
  serviceId: string;
  staffId: string;
  startTime: number; // minutes from 9:00 AM (0 = 9:00 AM, 690 = 8:30 PM, 655 = 7:55 PM)
  startTimeIso?: string;
  duration: number;
}

// Function modeling parallel bundle creation
function createParallelBundleItems(params: {
  packageId: string;
  packageInstanceId: string;
  anchorStartTime: number;
  childServices: Array<{ serviceId: string; duration: number; staffId: string }>;
}): StagedService[] {
  return params.childServices.map((child, idx) => ({
    id: `stg-pkg-${params.packageId}-${idx}-${Date.now()}`,
    itemType: 'package',
    packageId: params.packageId,
    packageInstanceId: params.packageInstanceId,
    serviceId: child.serviceId,
    staffId: child.staffId,
    startTime: params.anchorStartTime, // All parallel items share anchor start time
    duration: child.duration
  }));
}

// Function modeling parallel bundle start time update synchronization
function updateParallelBundleStartTime(
  staged: StagedService[],
  packageInstanceId: string,
  newStartTime: number
): StagedService[] {
  return staged.map(item => {
    if (item.packageInstanceId === packageInstanceId) {
      return {
        ...item,
        startTime: newStartTime
      };
    }
    return item;
  });
}

// Function modeling duty end validation
function validateBundleDutyEnd(
  items: StagedService[],
  boardStartHour: number,
  normalEndHour: number
): { exceedsDuty: boolean; latestEndMinutes: number; normalClosingMinutes: number } {
  const latestEndMinutes = Math.max(...items.map(it => it.startTime + it.duration));
  const normalClosingMinutes = (normalEndHour - boardStartHour) * 60;
  return {
    exceedsDuty: latestEndMinutes > normalClosingMinutes,
    latestEndMinutes,
    normalClosingMinutes
  };
}

// Function modeling 15-minute advance check
function validate15MinuteAdvanceRule(
  items: StagedService[],
  boardStartHour: number,
  currentRiyadhMinutes: number
): { valid: boolean; earliestStart: number; minimumRequired: number; errorAr?: string; errorEn?: string } {
  const earliestStart = Math.min(...items.map(it => it.startTime));
  const currentOffset = currentRiyadhMinutes - (boardStartHour * 60);
  const minimumRequired = currentOffset + 15;
  const valid = earliestStart >= minimumRequired;
  return {
    valid,
    earliestStart,
    minimumRequired,
    errorAr: valid ? undefined : 'يجب أن يكون وقت الحجز قبل الموعد بـ 15 دقيقة على الأقل.',
    errorEn: valid ? undefined : 'Appointments must be booked at least 15 minutes in advance.'
  };
}

test('CASE 1: Scheduler slot 8:30, parallel bundle with 3 services -> all 3 start at 8:30', () => {
  const anchorStartTime = 690; // 8:30 PM = 1170 mins from midnight - 540 = 690
  const items = createParallelBundleItems({
    packageId: 'pkg-parallel-1',
    packageInstanceId: 'inst-1',
    anchorStartTime,
    childServices: [
      { serviceId: 'srv-a', duration: 20, staffId: 'staff-1' },
      { serviceId: 'srv-b', duration: 30, staffId: 'staff-2' },
      { serviceId: 'srv-c', duration: 45, staffId: 'staff-3' }
    ]
  });

  assert.equal(items.length, 3);
  assert.equal(items[0].startTime, 690);
  assert.equal(items[1].startTime, 690);
  assert.equal(items[2].startTime, 690);

  // AC-3: Child end times equal start + own duration
  assert.equal(items[0].startTime + items[0].duration, 710); // 8:50 PM
  assert.equal(items[1].startTime + items[1].duration, 720); // 9:00 PM
  assert.equal(items[2].startTime + items[2].duration, 735); // 9:15 PM
});

test('CASE 2: Change bundle start 8:30 -> 8:40 -> all three update to 8:40 without mutating durations', () => {
  const initialItems = createParallelBundleItems({
    packageId: 'pkg-parallel-1',
    packageInstanceId: 'inst-1',
    anchorStartTime: 690, // 8:30 PM
    childServices: [
      { serviceId: 'srv-a', duration: 20, staffId: 'staff-1' },
      { serviceId: 'srv-b', duration: 30, staffId: 'staff-2' },
      { serviceId: 'srv-c', duration: 45, staffId: 'staff-3' }
    ]
  });

  const updated = updateParallelBundleStartTime(initialItems, 'inst-1', 700); // 8:40 PM

  assert.equal(updated[0].startTime, 700);
  assert.equal(updated[1].startTime, 700);
  assert.equal(updated[2].startTime, 700);

  // Durations preserved
  assert.equal(updated[0].duration, 20);
  assert.equal(updated[1].duration, 30);
  assert.equal(updated[2].duration, 45);

  // End times recalculated
  assert.equal(updated[0].startTime + updated[0].duration, 720); // 9:00 PM
  assert.equal(updated[1].startTime + updated[1].duration, 730); // 9:10 PM
  assert.equal(updated[2].startTime + updated[2].duration, 745); // 9:25 PM
});

test('CASE 3: Sequential bundle preserves sequential timing', () => {
  const anchorStartTime = 655; // 7:55 PM
  const childDurations = [20, 30, 25];
  let runningStart = anchorStartTime;

  const sequentialItems = childDurations.map((duration, idx) => {
    const start = runningStart;
    runningStart += duration;
    return { id: `seq-${idx}`, startTime: start, duration, end: start + duration };
  });

  assert.equal(sequentialItems[0].startTime, 655); // 7:55
  assert.equal(sequentialItems[0].end, 675);       // 8:15
  assert.equal(sequentialItems[1].startTime, 675); // 8:15
  assert.equal(sequentialItems[1].end, 705);       // 8:45
  assert.equal(sequentialItems[2].startTime, 705); // 8:45
  assert.equal(sequentialItems[2].end, 730);       // 9:10
});

test('CASE 4: Parallel bundle near duty end validates latest end against duty end', () => {
  // Duty ends at 9:00 PM (normalEndHour = 21, boardStartHour = 9 -> normalClosingMinutes = 720)
  // Bundle starts at 8:30 PM (690), duration 45 -> end = 735 (9:15 PM) > 720
  const items = createParallelBundleItems({
    packageId: 'pkg-parallel-1',
    packageInstanceId: 'inst-1',
    anchorStartTime: 690,
    childServices: [
      { serviceId: 'srv-a', duration: 20, staffId: 'staff-1' }, // ends 710 <= 720
      { serviceId: 'srv-b', duration: 45, staffId: 'staff-2' }  // ends 735 > 720
    ]
  });

  const check = validateBundleDutyEnd(items, 9, 21);
  assert.equal(check.exceedsDuty, true);
  assert.equal(check.latestEndMinutes, 735);
  assert.equal(check.normalClosingMinutes, 720);
});

test('CASE 5: Appointment less than 15 minutes in advance is blocked with clear frontend message', () => {
  // Suppose current time is 7:45 PM (1185 mins from midnight)
  // User selects 7:55 PM (1195 mins from midnight) -> only 10 minutes in advance (< 15)
  const items: StagedService[] = [{
    id: 'item-1',
    serviceId: 'srv-1',
    staffId: 'staff-1',
    startTime: 655, // 7:55 PM (offset from 9 AM: 1195 - 540 = 655)
    duration: 30
  }];

  const currentRiyadhMinutes = 19 * 60 + 45; // 1185
  const result = validate15MinuteAdvanceRule(items, 9, currentRiyadhMinutes);

  assert.equal(result.valid, false);
  assert.equal(result.errorAr, 'يجب أن يكون وقت الحجز قبل الموعد بـ 15 دقيقة على الأقل.');
  assert.equal(result.errorEn, 'Appointments must be booked at least 15 minutes in advance.');
});

test('CASE 6: Appointment >= 15 minutes in advance follows normal submission path', () => {
  // Suppose current time is 7:30 PM (1170 mins from midnight)
  // User selects 7:55 PM (1195 mins from midnight) -> 25 minutes in advance (>= 15)
  const items: StagedService[] = [{
    id: 'item-1',
    serviceId: 'srv-1',
    staffId: 'staff-1',
    startTime: 655, // 7:55 PM
    duration: 30
  }];

  const currentRiyadhMinutes = 19 * 60 + 30; // 1170
  const result = validate15MinuteAdvanceRule(items, 9, currentRiyadhMinutes);

  assert.equal(result.valid, true);
  assert.equal(result.errorAr, undefined);
  assert.equal(result.errorEn, undefined);
});
