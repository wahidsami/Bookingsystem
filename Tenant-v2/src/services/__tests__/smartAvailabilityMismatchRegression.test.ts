import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateSmartAvailability,
  type SmartSlot,
  type StagedItemForAvailability
} from '../smartAvailabilityService';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';
import { buildTenantIsoFromMinutes } from '../../lib/tenantTime';

describe('Regression: Smart Availability Time Synchronization & Extension Mismatch', () => {
  const START_HOUR = 9;
  const NORMAL_END_HOUR = 21; // 9:00 PM closing
  const normalClosingMinutes = NORMAL_END_HOUR * 60; // 1260 minutes from midnight

  // Established helpers from InteractiveDrawers / AppointmentWorkspace
  const formatMinutesToTime = (totalMins: number) => {
    const minsFromMidnight = (START_HOUR * 60) + totalMins;
    let hours = Math.floor(minsFromMidnight / 60);
    const mins = Math.floor(minsFromMidnight % 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = mins < 10 ? '0' + mins : mins;
    return `${hours}:${minStr} ${ampm}`;
  };

  const formatBlockStartClockValue = (minutesFromNine: number) => {
    const safeOffset = Math.max(0, Math.round(Number(minutesFromNine || 0)));
    const absoluteMinutes = (START_HOUR * 60) + safeOffset;
    const hours = Math.floor(absoluteMinutes / 60);
    const minutes = absoluteMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  it('calculates 5:30 PM slot with correct boardMinutes (510) in tenant timezone', async () => {
    // 5:30 PM Asia/Riyadh (UTC+3) is 14:30 UTC
    const slotStartIso = '2026-10-12T14:30:00.000Z';
    const slotEndIso = '2026-10-12T15:30:00.000Z';

    const originalSearch = tenantApiAdapter.searchAvailability;
    tenantApiAdapter.searchAvailability = async () => ({
      success: true,
      slots: [
        {
          startTime: slotStartIso,
          endTime: slotEndIso,
          available: true,
          staffId: 'staff-talia',
          staffName: 'Talia'
        }
      ]
    });

    try {
      const stagedItems: StagedItemForAvailability[] = [
        {
          id: 'item-moroccan',
          serviceId: 'srv-moroccan',
          variantId: 'var-350',
          duration: 60,
          staffId: 'staff-talia'
        }
      ];

      const summary = await calculateSmartAvailability({
        tenantId: 'tenant-123',
        stagedItems,
        dateKey: '2026-10-12',
        checkAllProfessionals: false,
        isRtl: false,
        allStylists: [{ id: 'staff-talia', nameEn: 'Talia' }],
        tenantTimezone: 'Asia/Riyadh',
        boardStartHour: 9
      });

      assert.strictEqual(summary.slots.length, 1);
      const slot = summary.slots[0];

      // 1. Picker display should be 5:30 PM
      assert.strictEqual(slot.clockLabel, '5:30 PM');
      assert.strictEqual(slot.staffName, 'Talia');
      assert.strictEqual(slot.period, 'evening');

      // 2. Board minutes MUST be 510 (8.5 hours from 9:00 AM), NOT 1050 (minutes from midnight)
      assert.strictEqual(slot.boardMinutes, 510);
      assert.strictEqual(slot.timeMinutes, 510);

      // 3. Queued service card time label MUST show 5:30 PM, NOT 2:30 PM
      const formattedCardTime = formatMinutesToTime(slot.timeMinutes);
      assert.strictEqual(formattedCardTime, '5:30 PM');

      // 4. Queued service card dropdown MUST evaluate to '17:30', NOT '26:30' (which defaulted to 09:00 AM)
      const dropdownClock = formatBlockStartClockValue(slot.timeMinutes);
      assert.strictEqual(dropdownClock, '17:30');

      // 5. Operating-hours extension calculation:
      // (boardStartHour * 60) + slot.timeMinutes + duration = 540 + 510 + 60 = 1110 minutes (6:30 PM)
      const finalChainEndMinutes = (START_HOUR * 60) + slot.timeMinutes + 60;
      const extensionMinutes = finalChainEndMinutes - normalClosingMinutes;
      // 1110 - 1260 = -150 <= 0 -> NO extension required! NOT 390 minutes!
      assert.strictEqual(finalChainEndMinutes, 1110);
      assert.ok(extensionMinutes <= 0, `Extension minutes should be non-positive, got ${extensionMinutes}`);

      // 6. Final ISO timestamp consistency:
      const generatedIso = buildTenantIsoFromMinutes('2026-10-12', slot.timeMinutes, 'Asia/Riyadh', 9);
      assert.strictEqual(generatedIso, slotStartIso);
    } finally {
      tenantApiAdapter.searchAvailability = originalSearch;
    }
  });

  it('demonstrates how prior bug produced 2:30 PM label, 9:00 AM dropdown, and 390 min extension', () => {
    // If timeMinutes was erroneously set to 1050 (minutes from midnight instead of board minutes):
    const buggyTimeMinutes = 1050;

    // Buggy label: formatMinutesToTime(1050) adds (9 * 60) = 540 -> 1590 mins -> 2:30 PM!
    const buggyLabel = formatMinutesToTime(buggyTimeMinutes);
    assert.strictEqual(buggyLabel, '2:30 PM');

    // Buggy dropdown: formatBlockStartClockValue(1050) adds 540 -> 1590 mins -> "26:30" (invalid, falls back to 9:00 AM)
    const buggyDropdown = formatBlockStartClockValue(buggyTimeMinutes);
    assert.strictEqual(buggyDropdown, '26:30');

    // Buggy extension: 540 + 1050 + 60 = 1650 mins. Closing is 1260 mins -> 1650 - 1260 = 390 minutes!
    const buggyFinalEnd = (START_HOUR * 60) + buggyTimeMinutes + 60;
    const buggyExtension = buggyFinalEnd - normalClosingMinutes;
    assert.strictEqual(buggyExtension, 390);

    // With our fix (510):
    const fixedTimeMinutes = 510;
    assert.strictEqual(formatMinutesToTime(fixedTimeMinutes), '5:30 PM');
    assert.strictEqual(formatBlockStartClockValue(fixedTimeMinutes), '17:30');
    assert.strictEqual((START_HOUR * 60) + fixedTimeMinutes + 60 - normalClosingMinutes, -150);
  });
});
