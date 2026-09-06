import test from 'node:test';
import assert from 'node:assert/strict';
import { getSchedulerEventBoxMetrics, getSlotHeightForResolution } from './schedulerGeometry';

test('keeps one physical hour identical across slot resolutions', () => {
  const pixelsPerHour = 100;
  const fiveMinuteHeight = getSlotHeightForResolution({ pixelsPerHour, slotMinutes: 5 });
  const fifteenMinuteHeight = getSlotHeightForResolution({ pixelsPerHour, slotMinutes: 15 });

  const sixtyFiveMinute = getSchedulerEventBoxMetrics({
    startMinutes: 600,
    endMinutes: 660,
    pixelsPerHour,
    timelineStartMinutes: 540,
  });
  const sixtyFifteenMinute = getSchedulerEventBoxMetrics({
    startMinutes: 600,
    endMinutes: 660,
    pixelsPerHour,
    timelineStartMinutes: 540,
  });
  const thirtyFifteenMinute = getSchedulerEventBoxMetrics({
    startMinutes: 600,
    endMinutes: 630,
    pixelsPerHour,
    timelineStartMinutes: 540,
  });

  assert.equal(fiveMinuteHeight, 100 * 5 / 60);
  assert.equal(fifteenMinuteHeight, 100 * 15 / 60);
  assert.equal(sixtyFiveMinute.height, 100);
  assert.equal(sixtyFifteenMinute.height, 100);
  assert.equal(thirtyFifteenMinute.height, 50);
  assert.equal(thirtyFifteenMinute.height, sixtyFifteenMinute.height / 2);
});
