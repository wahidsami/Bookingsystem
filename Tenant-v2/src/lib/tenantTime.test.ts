import test from 'node:test';
import assert from 'node:assert/strict';
import { getBoardMinutesFromTimestamp } from './tenantTime';

test('getBoardMinutesFromTimestamp converts ISO timestamps using tenant timezone', () => {
  const timestamp = '2026-09-06T10:30:00.000Z';
  const minutes = getBoardMinutesFromTimestamp(timestamp, 'Asia/Riyadh', 9);
  assert.equal(minutes, 270);
});

test('getBoardMinutesFromTimestamp returns null for invalid timestamps', () => {
  assert.equal(getBoardMinutesFromTimestamp('not-a-date', 'Asia/Riyadh', 9), null);
});
