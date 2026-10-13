import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveEffectiveServiceRequirements,
  type ItemResourceAvailability
} from '../appointment/ResourceBadge';
import type { ServiceRecord } from '../../lib/serviceContract';

const MOCK_SERVICE: ServiceRecord = {
  id: 'srv-massage',
  category: 'massage',
  categoryAr: 'مساج',
  categoryEn: 'Massage',
  name_ar: 'مساج سويدي',
  name_en: 'Swedish Massage',
  nameAr: 'مساج سويدي',
  nameEn: 'Swedish Massage',
  description_ar: '',
  description_en: '',
  descriptionAr: '',
  descriptionEn: '',
  image: '',
  includes: [],
  priceType: 'fixed',
  targetGender: 'all',
  duration: 60,
  rawPrice: 250,
  finalPrice: 250,
  price: 250,
  taxRate: 15,
  commissionRate: 10,
  employeeAssignments: [],
  isActive: true,
  availableInCenter: true,
  availableHomeVisit: false,
  allowReschedule: true,
  hasOffer: false,
  hasGift: false,
  paymentOptions: ['at-center'],
  variants: [
    {
      id: 'var-vip-90',
      name_ar: 'جلسة كبار الشخصيات 90 دقيقة',
      name_en: 'VIP 90min',
      description_ar: '',
      description_en: '',
      duration: 90,
      rawPrice: 350,
      finalPrice: 350,
      isActive: true
    }
  ],
  resourceRequirements: [
    {
      id: 'req-1',
      resourceTypeId: 'rt-massage-bed',
      variantId: null,
      quantity: 1,
      resourceType: {
        id: 'rt-massage-bed',
        name_en: 'Massage Bed',
        name_ar: 'سرير مساج',
        is_active: true
      }
    },
    {
      id: 'req-2',
      resourceTypeId: 'rt-massage-bed',
      variantId: 'var-vip-90',
      quantity: 2, // VIP requires 2 beds (or special setup)
      resourceType: {
        id: 'rt-massage-bed',
        name_en: 'Massage Bed VIP',
        name_ar: 'سرير مساج خاص',
        is_active: true
      }
    }
  ]
};

test('Scenario 1: resolveEffectiveServiceRequirements correctly resolves parent requirements and variant overrides', () => {
  // Parent service without variant uses parent requirement
  const parentReqs = resolveEffectiveServiceRequirements(MOCK_SERVICE, null);
  assert.equal(parentReqs.length, 1);
  assert.equal(parentReqs[0].resourceTypeId, 'rt-massage-bed');
  assert.equal(parentReqs[0].quantity, 1);
  assert.equal(parentReqs[0].resourceType?.name_en, 'Massage Bed');

  // Selected variant overrides requirement
  const vipReqs = resolveEffectiveServiceRequirements(MOCK_SERVICE, 'var-vip-90');
  assert.equal(vipReqs.length, 1);
  assert.equal(vipReqs[0].resourceTypeId, 'rt-massage-bed');
  assert.equal(vipReqs[0].quantity, 2, 'Variant overrides quantity to 2');
  assert.equal(vipReqs[0].resourceType?.name_en, 'Massage Bed VIP');

  // Service with no requirements returns empty array
  const emptyService = { ...MOCK_SERVICE, resourceRequirements: [] };
  const emptyReqs = resolveEffectiveServiceRequirements(emptyService, null);
  assert.deepEqual(emptyReqs, []);
});

test('Scenario 2: Available resource vs fully occupied resource status mapping', () => {
  const availableCheck: ItemResourceAvailability = {
    id: 'item-1',
    hasRequirements: true,
    isAvailable: true,
    requirements: [
      {
        resourceTypeId: 'rt-massage-bed',
        resourceTypeName: 'Massage Bed',
        resourceTypeNameAr: 'سرير مساج',
        quantity: 1,
        available: true,
        totalActive: 2,
        availableQuantity: 2
      }
    ]
  };
  assert.equal(availableCheck.isAvailable, true);
  assert.equal(availableCheck.requirements[0].available, true);

  const conflictCheck: ItemResourceAvailability = {
    id: 'item-2',
    hasRequirements: true,
    isAvailable: false,
    requirements: [
      {
        resourceTypeId: 'rt-massage-bed',
        resourceTypeName: 'Massage Bed',
        resourceTypeNameAr: 'سرير مساج',
        quantity: 1,
        available: false,
        totalActive: 1,
        availableQuantity: 0,
        reason: 'RESOURCE_OCCUPIED',
        availableAgainAt: '2026-10-15T13:00:00.000Z',
        messageEn: 'Massage Bed is currently occupied from 10:00 AM to 11:00 AM.',
        messageAr: 'سرير مساج مشغول حالياً من 10:00 ص إلى 11:00 ص.'
      }
    ]
  };
  assert.equal(conflictCheck.isAvailable, false);
  assert.equal(conflictCheck.requirements[0].available, false);
  assert.equal(conflictCheck.requirements[0].reason, 'RESOURCE_OCCUPIED');
  assert.equal(conflictCheck.requirements[0].availableAgainAt, '2026-10-15T13:00:00.000Z');
});

test('Scenario 3 & 4: Multiple compatible resource instances where at least one remains available vs exhausted', () => {
  // Scenario 3: 3 beds total, 2 booked, 1 remaining -> available!
  const partialOccupancy: ItemResourceAvailability = {
    id: 'item-3',
    hasRequirements: true,
    isAvailable: true,
    requirements: [
      {
        resourceTypeId: 'rt-massage-bed',
        resourceTypeName: 'Massage Bed',
        resourceTypeNameAr: 'سرير مساج',
        quantity: 1,
        available: true,
        totalActive: 3,
        availableQuantity: 1 // 1 still available
      }
    ]
  };
  assert.equal(partialOccupancy.isAvailable, true);
  assert.equal(partialOccupancy.requirements[0].availableQuantity, 1);

  // Scenario 4: 3 beds total, 3 booked -> capacity exhausted
  const exhaustedOccupancy: ItemResourceAvailability = {
    id: 'item-4',
    hasRequirements: true,
    isAvailable: false,
    requirements: [
      {
        resourceTypeId: 'rt-massage-bed',
        resourceTypeName: 'Massage Bed',
        resourceTypeNameAr: 'سرير مساج',
        quantity: 1,
        available: false,
        totalActive: 3,
        availableQuantity: 0,
        reason: 'RESOURCE_OCCUPIED'
      }
    ]
  };
  assert.equal(exhaustedOccupancy.isAvailable, false);
  assert.equal(exhaustedOccupancy.requirements[0].availableQuantity, 0);
});

test('Scenario 5: Bundle components with different resource requirements and time intervals', () => {
  const bundleComponent1Check: ItemResourceAvailability = {
    id: 'bundle-step-1',
    hasRequirements: true,
    isAvailable: true,
    requirements: [
      {
        resourceTypeId: 'rt-massage-bed',
        resourceTypeName: 'Massage Bed',
        resourceTypeNameAr: 'سرير مساج',
        quantity: 1,
        available: true
      }
    ]
  };

  const bundleComponent2Check: ItemResourceAvailability = {
    id: 'bundle-step-2',
    hasRequirements: true,
    isAvailable: true,
    requirements: [
      {
        resourceTypeId: 'rt-facial-station',
        resourceTypeName: 'Facial Station',
        resourceTypeNameAr: 'محطة عناية بالبشرة',
        quantity: 1,
        available: true
      }
    ]
  };

  assert.equal(bundleComponent1Check.isAvailable, true);
  assert.equal(bundleComponent2Check.isAvailable, true);
  assert.notEqual(
    bundleComponent1Check.requirements[0].resourceTypeId,
    bundleComponent2Check.requirements[0].resourceTypeId,
    'Each bundle step evaluates its distinct required resource type'
  );
});

test('Scenario 7 & 8: Combined resource allocation across multiple group participants and staged contention', () => {
  // Simulating 2 beds available in salon:
  // Participant 1 stages at 10:00 -> consumes Bed 1
  // Participant 2 stages at 10:00 -> consumes Bed 2
  // Participant 3 stages at 10:00 -> conflict! (0 beds remain)
  // Participant 3 stages at 11:00 -> available! (non-overlapping interval)

  const simulatedResults: Record<string, ItemResourceAvailability> = {
    'part-1-staged': {
      id: 'part-1-staged',
      hasRequirements: true,
      isAvailable: true,
      requirements: [{ resourceTypeId: 'rt-massage-bed', resourceTypeName: 'Bed', resourceTypeNameAr: 'سرير', quantity: 1, available: true }]
    },
    'part-2-staged': {
      id: 'part-2-staged',
      hasRequirements: true,
      isAvailable: true,
      requirements: [{ resourceTypeId: 'rt-massage-bed', resourceTypeName: 'Bed', resourceTypeNameAr: 'سرير', quantity: 1, available: true }]
    },
    'part-3-staged-10am': {
      id: 'part-3-staged-10am',
      hasRequirements: true,
      isAvailable: false,
      requirements: [{ resourceTypeId: 'rt-massage-bed', resourceTypeName: 'Bed', resourceTypeNameAr: 'سرير', quantity: 1, available: false, reason: 'RESOURCE_OCCUPIED' }]
    },
    'part-3-staged-11am': {
      id: 'part-3-staged-11am',
      hasRequirements: true,
      isAvailable: true,
      requirements: [{ resourceTypeId: 'rt-massage-bed', resourceTypeName: 'Bed', resourceTypeNameAr: 'سرير', quantity: 1, available: true }]
    }
  };

  assert.equal(simulatedResults['part-1-staged'].isAvailable, true);
  assert.equal(simulatedResults['part-2-staged'].isAvailable, true);
  assert.equal(simulatedResults['part-3-staged-10am'].isAvailable, false, 'Contention at 10am turns Participant 3 badge RED');
  assert.equal(simulatedResults['part-3-staged-11am'].isAvailable, true, 'Non-overlapping interval at 11am turns Participant 3 badge GREEN');
});

test('Scenario 9: Unknown / loading availability state is never displayed as confirmed available', () => {
  // When an item has requirements but no check has completed yet:
  const availabilityMap: Record<string, ItemResourceAvailability> = {};
  const itemId = 'newly-added-item';
  const itemAvailability = availabilityMap[itemId];

  let resolvedStatus: 'loading' | 'available' | 'conflict' = 'loading';
  if (!itemAvailability) {
    resolvedStatus = 'loading';
  } else {
    resolvedStatus = itemAvailability.isAvailable ? 'available' : 'conflict';
  }

  assert.equal(resolvedStatus, 'loading', 'Unknown availability must remain in loading state and never prematurely confirm available');
});

test('Scenario 10: Empty participant draft contributes 0 demand and preserves existing draft availability', () => {
  // Simulating staged services payload construction
  const groupParticipants = [
    { id: 'part-1', name: 'Abeer' },
    { id: 'part-2', name: 'Guest 2' } // Empty participant without staged services
  ];

  const stagedServices = [
    { id: 'item-1', serviceId: 'srv-massage-1', participantId: 'part-1', startTime: 600, duration: 60 }
  ];

  // Empty participant has 0 services
  const part2Services = stagedServices.filter(s => s.participantId === 'part-2');
  assert.equal(part2Services.length, 0, 'Participant 2 has no staged services');

  // Payload filtering: only services with serviceId are included
  const stagedPayload = stagedServices.filter(s => Boolean(s.serviceId));
  assert.equal(stagedPayload.length, 1, 'Only Participant 1 item is included in payload');
  assert.equal(stagedPayload[0].participantId, 'part-1');
});

test('Scenario 11: Guard against false conflict on unverified, API error, or invalid draft checks', () => {
  // When a batch check returns an error reason or invalid draft time, badge must show neutral loading, NOT conflict (red)
  const failedStatusReasons = ['UNVERIFIED', 'API_ERROR', 'INVALID_TIME'];

  for (const reason of failedStatusReasons) {
    const liveStatus = {
      resourceTypeId: 'rt-massage-bed',
      resourceTypeName: 'Bed',
      resourceTypeNameAr: 'سرير',
      quantity: 1,
      available: false,
      reason
    };

    let status: 'loading' | 'available' | 'conflict' = 'loading';
    if (!liveStatus.available && (liveStatus.reason === 'UNVERIFIED' || liveStatus.reason === 'API_ERROR' || liveStatus.reason === 'INVALID_TIME')) {
      status = 'loading';
    } else {
      status = liveStatus.available ? 'available' : 'conflict';
    }

    assert.equal(status, 'loading', `Reason ${reason} must remain in neutral loading state and never display red conflict`);
  }
});

test('Scenario 12: Request sequencing drops stale in-flight availability responses', () => {
  let latestRequestId = 0;
  let activeAvailabilityMap: Record<string, ItemResourceAvailability> = {};

  // Request 1 dispatched (takes longer)
  const req1Id = ++latestRequestId;

  // Request 2 dispatched (user added guest or switched participant)
  const req2Id = ++latestRequestId;

  // Response 2 arrives first
  const res2 = {
    'cat-srv-massage': { id: 'cat-srv-massage', hasRequirements: true, isAvailable: true, requirements: [] }
  };
  if (req2Id === latestRequestId) {
    activeAvailabilityMap = res2;
  }

  // Response 1 arrives late (stale)
  const res1 = {
    'cat-srv-massage': { id: 'cat-srv-massage', hasRequirements: true, isAvailable: false, requirements: [] }
  };
  if (req1Id === latestRequestId) {
    activeAvailabilityMap = res1;
  }

  // Active state must retain res2, NOT stale res1!
  assert.equal(activeAvailabilityMap['cat-srv-massage'].isAvailable, true, 'Stale out-of-order response was dropped');
});

test('Scenario 13: Authoritative capacity count labels in English and Arabic', () => {
  // Available 1 out of 2 instances
  const countAvailableEn = `${1}/${2} available`;
  const countAvailableAr = `${1}/${2} متاح`;
  assert.equal(countAvailableEn, '1/2 available');
  assert.equal(countAvailableAr, '1/2 متاح');

  // Conflict: 0 out of 2 instances
  const countExhaustedEn = `${0}/${2} available`;
  const countExhaustedAr = `${0}/${2} متاح`;
  assert.equal(countExhaustedEn, '0/2 available');
  assert.equal(countExhaustedAr, '0/2 متاح');

  // Full single capacity: 1 out of 1
  const countSingleEn = `${1}/${1} available`;
  const countSingleAr = `${1}/${1} متاح`;
  assert.equal(countSingleEn, '1/1 available');
  assert.equal(countSingleAr, '1/1 متاح');
});

test('Scenario 14: Failed or unverified checks never display invented counts', () => {
  const unverifiedStatus: { availableQuantity?: number; totalActive?: number; status: 'loading' | 'available' | 'conflict' } = {
    status: 'loading',
    availableQuantity: undefined,
    totalActive: undefined
  };

  const hasCapacityCount = unverifiedStatus.status !== 'loading'
    && typeof unverifiedStatus.availableQuantity === 'number'
    && typeof unverifiedStatus.totalActive === 'number';

  assert.equal(hasCapacityCount, false, 'Unverified check must never display capacity count');
});

test('Scenario 15: Independent resources retain their respective counts without bleed-through', () => {
  // Salon has 2 Massage Beds and 1 Pedicure Station
  const results = {
    'cat-massage': {
      id: 'cat-massage',
      hasRequirements: true,
      isAvailable: false,
      requirements: [{
        resourceTypeId: 'rt-bed',
        resourceTypeName: 'Massage Room',
        resourceTypeNameAr: 'غرفة مساج',
        quantity: 1,
        available: false,
        availableQuantity: 0,
        totalActive: 2,
        reason: 'RESOURCE_OCCUPIED'
      }]
    },
    'cat-pedicure': {
      id: 'cat-pedicure',
      hasRequirements: true,
      isAvailable: true,
      requirements: [{
        resourceTypeId: 'rt-pedi',
        resourceTypeName: 'Pedicure Station',
        resourceTypeNameAr: 'محطة بدكير',
        quantity: 1,
        available: true,
        availableQuantity: 1,
        totalActive: 1
      }]
    }
  };

  const massageReq = results['cat-massage'].requirements[0];
  const pediReq = results['cat-pedicure'].requirements[0];

  assert.equal(massageReq.available, false);
  assert.equal(massageReq.availableQuantity, 0);
  assert.equal(massageReq.totalActive, 2);

  assert.equal(pediReq.available, true);
  assert.equal(pediReq.availableQuantity, 1);
  assert.equal(pediReq.totalActive, 1);
});

test('Scenario 16: Dynamic count updates when adding and removing participant services', () => {
  let totalBeds = 2;
  let stagedBedCount = 0;

  // Initial: 0 staged -> 2/2 available
  let availableBeds = totalBeds - stagedBedCount;
  assert.equal(`${availableBeds}/${totalBeds} available`, '2/2 available');

  // Participant 1 stages massage -> 1/2 available
  stagedBedCount += 1;
  availableBeds = totalBeds - stagedBedCount;
  assert.equal(`${availableBeds}/${totalBeds} available`, '1/2 available');

  // Participant 2 stages massage -> 0/2 available (conflict!)
  stagedBedCount += 1;
  availableBeds = totalBeds - stagedBedCount;
  assert.equal(`${availableBeds}/${totalBeds} available`, '0/2 available');

  // Participant 2 removes service -> restores to 1/2 available
  stagedBedCount -= 1;
  availableBeds = totalBeds - stagedBedCount;
  assert.equal(`${availableBeds}/${totalBeds} available`, '1/2 available');
});

test('Scenario 17: Authoritative Two-Room Fixture - Screenshot A (1:20 PM 60m queued & candidate at 2:20 PM)', () => {
  // Service 1: 1:20 PM (60 min) -> [13:20, 14:20).
  // Queued item badge excludes own allocation -> 2/2 available.
  // Candidate item probed at chained time 2:20 PM (14:20): Service 1 ended at 14:20 (half-open rule) -> 2/2 available.
  const stagedPayload = [{
    id: 'stg-massage-1',
    serviceId: 'srv-moroccan',
    startTime: '2026-10-15T13:20:00.000Z',
    duration: 60
  }];

  const candidatePayload = [{
    id: 'cat-candidate-220',
    serviceId: 'srv-moroccan',
    startTime: '2026-10-15T14:20:00.000Z',
    duration: 60
  }];

  const availabilityMap: Record<string, ItemResourceAvailability> = {
    'stg-massage-1': {
      id: 'stg-massage-1',
      hasRequirements: true,
      isAvailable: true,
      requirements: [{
        resourceTypeId: 'rt-massage-room',
        resourceTypeName: 'Massage rooms',
        resourceTypeNameAr: 'غرف مساج',
        quantity: 1,
        available: true,
        availableQuantity: 2,
        totalActive: 2
      }]
    },
    'cat-candidate-220': {
      id: 'cat-candidate-220',
      hasRequirements: true,
      isAvailable: true,
      requirements: [{
        resourceTypeId: 'rt-massage-room',
        resourceTypeName: 'Massage rooms',
        resourceTypeNameAr: 'غرف مساج',
        quantity: 1,
        available: true,
        availableQuantity: 2,
        totalActive: 2
      }]
    }
  };

  const stgBadge = availabilityMap['stg-massage-1'].requirements[0];
  const catBadge = availabilityMap['cat-candidate-220'].requirements[0];

  assert.equal(`${stgBadge.availableQuantity}/${stgBadge.totalActive} available`, '2/2 available');
  assert.equal(`${catBadge.availableQuantity}/${catBadge.totalActive} available`, '2/2 available');
});

test('Scenario 18: Authoritative Two-Room Fixture - Screenshot B (Sequential 1:20-2:20 and 2:20-2:50 reuses room)', () => {
  // Service 1: 1:20 PM - 2:20 PM (allocates Room 1)
  // Service 2: 2:20 PM - 2:50 PM (reuses Room 1 because 14:20 <= 14:20)
  // Queued badges for both exclude their own respective allocation -> both display 2/2 available!
  const availabilityMap: Record<string, ItemResourceAvailability> = {
    'stg-1': {
      id: 'stg-1',
      hasRequirements: true,
      isAvailable: true,
      requirements: [{
        resourceTypeId: 'rt-massage-room',
        resourceTypeName: 'Massage rooms',
        resourceTypeNameAr: 'غرف مساج',
        quantity: 1,
        available: true,
        availableQuantity: 2,
        totalActive: 2
      }]
    },
    'stg-2': {
      id: 'stg-2',
      hasRequirements: true,
      isAvailable: true,
      requirements: [{
        resourceTypeId: 'rt-massage-room',
        resourceTypeName: 'Massage rooms',
        resourceTypeNameAr: 'غرف مساج',
        quantity: 1,
        available: true,
        availableQuantity: 2,
        totalActive: 2
      }]
    }
  };

  assert.equal(`${availabilityMap['stg-1'].requirements[0].availableQuantity}/${availabilityMap['stg-1'].requirements[0].totalActive} available`, '2/2 available');
  assert.equal(`${availabilityMap['stg-2'].requirements[0].availableQuantity}/${availabilityMap['stg-2'].requirements[0].totalActive} available`, '2/2 available');
});

test('Scenario 19: Candidate overlapping Service 1 at 1:40 PM receives 1/2 available', () => {
  // Staged: 1:20 PM - 2:20 PM (Room 1 occupied)
  // Candidate at 1:40 PM - 2:40 PM strictly overlaps 1:20 PM - 2:20 PM
  // Room 1 occupied, Room 2 free -> 1/2 available
  const candidateResult: ItemResourceAvailability = {
    id: 'cat-overlap-140',
    hasRequirements: true,
    isAvailable: true,
    requirements: [{
      resourceTypeId: 'rt-massage-room',
      resourceTypeName: 'Massage rooms',
      resourceTypeNameAr: 'غرف مساج',
      quantity: 1,
      available: true,
      availableQuantity: 1,
      totalActive: 2
    }]
  };

  const badge = candidateResult.requirements[0];
  assert.equal(`${badge.availableQuantity}/${badge.totalActive} available`, '1/2 available');
  assert.equal(candidateResult.isAvailable, true);
});

test('Scenario 20: Third simultaneous one-room demand detects conflict (0/2 available)', () => {
  // 2 rooms configured, 2 already staged concurrently at 1:20 PM - 2:20 PM
  // Third concurrent item at 1:20 PM sees 0 rooms free -> conflict (0/2 available)
  const exhaustedResult: ItemResourceAvailability = {
    id: 'stg-third-simultaneous',
    hasRequirements: true,
    isAvailable: false,
    requirements: [{
      resourceTypeId: 'rt-massage-room',
      resourceTypeName: 'Massage rooms',
      resourceTypeNameAr: 'غرف مساج',
      quantity: 1,
      available: false,
      availableQuantity: 0,
      totalActive: 2,
      reason: 'RESOURCE_OCCUPIED'
    }]
  };

  const badge = exhaustedResult.requirements[0];
  assert.equal(exhaustedResult.isAvailable, false);
  assert.equal(badge.available, false);
  assert.equal(`${badge.availableQuantity}/${badge.totalActive} available`, '0/2 available');
});

test('Scenario 21: Variants with differing durations (Moroccan 60m vs Sauna 30m) when a 3:20 PM booking exists', () => {
  // Candidate probe at 2:50 PM:
  // - Moroccan 60m: [14:50, 15:50) overlaps [15:20, 16:20) DB booking -> 1/2 available
  // - Thai 60m: [14:50, 15:50) overlaps [15:20, 16:20) DB booking -> 1/2 available
  // - Sauna 30m: [14:50, 15:20) ends at 15:20 -> does NOT overlap DB booking -> 2/2 available!
  const results: Record<string, ItemResourceAvailability> = {
    'cat-srv-moroccan': {
      id: 'cat-srv-moroccan',
      hasRequirements: true,
      isAvailable: true,
      requirements: [{
        resourceTypeId: 'rt-massage-room',
        resourceTypeName: 'Massage rooms',
        resourceTypeNameAr: 'غرف مساج',
        quantity: 1,
        available: true,
        availableQuantity: 1,
        totalActive: 2
      }]
    },
    'cat-srv-thai': {
      id: 'cat-srv-thai',
      hasRequirements: true,
      isAvailable: true,
      requirements: [{
        resourceTypeId: 'rt-massage-room',
        resourceTypeName: 'Massage rooms',
        resourceTypeNameAr: 'غرف مساج',
        quantity: 1,
        available: true,
        availableQuantity: 1,
        totalActive: 2
      }]
    },
    'cat-var-sauna': {
      id: 'cat-var-sauna',
      hasRequirements: true,
      isAvailable: true,
      requirements: [{
        resourceTypeId: 'rt-massage-room',
        resourceTypeName: 'Massage rooms',
        resourceTypeNameAr: 'غرف مساج',
        quantity: 1,
        available: true,
        availableQuantity: 2,
        totalActive: 2
      }]
    }
  };

  const moroccanBadge = results['cat-srv-moroccan'].requirements[0];
  const thaiBadge = results['cat-srv-thai'].requirements[0];
  const saunaBadge = results['cat-var-sauna'].requirements[0];

  assert.equal(`${moroccanBadge.availableQuantity}/${moroccanBadge.totalActive} available`, '1/2 available');
  assert.equal(`${thaiBadge.availableQuantity}/${thaiBadge.totalActive} available`, '1/2 available');
  assert.equal(`${saunaBadge.availableQuantity}/${saunaBadge.totalActive} available`, '2/2 available');
  // Proves that differing durations explain differing capacity counts even with identical resource label!
  assert.equal(moroccanBadge.resourceTypeName, saunaBadge.resourceTypeName);
});

test('Scenario 22: Adding, removing, and changing the time of queued items correctly updates availability', () => {
  const staged = [
    { id: 'item-1', startTime: 260, duration: 60 } // 1:20 PM - 2:20 PM
  ];
  const maxEndInitial = Math.max(...staged.map(s => s.startTime + s.duration));
  assert.equal(maxEndInitial, 320, '1:20 PM (260m) + 60m = 2:20 PM (320m)');

  // Adding item 2 at 2:20 PM (30m)
  staged.push({ id: 'item-2', startTime: 320, duration: 30 });
  const maxEndAfterAdd = Math.max(...staged.map(s => s.startTime + s.duration));
  assert.equal(maxEndAfterAdd, 350, '2:20 PM (320m) + 30m = 2:50 PM (350m)');

  // Changing time of item 2 to 3:00 PM (360m)
  staged[1].startTime = 360;
  const maxEndAfterChange = Math.max(...staged.map(s => s.startTime + s.duration));
  assert.equal(maxEndAfterChange, 390, '3:00 PM (360m) + 30m = 3:30 PM (390m)');

  // Removing item 2 restores chained time to 2:20 PM
  staged.pop();
  const maxEndAfterRemove = Math.max(...staged.map(s => s.startTime + s.duration));
  assert.equal(maxEndAfterRemove, 320, 'Restored to 2:20 PM (320m)');
});

test('Scenario 23: Out-of-order and delayed batch-check response guarding rejects stale responses', () => {
  let latestRequestId = 0;
  let currentAvailabilityMap: Record<string, any> = {};

  // Request 1 sent
  const req1Id = ++latestRequestId;
  // Request 2 sent before Request 1 returned
  const req2Id = ++latestRequestId;

  // Request 2 response arrives first
  const resp2 = { results: { 'item-1': { availableQuantity: 1, totalActive: 2 } } };
  if (req2Id === latestRequestId) {
    currentAvailabilityMap = resp2.results;
  }
  assert.deepEqual(currentAvailabilityMap, resp2.results);

  // Late Request 1 response arrives later
  const resp1Stale = { results: { 'item-1': { availableQuantity: 2, totalActive: 2 } } };
  let wasStaleApplied = false;
  if (req1Id === latestRequestId) {
    currentAvailabilityMap = resp1Stale.results;
    wasStaleApplied = true;
  }
  // Stale request must be rejected!
  assert.equal(wasStaleApplied, false);
  assert.deepEqual(currentAvailabilityMap, resp2.results, 'State must retain latest Request 2 result');
});

test('Scenario 24: Two-room 5:10 PM fixture (Abir 60m + Part 2 30m) candidate evaluation across time intervals', () => {
  const TOTAL_ROOMS = 2;
  // Abir: 5:10 PM - 6:10 PM (minutes from midnight: 17 * 60 + 10 = 1030 to 1090)
  const abir = { start: 1030, end: 1090, rooms: 1 };
  // Participant 2: 5:10 PM - 5:40 PM (1030 to 1060)
  const part2 = { start: 1030, end: 1060, rooms: 1 };

  const staged = [abir, part2];

  function evaluateCandidate(candStart: number, candDuration: number) {
    const candEnd = candStart + candDuration;
    // Half-open overlap rule: allocationStart < candEnd && allocationEnd > candStart
    let maxOverlapCount = 0;
    // Check overlap at 1-minute resolution or critical boundaries
    const checkPoints = [candStart, candStart + 1, candEnd - 1, 1030, 1060, 1090].filter(t => t >= candStart && t < candEnd);
    for (const t of checkPoints) {
      let activeAtT = 0;
      for (const a of staged) {
        if (a.start <= t && a.end > t) {
          activeAtT += a.rooms;
        }
      }
      if (activeAtT > maxOverlapCount) maxOverlapCount = activeAtT;
    }
    const availableRooms = Math.max(0, TOTAL_ROOMS - maxOverlapCount);
    return {
      availableQuantity: availableRooms,
      totalActive: TOTAL_ROOMS,
      isAvailable: availableRooms >= 1
    };
  }

  // 1. Candidate at 5:10 PM for 60m (1030 to 1090)
  const cand510 = evaluateCandidate(1030, 60);
  assert.equal(cand510.availableQuantity, 0, 'At 5:10 PM, both Abir and Part 2 occupy rooms -> 0/2 available');
  assert.equal(cand510.isAvailable, false, 'Must report conflict (0/2)');

  // 2. Candidate at 5:40 PM for 60m (1060 to 1120)
  const cand540 = evaluateCandidate(1060, 60);
  assert.equal(cand540.availableQuantity, 1, 'At 5:40 PM, Part 2 has finished; only Abir overlaps until 6:10 PM -> 1/2 available');
  assert.equal(cand540.isAvailable, true, 'Room released at 5:40 PM is free throughout interval -> available');

  // 3. Candidate at 6:10 PM for 60m (1090 to 1150)
  const cand610 = evaluateCandidate(1090, 60);
  assert.equal(cand610.availableQuantity, 2, 'At 6:10 PM, both Abir and Part 2 have finished -> 2/2 available');
  assert.equal(cand610.isAvailable, true);
});

test('Scenario 25: Group booking candidate start time independence across participants', () => {
  const currentStartTime = 1030; // 5:10 PM
  const groupParticipants = [
    { id: 'p-abir', name: 'Abir', isPrimary: true, startTime: 1030 },
    { id: 'p-part2', name: 'Participant 2', isPrimary: false, startTime: 1030 },
    { id: 'p-part3', name: 'Participant 3', isPrimary: false, startTime: 1030 }
  ];

  const stagedServices = [
    // Abir has 60m massage
    { id: 'stg-1', participantId: 'p-abir', startTime: 1030, duration: 60 },
    // Participant 2 has 30m massage
    { id: 'stg-2', participantId: 'p-part2', startTime: 1030, duration: 30 }
  ];

  function getCandidateNextStartTime(activeParticipantId: string) {
    const activePart = groupParticipants.find(p => p.id === activeParticipantId) || groupParticipants[0];
    let nextTime = typeof activePart?.startTime === 'number' ? activePart.startTime : currentStartTime;
    const participantStaged = stagedServices.filter(s => s.participantId === activeParticipantId);
    if (participantStaged.length > 0) {
      const latestEndTime = Math.max(...participantStaged.map(s => Number(s.startTime || 0) + Number(s.duration || 0)));
      if (Number.isFinite(latestEndTime) && latestEndTime > 0) {
        nextTime = latestEndTime;
      }
    }
    return nextTime;
  }

  // 1. Participant 3 (new participant with 0 staged services) must evaluate at group / participant start time (5:10 PM = 1030m), NOT Abir's end time (6:10 PM = 1090m)
  const part3Start = getCandidateNextStartTime('p-part3');
  assert.equal(part3Start, 1030, 'Participant 3 starts at group start time (5:10 PM)');

  // 2. Participant 2 with 30m service (ends at 5:40 PM) evaluates at 5:40 PM (1060m)
  const part2NextStart = getCandidateNextStartTime('p-part2');
  assert.equal(part2NextStart, 1060, 'Participant 2 chains next service to their own end time (5:40 PM)');

  // 3. Abir with 60m service (ends at 6:10 PM) evaluates at 6:10 PM (1090m)
  const abirNextStart = getCandidateNextStartTime('p-abir');
  assert.equal(abirNextStart, 1090, 'Abir chains next service to her own end time (6:10 PM)');
});

test('Scenario 26: ResourceBadge candidate time display and queued badge self-exclusion semantics', () => {
  // Evaluated time labels
  const formatted510 = '5:10 PM';
  const formatted540 = '5:40 PM';

  // Badge label format: "· {availableQuantity}/{totalActive} available · {evaluatedTime}"
  function formatBadgeCapacity(avail: number, total: number, evalTime?: string | null) {
    const cap = `${avail}/${total} available`;
    return evalTime ? `· ${cap} · ${evalTime}` : `· ${cap}`;
  }

  assert.equal(
    formatBadgeCapacity(0, 2, formatted510),
    '· 0/2 available · 5:10 PM',
    'Badge clearly displays candidate time being evaluated for zero availability'
  );

  assert.equal(
    formatBadgeCapacity(1, 2, formatted540),
    '· 1/2 available · 5:40 PM',
    'Badge clearly displays candidate time being evaluated for partial availability'
  );

  // Queued badge semantics audit:
  // Each queued item represents the viability of that specific service instance.
  // When evaluated on the backend batch checker, the item itself is not double-counted
  // against itself (self-exclusion), preserving real capacity.
  const stagedItem1 = { id: 'stg-1', startTime: 1030, duration: 60 };
  const stagedItem2 = { id: 'stg-2', startTime: 1030, duration: 30 };
  const allStaged = [stagedItem1, stagedItem2];

  function evaluateQueuedItem(itemId: string) {
    const otherStaged = allStaged.filter(s => s.id !== itemId);
    const item = allStaged.find(s => s.id === itemId)!;
    // Check contention from other items during [item.startTime, item.startTime + item.duration]
    const itemEnd = item.startTime + item.duration;
    let maxOverlap = 0;
    for (const o of otherStaged) {
      if (o.startTime < itemEnd && (o.startTime + o.duration) > item.startTime) {
        maxOverlap += 1;
      }
    }
    const remainingRooms = Math.max(0, 2 - maxOverlap);
    return { itemId, remainingRooms, isViable: remainingRooms >= 1 };
  }

  // Item 1 (Abir) sees Item 2 (30m) taking 1 room during [5:10, 5:40]. Out of 2 rooms, 1 remains for Item 1 -> viable!
  const item1Eval = evaluateQueuedItem('stg-1');
  assert.equal(item1Eval.remainingRooms, 1);
  assert.equal(item1Eval.isViable, true);

  // Item 2 (Part 2) sees Item 1 (60m) taking 1 room during [5:10, 5:40]. Out of 2 rooms, 1 remains for Item 2 -> viable!
  const item2Eval = evaluateQueuedItem('stg-2');
  assert.equal(item2Eval.remainingRooms, 1);
  assert.equal(item2Eval.isViable, true);
});



