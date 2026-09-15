import assert from 'node:assert/strict';
import test from 'node:test';
import { isAutoDerivedFromPreviousChain } from '../lib/chainedServiceTiming';

const priorItem = {
  startTime: 60,
  duration: 60,
  startTimeIso: '2026-09-03T07:00:00.000Z'
};

test('automatically derived chained services remain eligible for a cascade', () => {
  assert.equal(isAutoDerivedFromPreviousChain({
    priorItem,
    currentItem: {
      startTime: 120,
      startTimeIso: '2026-09-03T08:00:00.000Z'
    },
    expectedStartIso: '2026-09-03T08:00:00.000Z'
  }), true);
});

test('a manually saved chained service time remains authoritative after reload', () => {
  const reloadedManualService = {
    startTime: 180,
    startTimeIso: '2026-09-03T09:00:00.000Z'
  };

  assert.equal(isAutoDerivedFromPreviousChain({
    priorItem,
    currentItem: reloadedManualService,
    expectedStartIso: '2026-09-03T08:00:00.000Z'
  }), false);
});