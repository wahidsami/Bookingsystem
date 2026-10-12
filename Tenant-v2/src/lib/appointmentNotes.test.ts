import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeAppointmentNotes,
  stripRescheduleAuditMarkers,
  RESCHEDULE_AUDIT_MARKER,
  CANCELLATION_AUDIT_MARKER,
  GROUP_GUEST_MARKER,
  CANCELLATION_REASON_MARKER
} from './appointmentNotes';

test('Case A: Normal human note is preserved exactly', () => {
  const input = 'حياكم';
  assert.equal(sanitizeAppointmentNotes(input), 'حياكم');
  assert.equal(sanitizeAppointmentNotes(input) || '—', 'حياكم');
});

test('Case B: Human note + RESCHEDULE_AUDIT returns human note only', () => {
  const input = 'حياكم\n[RESCHEDULE_AUDIT] {"at":"2026-09-23T16:43:43.896Z","actor":"customer","fromStartTime":"2026-09-24T15:30:00.000Z"}';
  assert.equal(sanitizeAppointmentNotes(input), 'حياكم');
  assert.equal(sanitizeAppointmentNotes(input) || '—', 'حياكم');
});

test('Case C: RESCHEDULE_AUDIT only returns empty string (displays fallback dash)', () => {
  const input = '[RESCHEDULE_AUDIT] {"at":"2026-09-23T16:43:43.896Z","actor":"customer"}';
  assert.equal(sanitizeAppointmentNotes(input), '');
  assert.equal(sanitizeAppointmentNotes(input) || '—', '—');
});

test('Case D: Human note + CANCELLATION_AUDIT returns human note only', () => {
  const input = 'Need organic wax\n[CANCELLATION_AUDIT] {"reason":"customer_request"}';
  assert.equal(sanitizeAppointmentNotes(input), 'Need organic wax');
  assert.equal(sanitizeAppointmentNotes(input) || '—', 'Need organic wax');
});

test('Case E: Human note + GROUP_GUEST returns human note only', () => {
  const input = 'Please be gentle\n[GROUP_GUEST] {"fullName":"Sarah","phone":"0555123456"}';
  assert.equal(sanitizeAppointmentNotes(input), 'Please be gentle');
  assert.equal(sanitizeAppointmentNotes(input) || '—', 'Please be gentle');
});

test('Case F: Human note + [Cancellation Reason] returns human note only', () => {
  const input = 'VIP client\n[Cancellation Reason]: Customer requested refund';
  assert.equal(sanitizeAppointmentNotes(input), 'VIP client');
  assert.equal(sanitizeAppointmentNotes(input) || '—', 'VIP client');
});

test('Case G: Multiple RESCHEDULE_AUDIT blocks returns human note only without audit JSON', () => {
  const input = 'حياكم\n[RESCHEDULE_AUDIT] {"at":"2026-09-22T10:00:00Z"}\n[RESCHEDULE_AUDIT] {"at":"2026-09-23T12:00:00Z"}';
  assert.equal(sanitizeAppointmentNotes(input), 'حياكم');
  assert.equal(sanitizeAppointmentNotes(input) || '—', 'حياكم');
});

test('Case H: Null, undefined, and empty string return empty (displays fallback dash)', () => {
  assert.equal(sanitizeAppointmentNotes(null), '');
  assert.equal(sanitizeAppointmentNotes(null) || '—', '—');

  assert.equal(sanitizeAppointmentNotes(undefined), '');
  assert.equal(sanitizeAppointmentNotes(undefined) || '—', '—');

  assert.equal(sanitizeAppointmentNotes(''), '');
  assert.equal(sanitizeAppointmentNotes('') || '—', '—');

  assert.equal(sanitizeAppointmentNotes('   \n  \n'), '');
  assert.equal(sanitizeAppointmentNotes('   \n  \n') || '—', '—');
});

test('stripRescheduleAuditMarkers removes only reschedule audit marker', () => {
  const input = 'Note line\n[RESCHEDULE_AUDIT] {"actor":"customer"}\nSecond note line';
  assert.equal(stripRescheduleAuditMarkers(input), 'Note line\nSecond note line');
});
