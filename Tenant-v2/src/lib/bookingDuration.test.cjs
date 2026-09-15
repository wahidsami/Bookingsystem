const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveBookingDuration } = require('./bookingDuration.js');

test('prefers an explicit staged duration over a variant duration', () => {
  assert.equal(resolveBookingDuration(60, 30, 90), 60);
});

test('falls back to the selected variant duration when no staged duration is present', () => {
  assert.equal(resolveBookingDuration(undefined, 45, 90), 45);
});

test('falls back to the service duration when neither staged nor variant duration is present', () => {
  assert.equal(resolveBookingDuration(undefined, undefined, 90), 90);
});
