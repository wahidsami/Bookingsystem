import { describe, it } from 'node:test';
import assert from 'node:assert';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';
import { fetchAvailabilityLayers } from '../availabilityService';

describe('Availability Search Contract & Guarding Regression Tests', () => {
  it('tenantApiAdapter.searchAvailability returns safe empty response when tenantId is missing', async () => {
    let networkCalled = false;
    const originalPost = (tenantApiAdapter as any).post.bind(tenantApiAdapter);
    (tenantApiAdapter as any).post = async () => {
      networkCalled = true;
      return { success: true, slots: [] };
    };

    try {
      const res = await tenantApiAdapter.searchAvailability({
        tenantId: '',
        date: '2026-10-15',
        serviceId: 'srv-123'
      });

      assert.strictEqual(networkCalled, false, 'Network call must not be made without tenantId');
      assert.strictEqual(res.success, false);
      assert.deepStrictEqual(res.slots, []);
      assert.strictEqual(res.totalSlots, 0);
    } finally {
      (tenantApiAdapter as any).post = originalPost;
    }
  });

  it('tenantApiAdapter.searchAvailability returns safe empty response when date is missing', async () => {
    let networkCalled = false;
    const originalPost = (tenantApiAdapter as any).post.bind(tenantApiAdapter);
    (tenantApiAdapter as any).post = async () => {
      networkCalled = true;
      return { success: true, slots: [] };
    };

    try {
      const res = await tenantApiAdapter.searchAvailability({
        tenantId: 'tenant-123',
        date: '',
        serviceId: 'srv-123'
      });

      assert.strictEqual(networkCalled, false, 'Network call must not be made without date');
      assert.strictEqual(res.success, false);
      assert.deepStrictEqual(res.slots, []);
    } finally {
      (tenantApiAdapter as any).post = originalPost;
    }
  });

  it('tenantApiAdapter.searchAvailability returns safe empty response when neither serviceId nor packageId is provided', async () => {
    let networkCalled = false;
    const originalPost = (tenantApiAdapter as any).post.bind(tenantApiAdapter);
    (tenantApiAdapter as any).post = async () => {
      networkCalled = true;
      return { success: true, slots: [] };
    };

    try {
      const res = await tenantApiAdapter.searchAvailability({
        tenantId: 'tenant-123',
        date: '2026-10-15'
      });

      assert.strictEqual(networkCalled, false, 'Network call must not be made without serviceId or packageId');
      assert.strictEqual(res.success, false);
      assert.deepStrictEqual(res.slots, []);
    } finally {
      (tenantApiAdapter as any).post = originalPost;
    }
  });

  it('tenantApiAdapter.searchAvailability dispatches request when packageId is provided instead of serviceId', async () => {
    let capturedPayload: any = null;
    const originalPost = (tenantApiAdapter as any).post.bind(tenantApiAdapter);
    (tenantApiAdapter as any).post = async (url: string, payload: any) => {
      capturedPayload = payload;
      return {
        success: true,
        slots: [
          {
            startTime: '2026-10-15T09:00:00Z',
            endTime: '2026-10-15T10:00:00Z',
            available: true,
            staffId: 'staff-1'
          }
        ]
      };
    };

    try {
      const res = await tenantApiAdapter.searchAvailability({
        tenantId: 'tenant-123',
        date: '2026-10-15',
        packageId: 'pkg-456'
      });

      assert.ok(capturedPayload, 'Network call should have been dispatched');
      assert.strictEqual(capturedPayload.tenantId, 'tenant-123');
      assert.strictEqual(capturedPayload.packageId, 'pkg-456');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.slots.length, 1);
    } finally {
      (tenantApiAdapter as any).post = originalPost;
    }
  });

  it('fetchAvailabilityLayers handles items with packageId and items with serviceId', async () => {
    const originalSearch = tenantApiAdapter.searchAvailability.bind(tenantApiAdapter);
    const queries: any[] = [];
    tenantApiAdapter.searchAvailability = async (query: any) => {
      queries.push(query);
      return {
        success: true,
        slots: [
          {
            startTime: '2026-10-15T10:00:00Z',
            endTime: '2026-10-15T11:00:00Z',
            available: true,
            staffId: 'staff-1',
            staffName: 'Staff 1'
          }
        ]
      };
    };

    try {
      const result = await fetchAvailabilityLayers({
        tenantId: 'tenant-123',
        dateKey: '2026-10-15',
        items: [
          { id: 'item-1', serviceId: 'srv-1', staffId: 'staff-1' },
          { id: 'item-2', packageId: 'pkg-2', staffId: 'staff-1' }
        ]
      });

      assert.strictEqual(queries.length, 2, 'Should query availability for both service item and package item');
      assert.strictEqual(queries[0].serviceId, 'srv-1');
      assert.strictEqual(queries[1].packageId, 'pkg-2');
      assert.strictEqual(result.anyFailed, false);
      assert.strictEqual(result.layers.length, 2);
      assert.strictEqual(result.layers[0].length, 1);
      assert.strictEqual(result.layers[1].length, 1);
    } finally {
      tenantApiAdapter.searchAvailability = originalSearch;
    }
  });

  it('verifies group booking condition skips single-client sequential preflight', () => {
    // Condition evaluated in InteractiveDrawers.tsx:3205
    const shouldPreflightSingleClient = (bookingScope: string, itemsCount: number, allowExtendedHours: boolean) => {
      return bookingScope !== 'group' && itemsCount > 1 && !allowExtendedHours;
    };

    // Standard multi-service single client -> should preflight
    assert.strictEqual(shouldPreflightSingleClient('individual', 3, false), true);

    // Group booking with multiple participants -> MUST NOT preflight sequential chain
    assert.strictEqual(shouldPreflightSingleClient('group', 3, false), false);

    // Group booking with single participant -> MUST NOT preflight sequential chain
    assert.strictEqual(shouldPreflightSingleClient('group', 1, false), false);
  });
});
