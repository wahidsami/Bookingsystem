import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getOffDutySlotMessage,
  formatMinutesToClockLabel,
  isSlotOnDuty,
  DutyInterval
} from '../employeeDutyHours';

describe('Employee Duty Hours & Slot Click Toast Messages', () => {
  // Fatima shift on Thursday: 14:00 - 21:00 (840 to 1260 minutes from midnight)
  const fatimaDuty: DutyInterval[] = [
    { startMinutes: 840, endMinutes: 1260 }
  ];

  it('formats minutes to localized clock labels accurately', () => {
    assert.equal(formatMinutesToClockLabel(840, false), '2:00 PM');
    assert.equal(formatMinutesToClockLabel(840, true), '2:00 م');
    assert.equal(formatMinutesToClockLabel(1260, false), '9:00 PM');
    assert.equal(formatMinutesToClockLabel(1260, true), '9:00 م');
  });

  it('pre-shift click generates duty starts at message', () => {
    // 12:00 PM (720 min), Fatima shift starts at 14:00 (840 min)
    const res = getOffDutySlotMessage({
      employeeName: 'Fatima ali',
      slotMinuteOfDay: 720,
      dutyIntervals: fatimaDuty,
      isRtl: false
    });
    assert.equal(res.type, 'pre_shift');
    assert.equal(res.messageEn, "Fatima ali's duty starts at 2:00 PM.");
    assert.equal(res.messageAr, 'تبدأ مناوبة Fatima ali في الساعة 2:00 م.');

    const resAr = getOffDutySlotMessage({
      employeeName: 'فاطمة علي',
      slotMinuteOfDay: 720,
      dutyIntervals: fatimaDuty,
      isRtl: true
    });
    assert.equal(resAr.type, 'pre_shift');
    assert.equal(resAr.messageAr, 'تبدأ مناوبة فاطمة علي في الساعة 2:00 م.');
  });

  it('post-shift click generates duty ended at message', () => {
    // 21:30 (1290 min), Fatima shift ended at 21:00 (1260 min)
    const res = getOffDutySlotMessage({
      employeeName: 'Fatima ali',
      slotMinuteOfDay: 1290,
      dutyIntervals: fatimaDuty,
      isRtl: false
    });
    assert.equal(res.type, 'post_shift');
    assert.equal(res.messageEn, "Fatima ali's duty ended at 9:00 PM.");
    assert.equal(res.messageAr, 'انتهت مناوبة Fatima ali في الساعة 9:00 م.');
  });

  it('split-shift gap generates next duty starts at message', () => {
    // Split shift: 09:00 - 13:00 (540 - 780), and 17:00 - 21:00 (1020 - 1260)
    const splitDuty: DutyInterval[] = [
      { startMinutes: 540, endMinutes: 780 },
      { startMinutes: 1020, endMinutes: 1260 }
    ];

    // Gap at 15:00 (900 min)
    const res = getOffDutySlotMessage({
      employeeName: 'Sara',
      slotMinuteOfDay: 900,
      dutyIntervals: splitDuty,
      isRtl: false
    });
    assert.equal(res.type, 'split_shift_gap');
    assert.equal(res.messageEn, "Sara's next duty starts at 5:00 PM.");
    assert.equal(res.messageAr, 'تبدأ المناوبة التالية لـ Sara في الساعة 5:00 م.');
  });

  it('off-day click generates not scheduled to work today message', () => {
    const noDuty: DutyInterval[] = [];

    const res = getOffDutySlotMessage({
      employeeName: 'Fatima ali',
      slotMinuteOfDay: 840,
      dutyIntervals: noDuty,
      isRtl: false
    });
    assert.equal(res.type, 'off_day');
    assert.equal(res.messageEn, 'Fatima ali is not scheduled to work today.');
    assert.equal(res.messageAr, 'Fatima ali ليس لديه دوام اليوم.');
  });

  it('during duty is identified as on-duty by isSlotOnDuty', () => {
    // 15:00 (900 min) with 15-minute slot (900-915) is inside Fatima 14:00 - 21:00 shift (840-1260)
    const onDuty = isSlotOnDuty(900, 915, fatimaDuty);
    assert.equal(onDuty, true, 'Slot during duty is on-duty');

    // Slot at 12:00 (720-735) is off-duty
    const beforeDuty = isSlotOnDuty(720, 735, fatimaDuty);
    assert.equal(beforeDuty, false, 'Slot before shift is off-duty');
  });
});
