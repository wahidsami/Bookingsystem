import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEmptyAppointmentDraftSnapshot, isAppointmentDraftContent } from '../lib/appointmentDraftState';

test('successful booking cleanup resets the draft to an empty baseline', () => {
  const emptyDraft = buildEmptyAppointmentDraftSnapshot();
  assert.equal(isAppointmentDraftContent(emptyDraft), false);
});

test('board-seeded values still produce a meaningful draft for a new unfinished appointment', () => {
  const draft = buildEmptyAppointmentDraftSnapshot();
  const seeded = { ...draft, currentStartTime: 725, currentStaffId: 'stylist-1' };
  assert.equal(isAppointmentDraftContent(seeded), true);
});

test('genuine incomplete drafts remain recoverable', () => {
  const draft = buildEmptyAppointmentDraftSnapshot();
  const incomplete = { ...draft, currentServiceId: 'svc-1', stagedServices: [{ id: 'stg-1' }] as any[] };
  assert.equal(isAppointmentDraftContent(incomplete), true);
});
