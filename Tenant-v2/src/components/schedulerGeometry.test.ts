import test from 'node:test';
import assert from 'node:assert/strict';
import { getSchedulerEventBoxMetrics } from './schedulerGeometry';

test('hour-long event uses the full 12-row span and 30-min uses half the height', () => {
  const sixty = getSchedulerEventBoxMetrics({ startMinutes: 60, endMinutes: 120, slotMinutes: 5, slotHeight: 10 });
  const thirty = getSchedulerEventBoxMetrics({ startMinutes: 60, endMinutes: 90, slotMinutes: 5, slotHeight: 10 });

  assert.equal(sixty.top, 120);
  assert.equal(sixty.height, 120);
  assert.equal(thirty.top, 120);
  assert.equal(thirty.height, 60);
  assert.equal(thirty.height, sixty.height / 2);
});
