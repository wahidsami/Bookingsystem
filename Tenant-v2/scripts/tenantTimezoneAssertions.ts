import assert from 'node:assert/strict';
import { buildTenantIsoFromMinutes, resolveTenantTimezone } from '../src/lib/tenantTime';

const tenantTimezone = resolveTenantTimezone('Asia/Riyadh');

const expectations = [
  {
    name: '20:45 tenant-local time in Riyadh',
    actual: buildTenantIsoFromMinutes('2026-08-16', (20 * 60 + 45) - (9 * 60), tenantTimezone, 9),
    expected: '2026-08-16T17:45:00.000Z'
  },
  {
    name: '19:00 tenant-local start in Riyadh',
    actual: buildTenantIsoFromMinutes('2026-08-16', (19 * 60) - (9 * 60), tenantTimezone, 9),
    expected: '2026-08-16T16:00:00.000Z'
  }
];

for (const testCase of expectations) {
  assert.equal(testCase.actual, testCase.expected, `${testCase.name} produced ${testCase.actual}, expected ${testCase.expected}`);
}

const chainStart = buildTenantIsoFromMinutes('2026-08-16', (19 * 60) - (9 * 60), tenantTimezone, 9);
const chainEnd = new Date(new Date(chainStart).getTime() + 150 * 60000).toISOString();
assert.equal(chainEnd, '2026-08-16T18:30:00.000Z', `Chain end produced ${chainEnd}, expected 2026-08-16T18:30:00.000Z`);

console.log(JSON.stringify({
  ok: true,
  processTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  tenantTimezone,
  results: expectations.map((testCase) => ({ name: testCase.name, actual: testCase.actual })),
  chainEnd
}, null, 2));
