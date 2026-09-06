import test from 'node:test';
import assert from 'node:assert/strict';
import { getSchedulerEventBoxMetrics } from './schedulerGeometry';

test('hour-long event uses the full 12-row span and 30-min uses half the height', () => {
  const sixty = getSchedulerEventBoxMetrics({
    startMinutes: 600,
    endMinutes: 660,
    slotMinutes: 5,
    slotHeight: 10,
    timelineStartMinutes: 540,
  });
  const thirty = getSchedulerEventBoxMetrics({
    startMinutes: 600,
    endMinutes: 630,
    slotMinutes: 5,
    slotHeight: 10,
    timelineStartMinutes: 540,
  });

  assert.equal(sixty.top, 120);
  assert.equal(sixty.height, 120);
  assert.equal(thirty.top, 120);
  assert.equal(thirty.height, 60);
  assert.equal(thirty.height, sixty.height / 2);
});
