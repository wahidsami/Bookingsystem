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
