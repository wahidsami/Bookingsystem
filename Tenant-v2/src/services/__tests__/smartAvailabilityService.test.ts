import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateSmartAvailability,
  findNextAvailableAlternative,
  type StagedItemForAvailability
} from '../smartAvailabilityService';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';

describe('Phase 3: Smart Availability Service', () => {
  it('calculates package availability and categorizes slots by morning, afternoon, evening', async () => {
    // Mock searchPackageAvailability
    const originalSearch = tenantApiAdapter.searchPackageAvailability;
    tenantApiAdapter.searchPackageAvailability = async () => ({
      success: true,
      slots: [
        { startTime: '2026-10-15T09:00:00Z', endTime: '2026-10-15T10:30:00Z', available: true, staffId: 'emp-1' },
        { startTime: '2026-10-15T14:00:00Z', endTime: '2026-10-15T15:30:00Z', available: true, staffId: 'emp-2' },
        { startTime: '2026-10-15T19:00:00Z', endTime: '2026-10-15T20:30:00Z', available: true, staffId: 'emp-1' },
        { startTime: '2026-10-15T21:00:00Z', endTime: '2026-10-15T22:30:00Z', available: false, staffId: 'emp-1' }
      ]
    });

    try {
      const stagedItems: StagedItemForAvailability[] = [
        {
          id: 'item-1',
          serviceId: 'srv-1',
          packageId: 'pkg-1',
          duration: 90,
          staffId: 'emp-1'
        }
      ];

      const summary = await calculateSmartAvailability({
        tenantId: 'tenant-123',
        stagedItems,
        dateKey: '2026-10-15',
        checkAllProfessionals: true,
        isRtl: false,
        allStylists: [
          { id: 'emp-1', nameEn: 'Sarah' },
          { id: 'emp-2', nameEn: 'Layla' }
        ]
      });

      assert.strictEqual(summary.hasAvailability, true);
      assert.strictEqual(summary.availableCount, 3);
      assert.strictEqual(summary.slots.length, 3);
      // Slots should be classified by period
      assert.ok(summary.slotsByPeriod.morning.length >= 1 || summary.slotsByPeriod.afternoon.length >= 1);
      // Staff names should be resolved
      const hasStaffName = summary.slots.some(s => s.staffName === 'Sarah' || s.staffName === 'Layla');
      assert.strictEqual(hasStaffName, true);
    } finally {
      tenantApiAdapter.searchPackageAvailability = originalSearch;
    }
  });

  it('queries next available alternative when requested date has no availability', async () => {
    const originalGetNext = tenantApiAdapter.getNextAvailableSlot;
    tenantApiAdapter.getNextAvailableSlot = async () => ({
      success: true,
      date: '2026-10-18',
      daysAhead: 3,
      slot: {
        startTime: '2026-10-18T10:00:00Z',
        endTime: '2026-10-18T11:30:00Z',
        staffId: 'emp-2',
        staffName: 'Layla'
      }
    });

    try {
      const stagedItems: StagedItemForAvailability[] = [
        {
          id: 'item-1',
          serviceId: 'srv-1',
          packageId: 'pkg-1',
          duration: 90
        }
      ];

      const alternative = await findNextAvailableAlternative({
        tenantId: 'tenant-123',
        stagedItems,
        startDate: '2026-10-15',
        checkAllProfessionals: true,
        isRtl: false
      });

      assert.strictEqual(alternative.found, true);
      assert.strictEqual(alternative.dateKey, '2026-10-18');
      assert.strictEqual(alternative.daysAhead, 3);
      assert.strictEqual(alternative.earliestSlot?.staffId, 'emp-2');
      assert.ok(alternative.displayDateEn?.includes('18'));
    } finally {
      tenantApiAdapter.getNextAvailableSlot = originalGetNext;
    }
  });

  it('respects explicit staff preferences vs check all professionals', async () => {
    let capturedParams: any = null;
    const originalSearch = tenantApiAdapter.searchPackageAvailability;
    tenantApiAdapter.searchPackageAvailability = async (params: any) => {
      capturedParams = params;
      return { success: true, slots: [] };
    };

    try {
      const stagedItems: StagedItemForAvailability[] = [
        {
          id: 'item-1',
          serviceId: 'srv-1',
          packageId: 'pkg-1',
          duration: 90,
          staffId: 'emp-preferred',
          isExplicitStaff: true
        }
      ];

      // 1. With checkAllProfessionals = false, should send explicit staffId
      await calculateSmartAvailability({
        tenantId: 'tenant-123',
        stagedItems,
        dateKey: '2026-10-15',
        checkAllProfessionals: false
      });
      assert.strictEqual(capturedParams.staffId, 'emp-preferred');

      // 2. With checkAllProfessionals = true, should NOT constrain to single staffId
      await calculateSmartAvailability({
        tenantId: 'tenant-123',
        stagedItems,
        dateKey: '2026-10-15',
        checkAllProfessionals: true
      });
      assert.strictEqual(capturedParams.staffId, undefined);
    } finally {
      tenantApiAdapter.searchPackageAvailability = originalSearch;
    }
  });
});
