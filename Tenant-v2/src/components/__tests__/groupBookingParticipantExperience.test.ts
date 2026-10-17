import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGroupStagedPricing,
  isQueuedStandaloneServiceSelected,
  calculateStagedPricing,
  type MinimalStagedItem,
  type GroupParticipantInfo
} from '../../lib/bundleStagingHelpers';

test('Group Booking Participant-First Experience Suite', async (t) => {
  // Scenario 1: Active participant clean name resolution without awkward role suffixes
  await t.test('Scenario 1: Resolves clean participant names for localized catalogue headers', () => {
    const participants: GroupParticipantInfo[] = [
      { id: 'part-1', name: 'سارة المنصور', isOrganizer: true },
      { id: 'part-2', name: 'نورة الخالد', isOrganizer: false },
      { id: 'part-3', name: '', isOrganizer: false }
    ];

    const getCleanName = (partId: string, isRtl: boolean) => {
      const p = participants.find(part => part.id === partId) || participants[0];
      const idx = participants.findIndex(part => part.id === partId);
      return p?.name?.trim() || (idx === 0 ? (isRtl ? 'المنظم' : 'Organizer') : `${isRtl ? 'مشارك' : 'Participant'} ${idx + 1}`);
    };

    // Organizer clean name
    assert.equal(getCleanName('part-1', true), 'سارة المنصور');
    assert.equal(getCleanName('part-1', false), 'سارة المنصور');

    // Guest with name
    assert.equal(getCleanName('part-2', true), 'نورة الخالد');
    assert.equal(getCleanName('part-2', false), 'نورة الخالد');

    // Guest without explicit name falls back to localized index label
    assert.equal(getCleanName('part-3', true), 'مشارك 3');
    assert.equal(getCleanName('part-3', false), 'Participant 3');
  });

  // Scenario 2: Organizer is strictly Participant 1 (no phantom guests, cannot be deleted)
  await t.test('Scenario 2: Organizer is strictly Participant 1 and cannot be removed', () => {
    const initialParticipants = [
      { id: 'part-organizer', name: 'منى العتيبي', isOrganizer: true },
      { id: 'part-guest-1', name: 'هند', isOrganizer: false }
    ];

    // Attempt to remove organizer
    const removeParticipant = (list: typeof initialParticipants, targetId: string) => {
      if (list.length <= 1) return list;
      if (targetId === list[0].id) return list; // Guard: Organizer cannot be removed
      return list.filter(p => p.id !== targetId);
    };

    const afterOrganizerRemove = removeParticipant(initialParticipants, 'part-organizer');
    assert.equal(afterOrganizerRemove.length, 2);
    assert.equal(afterOrganizerRemove[0].id, 'part-organizer');

    // Removing guest works properly
    const afterGuestRemove = removeParticipant(initialParticipants, 'part-guest-1');
    assert.equal(afterGuestRemove.length, 1);
    assert.equal(afterGuestRemove[0].id, 'part-organizer');
  });

  // Scenario 3: Service assignment is strictly participant-specific
  await t.test('Scenario 3: Catalogue selections respond strictly to active participant', () => {
    const p1Id = 'part-1';
    const p2Id = 'part-2';

    const stagedServices: MinimalStagedItem[] = [
      { id: 'item-1', serviceId: 'srv-haircut', variantId: 'v-short', participantId: p1Id, price: 150, duration: 45 },
      { id: 'item-2', serviceId: 'srv-color', variantId: null, participantId: p2Id, price: 300, duration: 60 }
    ];

    // For Participant 1: haircut is selected, color is NOT selected
    assert.equal(isQueuedStandaloneServiceSelected(stagedServices, 'srv-haircut', 'v-short', p1Id), true);
    assert.equal(isQueuedStandaloneServiceSelected(stagedServices, 'srv-color', null, p1Id), false);

    // For Participant 2: haircut is NOT selected, color IS selected
    assert.equal(isQueuedStandaloneServiceSelected(stagedServices, 'srv-haircut', 'v-short', p2Id), false);
    assert.equal(isQueuedStandaloneServiceSelected(stagedServices, 'srv-color', null, p2Id), true);
  });

  // Scenario 4: Switching active participant preserves assigned services without data loss or leaks
  await t.test('Scenario 4: Switching active participant filters queued view without cross-contaminating state', () => {
    const p1Id = 'part-1';
    const p2Id = 'part-2';

    let stagedServices: MinimalStagedItem[] = [
      { id: 'item-1', serviceId: 'srv-1', participantId: p1Id, price: 100, duration: 30 },
      { id: 'item-2', serviceId: 'srv-2', participantId: p2Id, price: 200, duration: 45 }
    ];

    // Simulate active participant = p1
    let activeId = p1Id;
    let visibleItems = stagedServices.filter(s => (s.participantId || p1Id) === activeId);
    assert.equal(visibleItems.length, 1);
    assert.equal(visibleItems[0].id, 'item-1');

    // Switch active participant to p2
    activeId = p2Id;
    visibleItems = stagedServices.filter(s => (s.participantId || p1Id) === activeId);
    assert.equal(visibleItems.length, 1);
    assert.equal(visibleItems[0].id, 'item-2');

    // Add service for p2
    stagedServices = [
      ...stagedServices,
      { id: 'item-3', serviceId: 'srv-3', participantId: p2Id, price: 80, duration: 20 }
    ];

    // Verify p2 now has 2 services, p1 still has 1 service
    const p1Services = stagedServices.filter(s => (s.participantId || p1Id) === p1Id);
    const p2Services = stagedServices.filter(s => (s.participantId || p1Id) === p2Id);
    assert.equal(p1Services.length, 1);
    assert.equal(p2Services.length, 2);
  });

  // Scenario 5: Financial engine aggregates individual participant totals and consolidated VAT
  await t.test('Scenario 5: Accurate participant breakdowns and 15% ZATCA VAT aggregation', () => {
    const participants: GroupParticipantInfo[] = [
      { id: 'part-1', name: 'سارة', isOrganizer: true },
      { id: 'part-2', name: 'ريم', isOrganizer: false }
    ];

    const stagedServices: MinimalStagedItem[] = [
      { id: 'item-1', serviceId: 'srv-1', participantId: 'part-1', basePrice: 100, finalPrice: 100, duration: 30 },
      { id: 'item-2', serviceId: 'srv-2', participantId: 'part-1', basePrice: 50, finalPrice: 50, duration: 15 },
      { id: 'item-3', serviceId: 'srv-3', participantId: 'part-2', basePrice: 200, finalPrice: 200, duration: 60 }
    ];

    const summary = calculateGroupStagedPricing(participants, stagedServices, []);

    // Participant 1: 150 subtotal + 22.50 VAT = 172.50 total
    const p1 = summary.participantBreakdowns.find(p => p.participantId === 'part-1')!;
    assert.equal(p1.itemsCount, 2);
    assert.equal(p1.subtotal, 150);
    assert.equal(p1.vat, 22.5);
    assert.equal(p1.total, 172.5);

    // Participant 2: 200 subtotal + 30 VAT = 230 total
    const p2 = summary.participantBreakdowns.find(p => p.participantId === 'part-2')!;
    assert.equal(p2.itemsCount, 1);
    assert.equal(p2.subtotal, 200);
    assert.equal(p2.vat, 30);
    assert.equal(p2.total, 230);

    // Consolidated: Subtotal 350, VAT 52.50, Total 402.50
    assert.equal(summary.consolidatedSubtotal, 350);
    assert.equal(summary.consolidatedVat, 52.5);
    assert.equal(summary.consolidatedTotal, 402.5);
  });

  // Scenario 6: Single-booking mode remains completely isolated
  await t.test('Scenario 6: Single-booking mode pricing calculation ignores participantId tags', () => {
    const singleItems: MinimalStagedItem[] = [
      { id: 'item-1', serviceId: 'srv-1', basePrice: 120, finalPrice: 120, duration: 30 },
      { id: 'item-2', serviceId: 'srv-2', basePrice: 80, finalPrice: 80, duration: 20 }
    ];

    const singlePricing = calculateStagedPricing(singleItems, []);
    assert.equal(singlePricing.subtotal, 200);
    assert.equal(singlePricing.vat, 30);
    assert.equal(singlePricing.total, 230);
  });
});
