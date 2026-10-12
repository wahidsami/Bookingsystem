import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isQueuedStandaloneServiceSelected,
  removeStandaloneQueuedService,
  removeBundleFromStagedServices,
  calculateGroupStagedPricing,
  checkIsAppointmentDraftDirty,
  MinimalStagedItem,
  MinimalPackageItem,
  GroupParticipantInfo
} from '../../lib/bundleStagingHelpers';

const PERFECT_STUDENT_BUNDLE: MinimalPackageItem = {
  id: 'pkg-perfect-student',
  totalPrice: 500,
  totalDuration: 120,
  scheduleType: 'sequential'
};

const SERVICE_MASSAGE = 'srv-massage';
const SERVICE_FACIAL = 'srv-facial';
const SERVICE_MANICURE = 'srv-manicure';

test('Group Staging: Participant 1 selecting a service does NOT mark it as selected for Participant 2', () => {
  const stagedServices: MinimalStagedItem[] = [
    {
      id: 'stg-1',
      serviceId: SERVICE_MASSAGE,
      itemType: 'service',
      duration: 60,
      basePrice: 200,
      finalPrice: 200,
      participantId: 'p-1'
    }
  ];

  // For Participant 1, the service IS selected
  const isSelectedForP1 = isQueuedStandaloneServiceSelected(stagedServices, SERVICE_MASSAGE, null, 'p-1');
  assert.equal(isSelectedForP1, true, 'Service should be selected for Participant 1');

  // For Participant 2, the service is NOT selected
  const isSelectedForP2 = isQueuedStandaloneServiceSelected(stagedServices, SERVICE_MASSAGE, null, 'p-2');
  assert.equal(isSelectedForP2, false, 'Service must NOT be marked selected for Participant 2');
});

test('Group Staging: Removing a service for Participant 1 preserves the same service for Participant 2', () => {
  const stagedServices: MinimalStagedItem[] = [
    {
      id: 'stg-1',
      serviceId: SERVICE_MASSAGE,
      itemType: 'service',
      duration: 60,
      basePrice: 200,
      finalPrice: 200,
      participantId: 'p-1'
    },
    {
      id: 'stg-2',
      serviceId: SERVICE_MASSAGE,
      itemType: 'service',
      duration: 60,
      basePrice: 200,
      finalPrice: 200,
      participantId: 'p-2'
    }
  ];

  const updatedServices = removeStandaloneQueuedService(stagedServices, SERVICE_MASSAGE, null, 'p-1');

  assert.equal(updatedServices.length, 1, 'Should have 1 service remaining');
  assert.equal(updatedServices[0].participantId, 'p-2', 'Participant 2 service must be preserved');
});

test('Group Staging: Bundle removal for Participant 1 preserves Participant 2 bundle', () => {
  const stagedServices: MinimalStagedItem[] = [
    {
      id: 'stg-1',
      serviceId: SERVICE_MASSAGE,
      itemType: 'package',
      packageId: PERFECT_STUDENT_BUNDLE.id,
      packageInstanceId: 'inst-p1',
      duration: 60,
      basePrice: 250,
      finalPrice: 250,
      participantId: 'p-1'
    },
    {
      id: 'stg-2',
      serviceId: SERVICE_MASSAGE,
      itemType: 'package',
      packageId: PERFECT_STUDENT_BUNDLE.id,
      packageInstanceId: 'inst-p2',
      duration: 60,
      basePrice: 250,
      finalPrice: 250,
      participantId: 'p-2'
    }
  ];

  const updated = removeBundleFromStagedServices(stagedServices, 'inst-p1', 'p-1');
  assert.equal(updated.length, 1);
  assert.equal(updated[0].participantId, 'p-2');
});

test('Group Financials: Calculates distinct participant subtotals and consolidated group total with 15% VAT', () => {
  const participants: GroupParticipantInfo[] = [
    { id: 'p-1', name: 'Sara (Organizer)', isOrganizer: true },
    { id: 'p-2', name: 'Layla', isOrganizer: false },
    { id: 'p-3', name: 'Noura', isOrganizer: false }
  ];

  const stagedServices: MinimalStagedItem[] = [
    // Participant 1 (Sara): 1 Massage (200 SAR)
    {
      id: 'stg-1',
      serviceId: SERVICE_MASSAGE,
      itemType: 'service',
      duration: 60,
      basePrice: 200,
      finalPrice: 200,
      participantId: 'p-1'
    },
    // Participant 2 (Layla): 1 Facial (150 SAR)
    {
      id: 'stg-2',
      serviceId: SERVICE_FACIAL,
      itemType: 'service',
      duration: 45,
      basePrice: 150,
      finalPrice: 150,
      participantId: 'p-2'
    },
    // Participant 3 (Noura): 1 Manicure (100 SAR)
    {
      id: 'stg-3',
      serviceId: SERVICE_MANICURE,
      itemType: 'service',
      duration: 30,
      basePrice: 100,
      finalPrice: 100,
      participantId: 'p-3'
    }
  ];

  const summary = calculateGroupStagedPricing(participants, stagedServices, []);

  // Check Participant 1
  assert.equal(summary.participants[0].name, 'Sara (Organizer)');
  assert.equal(summary.participants[0].subtotal, 200);
  assert.equal(summary.participants[0].vat, 30);
  assert.equal(summary.participants[0].total, 230);

  // Check Participant 2
  assert.equal(summary.participants[1].name, 'Layla');
  assert.equal(summary.participants[1].subtotal, 150);
  assert.equal(summary.participants[1].vat, 22.5);
  assert.equal(summary.participants[1].total, 172.5);

  // Check Participant 3
  assert.equal(summary.participants[2].name, 'Noura');
  assert.equal(summary.participants[2].subtotal, 100);
  assert.equal(summary.participants[2].vat, 15);
  assert.equal(summary.participants[2].total, 115);

  // Check Consolidated Group Totals
  // Subtotal = 200 + 150 + 100 = 450
  assert.equal(summary.consolidatedSubtotal, 450);
  // VAT = 450 * 0.15 = 67.5
  assert.equal(summary.consolidatedVat, 67.5);
  // Total = 450 + 67.5 = 517.5
  assert.equal(summary.consolidatedTotal, 517.5);
});

test('Group Draft Lifecycle: Detects group mode, group name, and multiple participants as dirty', () => {
  // Pristine draft
  assert.equal(checkIsAppointmentDraftDirty({}), false);

  // Group mode set
  assert.equal(checkIsAppointmentDraftDirty({ bookingScope: 'group' }), true);

  // Group name filled
  assert.equal(checkIsAppointmentDraftDirty({ groupName: 'Bridal Party' }), true);

  // Multiple participants added
  assert.equal(checkIsAppointmentDraftDirty({ groupParticipantsCount: 3 }), true);
});

test('Regression (P1 Group Booking Crash): calculateGroupStagedPricing guarantees participantBreakdowns.map executes without throwing', () => {
  // Test 1: Empty initial state fallback (should safely produce at least 1 default participant breakdown)
  const emptySummary = calculateGroupStagedPricing([], [], []);
  assert.ok(Array.isArray(emptySummary.participantBreakdowns), 'participantBreakdowns must be an array');
  assert.ok(Array.isArray(emptySummary.participants), 'participants must be an array');
  assert.equal(emptySummary.participantBreakdowns.length, 1);
  assert.equal(typeof emptySummary.subtotal, 'number');
  assert.equal(typeof emptySummary.vat, 'number');
  assert.equal(typeof emptySummary.total, 'number');

  // Exact expression from InteractiveDrawers.tsx line 4658 must execute cleanly:
  const renderedEmpty = emptySummary.participantBreakdowns.map(p => ({
    name: p.participantName || p.name,
    count: p.itemsCount ?? p.serviceCount,
    total: p.total
  }));
  assert.equal(renderedEmpty.length, 1);
  assert.equal(renderedEmpty[0].count, 0);

  // Test 2: Registered customer as Organizer on initial group mode switch
  const registeredOrganizer: GroupParticipantInfo = {
    id: 'cust-101',
    name: 'Fatima Al-Zahrani',
    phone: '+966501234567',
    isOrganizer: true
  };
  const regSummary = calculateGroupStagedPricing([registeredOrganizer], [], []);
  assert.ok(regSummary.participantBreakdowns);
  assert.equal(regSummary.participantBreakdowns[0].name, 'Fatima Al-Zahrani');
  assert.equal(regSummary.participantBreakdowns[0].participantName, 'Fatima Al-Zahrani');
  assert.equal(regSummary.participantBreakdowns[0].isOrganizer, true);
  assert.equal(regSummary.subtotal, 0);
  assert.equal(regSummary.vat, 0);
  assert.equal(regSummary.total, 0);

  // Test 3: Walk-in guest as Organizer on initial group mode switch
  const walkinOrganizer: GroupParticipantInfo = {
    id: 'walkin-default',
    name: 'Walk-in Guest',
    isOrganizer: true
  };
  const walkinSummary = calculateGroupStagedPricing([walkinOrganizer], [], []);
  assert.ok(walkinSummary.participantBreakdowns);
  assert.equal(walkinSummary.participantBreakdowns[0].participantName, 'Walk-in Guest');
});

test('Regression: Group participant transitions maintain valid participantBreakdowns across add, remove, and switch', () => {
  let participants: GroupParticipantInfo[] = [
    { id: 'part-1', name: 'Organizer Sara', isOrganizer: true }
  ];

  // Initial group mode render
  let summary = calculateGroupStagedPricing(participants, [], []);
  assert.equal(summary.participantBreakdowns.length, 1);
  assert.equal(summary.participantBreakdowns[0].participantName, 'Organizer Sara');

  // Add Participant 2 (Walk-in friend)
  participants = [
    ...participants,
    { id: 'part-2', name: 'Guest 2', isOrganizer: false }
  ];
  summary = calculateGroupStagedPricing(participants, [], []);
  assert.equal(summary.participantBreakdowns.length, 2);
  assert.equal(summary.participantBreakdowns[1].participantName, 'Guest 2');
  assert.equal(summary.participantBreakdowns[1].isOrganizer, false);

  // Stage a service for Participant 2
  const stagedServices: MinimalStagedItem[] = [
    {
      id: 'stg-p2-1',
      serviceId: SERVICE_FACIAL,
      itemType: 'service',
      duration: 45,
      basePrice: 150,
      finalPrice: 150,
      participantId: 'part-2'
    }
  ];

  summary = calculateGroupStagedPricing(participants, stagedServices, []);
  assert.equal(summary.participantBreakdowns[0].itemsCount, 0);
  assert.equal(summary.participantBreakdowns[0].total, 0);
  assert.equal(summary.participantBreakdowns[1].itemsCount, 1);
  assert.equal(summary.participantBreakdowns[1].subtotal, 150);
  assert.equal(summary.participantBreakdowns[1].vat, 22.5);
  assert.equal(summary.participantBreakdowns[1].total, 172.5);
  assert.equal(summary.subtotal, 150);
  assert.equal(summary.vat, 22.5);
  assert.equal(summary.total, 172.5);

  // Participant 1 switching/updating name does not corrupt Participant 2
  participants = participants.map((p, idx) => idx === 0 ? { ...p, name: 'Sara Al-Otaibi' } : p);
  summary = calculateGroupStagedPricing(participants, stagedServices, []);
  assert.equal(summary.participantBreakdowns[0].name, 'Sara Al-Otaibi');
  assert.equal(summary.participantBreakdowns[1].name, 'Guest 2');
  assert.equal(summary.total, 172.5);
});

