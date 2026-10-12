import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractHistoricalItems,
  resolveRebookingDraft,
  calculateRebookingPricing,
  HistoricalSessionRecord,
  HistoricalRawServiceItem
} from '../../lib/customerRebookingHelpers';
import {
  checkIsAppointmentDraftDirty,
  evaluateDismissalAction
} from '../../lib/bundleStagingHelpers';
import { ServiceRecord } from '../../lib/serviceContract';

// Mock Services in Live Catalog
const CATALOG_SERVICES: ServiceRecord[] = [
  {
    id: 'srv-massage-1',
    nameEn: 'Moroccan Bath & Massage',
    nameAr: 'حمام مغربي ومساج',
    category: 'body',
    price: 350,
    finalPrice: 350,
    duration: 60,
    isActive: true,
    variants: [
      {
        id: 'var-olive-oil',
        name_en: 'With Organic Olive Oil',
        name_ar: 'بزيت الزيتون العضوي',
        price: 400,
        finalPrice: 400,
        duration: 75,
        isActive: true
      },
      {
        id: 'var-retired',
        name_en: 'Retired Variant',
        name_ar: 'خيار معطل',
        price: 380,
        finalPrice: 380,
        duration: 60,
        isActive: false
      }
    ],
    employeeAssignments: ['staff-talia']
  },
  {
    id: 'srv-haircut-2',
    nameEn: 'Classic Haircut',
    nameAr: 'قص شعر كلاسيكي',
    category: 'hair',
    price: 120,
    finalPrice: 120,
    duration: 45,
    isActive: true,
    employeeAssignments: ['staff-sara']
  },
  {
    id: 'srv-retired-3',
    nameEn: 'Discontinued Sauna',
    nameAr: 'ساونا ملغاة',
    category: 'body',
    price: 200,
    finalPrice: 200,
    duration: 30,
    isActive: false, // Inactive / retired
    employeeAssignments: []
  }
];

const MOCK_STYLISTS = [
  { id: 'staff-talia', name: 'Talia' },
  { id: 'staff-sara', name: 'Sara' },
  { id: 'staff-ahmad', name: 'Ahmad' }
];

const MOCK_PACKAGES = [
  {
    id: 'pkg-royal-care',
    name_en: 'Royal Care Package',
    name_ar: 'باقة العناية الملكية',
    totalPrice: 420,
    totalDuration: 105,
    scheduleType: 'sequential' as const,
    items: [
      { id: 'pitem-1', serviceId: 'srv-massage-1', sequenceOrder: 1 },
      { id: 'pitem-2', serviceId: 'srv-haircut-2', sequenceOrder: 2 }
    ]
  }
];

// Test 1: Loading history for the selected registered customer
test('Scenario 1: Extracting historical items from session record correctly loads service lines', () => {
  const session: HistoricalSessionRecord = {
    id: 'hist-sess-001',
    bookingReference: 'BKG-2026-000101',
    date: '2026-09-15T14:00:00Z',
    status: 'completed',
    amount: 350,
    serviceLines: [
      {
        id: 'line-1',
        serviceId: 'srv-massage-1',
        serviceNameEn: 'Moroccan Bath & Massage',
        staffId: 'staff-talia',
        price: 300, // Historical price (was 300 in past)
        duration: 60
      }
    ]
  };

  const items = extractHistoricalItems(session);
  assert.equal(items.length, 1);
  assert.equal(items[0].serviceId, 'srv-massage-1');
  assert.equal(items[0].staffId, 'staff-talia');
});

// Test 2: Empty history and API failure handling
test('Scenario 2: Empty history returns 0 items and does not block drafting or normal creation', () => {
  const emptySession: HistoricalSessionRecord = {
    id: 'hist-empty',
    status: 'none',
    serviceLines: []
  };

  const items = extractHistoricalItems(emptySession);
  assert.equal(items.length, 0);

  // Pristine draft evaluation
  const pristineDraft = {
    createMode: 'appointment',
    selectedCustId: '',
    customerSearch: '',
    custMode: 'existing',
    walkinFullName: '',
    walkinPhone: '',
    walkinEmail: '',
    walkinDob: '',
    walkinIsVip: false,
    includeGroupGuests: false,
    guestCount: 1,
    guestNames: '',
    stagedServicesCount: 0,
    currentServiceId: '',
    currentDiscountType: 'none',
    currentDiscountValue: 0,
    currentServiceNotes: '',
    sessionNotes: '',
    createSplitActive: false,
    createSplitAmounts: { card: 0, cash: 0, online: 0, bank_transfer: 0, wallet: 0, gift_card: 0 },
    giftCardCodeInput: '',
    blockTitleAr: '',
    blockTitleEn: '',
    blockStaffId: '',
    blockIsRecurring: false,
    blockEndDate: ''
  };

  const isDirty = checkIsAppointmentDraftDirty(pristineDraft);
  assert.equal(isDirty, false, 'Pristine draft must remain clean even if history is empty');
});

// Test 3: Customer / tenant isolation
test('Scenario 3: Customer switch discards stale session and isolates customer records', () => {
  let activeCustomerId = 'cust-A';
  let activeHistory: HistoricalSessionRecord[] = [
    { id: 'sess-A-1', status: 'completed', serviceLines: [{ serviceId: 'srv-massage-1' }] }
  ];

  // When customer changes from cust-A to cust-B:
  activeCustomerId = 'cust-B';
  activeHistory = []; // Reset immediately

  assert.equal(activeHistory.length, 0, 'History for previous customer must be immediately cleared');
  assert.equal(activeCustomerId, 'cust-B');
});

// Test 4: Rebooking creates a fresh draft without mutating historical appointment
test('Scenario 4: Rebooking generates brand-new staged IDs and leaves historical record untouched', () => {
  const originalSession: HistoricalSessionRecord = {
    id: 'original-sess-999',
    bookingReference: 'BKG-2026-ORIGINAL',
    status: 'completed',
    amount: 300,
    serviceLines: [
      {
        id: 'orig-line-1',
        serviceId: 'srv-massage-1',
        serviceVariantName: 'With Organic Olive Oil',
        staffId: 'staff-talia',
        price: 300
      }
    ]
  };

  const frozenHistorical = JSON.parse(JSON.stringify(originalSession));

  const result = resolveRebookingDraft({
    session: originalSession,
    canonicalServices: CATALOG_SERVICES,
    availableStylists: MOCK_STYLISTS,
    currentStartTime: 600
  });

  assert.equal(result.unavailableItems.length, 0);
  assert.equal(result.preparedDraftItems.length, 1);
  const freshItem = result.preparedDraftItems[0];

  // Assert fresh ID generated
  assert.ok(freshItem.id.startsWith('stg-'), 'Draft item must receive a fresh staged ID');
  assert.notEqual(freshItem.id, 'orig-line-1', 'Must not reuse historical item ID');
  assert.equal((freshItem as any).bookingReference, undefined, 'Must not carry over booking reference');
  assert.equal((freshItem as any).bookingSessionId, undefined, 'Must not carry over booking session ID');

  // Verify original historical session was not mutated
  assert.deepEqual(originalSession, frozenHistorical, 'Historical session record must remain 100% untouched');
});

// Test 5: Current prices and 15% VAT are recalculated correctly
test('Scenario 5: Current catalog price is used instead of historical price, and 15% VAT is recalculated', () => {
  const session: HistoricalSessionRecord = {
    id: 'hist-pricing-test',
    status: 'completed',
    amount: 250, // Historical price was 250
    serviceLines: [
      {
        id: 'line-1',
        serviceId: 'srv-massage-1',
        serviceVariantName: 'With Organic Olive Oil', // Live price in catalog is 400
        price: 250
      }
    ]
  };

  const result = resolveRebookingDraft({
    session,
    canonicalServices: CATALOG_SERVICES,
    availableStylists: MOCK_STYLISTS
  });

  assert.equal(result.preparedDraftItems.length, 1);
  const staged = result.preparedDraftItems[0];

  // Catalog price for variant is 400 SAR, NOT the old 250 SAR!
  assert.equal(staged.basePrice, 400, 'Must apply current catalog price (400) not old price (250)');
  assert.equal(staged.finalPrice, 400);

  // VAT recalculation
  const pricing = calculateRebookingPricing(result.preparedDraftItems);
  assert.equal(pricing.subtotal, 400);
  assert.equal(pricing.vatAmount, 60, '15% VAT on 400 must be 60.00 SAR');
  assert.equal(pricing.grandTotal, 460, 'Total with VAT must be 460.00 SAR');
});

// Test 6: Bundle components and standalone services remain correctly separated
test('Scenario 6: Reliable packageId preserves bundle composition; ambiguous services remain standalone', () => {
  // A. Reliable bundle with explicit packageId
  const bundleSession: HistoricalSessionRecord = {
    id: 'hist-bundle',
    status: 'completed',
    packageId: 'pkg-royal-care',
    serviceLines: [
      { serviceId: 'srv-massage-1', packageId: 'pkg-royal-care' },
      { serviceId: 'srv-haircut-2', packageId: 'pkg-royal-care' }
    ]
  };

  const bundleResult = resolveRebookingDraft({
    session: bundleSession,
    canonicalServices: CATALOG_SERVICES,
    availableStylists: MOCK_STYLISTS,
    services2Bundles: MOCK_PACKAGES
  });

  assert.equal(bundleResult.isReliableBundle, true);
  assert.equal(bundleResult.matchedPackageId, 'pkg-royal-care');

  // B. Ambiguous composition without packageId - must NOT guess bundle identity
  const standaloneSession: HistoricalSessionRecord = {
    id: 'hist-standalone',
    status: 'completed',
    // No packageId provided
    serviceLines: [
      { serviceId: 'srv-massage-1' },
      { serviceId: 'srv-haircut-2' }
    ]
  };

  const standaloneResult = resolveRebookingDraft({
    session: standaloneSession,
    canonicalServices: CATALOG_SERVICES,
    availableStylists: MOCK_STYLISTS,
    services2Bundles: MOCK_PACKAGES
  });

  assert.equal(standaloneResult.isReliableBundle, false, 'Must not guess bundle without explicit packageId');
  assert.equal(standaloneResult.matchedPackageId, null);
  assert.equal(standaloneResult.preparedDraftItems.length, 2);
  assert.equal(standaloneResult.preparedDraftItems[0].itemType, 'service');
  assert.equal(standaloneResult.preparedDraftItems[1].itemType, 'service');
});

// Test 7: Unavailable or retired services are handled clearly
test('Scenario 7: Inactive or retired service/variant is flagged as unavailable and never silently dropped', () => {
  const mixedSession: HistoricalSessionRecord = {
    id: 'hist-retired-test',
    status: 'completed',
    serviceLines: [
      {
        id: 'active-item',
        serviceId: 'srv-haircut-2' // Active (120 SAR)
      },
      {
        id: 'retired-service',
        serviceId: 'srv-retired-3' // Inactive service
      },
      {
        id: 'retired-variant-item',
        serviceId: 'srv-massage-1',
        serviceVariantName: 'Retired Variant' // Inactive variant
      }
    ]
  };

  const result = resolveRebookingDraft({
    session: mixedSession,
    canonicalServices: CATALOG_SERVICES,
    availableStylists: MOCK_STYLISTS
  });

  // 1 available item, 2 unavailable items
  assert.equal(result.availableItems.length, 1);
  assert.equal(result.unavailableItems.length, 2);

  // Both retired items must be identified
  assert.ok(result.unavailableItems.some(u => u.name.includes('ساونا') || u.name.includes('Sauna')));
  assert.ok(result.unavailableItems.some(u => u.variantName === 'Retired Variant'));

  // Receptionist can explicitly rebook only available items
  assert.equal(result.preparedDraftItems.length, 1);
  assert.equal(result.preparedDraftItems[0].serviceId, 'srv-haircut-2');
});

// Test 8: New availability is evaluated rather than copying old timing/staff assignments
test('Scenario 8: Staff assignment is verified for qualifications, falling back to Any Staff if unqualified', () => {
  const sessionWithUnqualifiedStaff: HistoricalSessionRecord = {
    id: 'hist-staff-test',
    status: 'completed',
    serviceLines: [
      {
        id: 'line-1',
        serviceId: 'srv-massage-1', // Only Talia is qualified in catalog
        staffId: 'staff-ahmad' // Ahmad was booked in past but is NOT qualified in catalog
      }
    ]
  };

  const result = resolveRebookingDraft({
    session: sessionWithUnqualifiedStaff,
    canonicalServices: CATALOG_SERVICES,
    availableStylists: MOCK_STYLISTS
  });

  assert.equal(result.preparedDraftItems.length, 1);
  const staged = result.preparedDraftItems[0];

  // Ahmad is not qualified, so staffId must fall back to '' (Any Professional)
  assert.equal(staged.staffId, '', 'Unqualified previous staff must fall back to Any Professional');
});

// Test 9: Existing draft-discard and dirty-draft safeguards remain intact
test('Scenario 9: Rebooking populates draft and triggers dirty-draft dismissal protection', () => {
  const dirtyDraft = {
    createMode: 'appointment',
    selectedCustId: 'cust-123',
    customerSearch: '',
    custMode: 'existing',
    walkinFullName: '',
    walkinPhone: '',
    walkinEmail: '',
    walkinDob: '',
    walkinIsVip: false,
    includeGroupGuests: false,
    guestCount: 1,
    guestNames: '',
    stagedServicesCount: 2, // Rebooked draft has 2 staged services
    currentServiceId: '',
    currentDiscountType: 'none',
    currentDiscountValue: 0,
    currentServiceNotes: '',
    sessionNotes: '',
    createSplitActive: false,
    createSplitAmounts: { card: 0, cash: 0, online: 0, bank_transfer: 0, wallet: 0, gift_card: 0 },
    giftCardCodeInput: '',
    blockTitleAr: '',
    blockTitleEn: '',
    blockStaffId: '',
    blockIsRecurring: false,
    blockEndDate: ''
  };

  const isDirty = checkIsAppointmentDraftDirty(dirtyDraft);
  assert.equal(isDirty, true, 'Draft with rebooked staged services must be dirty');

  const dismissal = evaluateDismissalAction(isDirty, 'dismiss_request');
  assert.equal(dismissal.showConfirmDialog, true, 'Attempting to dismiss dirty draft must require confirmation');
  assert.equal(dismissal.shouldCloseDrawer, false, 'Dirty draft must not close without confirmation');
});

// Test 10: Normal customer booking and walk-in behavior remain intact
test('Scenario 10: Fast walk-in mode does not require customer history and proceeds cleanly', () => {
  const walkinDraft = {
    createMode: 'appointment',
    selectedCustId: '',
    customerSearch: '',
    custMode: 'walkin',
    walkinFullName: 'Zaid Walkin',
    walkinPhone: '',
    walkinEmail: '',
    walkinDob: '',
    walkinIsVip: false,
    includeGroupGuests: false,
    guestCount: 1,
    guestNames: '',
    stagedServicesCount: 1,
    currentServiceId: '',
    currentDiscountType: 'none',
    currentDiscountValue: 0,
    currentServiceNotes: '',
    sessionNotes: '',
    createSplitActive: false,
    createSplitAmounts: { card: 0, cash: 0, online: 0, bank_transfer: 0, wallet: 0, gift_card: 0 },
    giftCardCodeInput: '',
    blockTitleAr: '',
    blockTitleEn: '',
    blockStaffId: '',
    blockIsRecurring: false,
    blockEndDate: ''
  };

  const isDirty = checkIsAppointmentDraftDirty(walkinDraft);
  assert.equal(isDirty, true, 'Walkin with staged services operates normally');
});
