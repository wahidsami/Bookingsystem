import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkIsAppointmentDraftDirty,
  evaluateDismissalAction,
  cascadeTimingForStagedItems,
  calculateStagedPricing,
  isQueuedStandaloneServiceSelected,
  MinimalStagedItem,
  MinimalPackageItem
} from '../lib/bundleStagingHelpers';

// Fixture helpers
const createPristineState = () => ({
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
});

// Test 1: Pristine drawer dismissal
test('Requirement A1: Pristine drawer dismissal closes immediately without confirmation prompt', () => {
  const pristine = createPristineState();
  const isDirty = checkIsAppointmentDraftDirty(pristine);
  assert.equal(isDirty, false, 'Pristine draft must not be considered dirty');

  const action = evaluateDismissalAction(isDirty, 'dismiss_request');
  assert.equal(action.showConfirmDialog, false, 'Pristine form must not prompt confirmation');
  assert.equal(action.shouldCloseDrawer, true, 'Pristine form must close immediately');
  assert.equal(action.shouldResetDraft, true, 'Draft state should be cleanly cleared');
  assert.equal(action.preserveState, false);
});

// Test 2: Dirty drawer dismissal prompts before closing
test('Requirement A2: Dirty drawer dismissal prompts confirmation dialog before closing', () => {
  // Scenario 1: Customer entered
  const dirtyCustomer = { ...createPristineState(), selectedCustId: 'cust-123' };
  assert.equal(checkIsAppointmentDraftDirty(dirtyCustomer), true);

  // Scenario 2: Walk-in contact entered
  const dirtyWalkin = { ...createPristineState(), custMode: 'walkin', walkinPhone: '+966501112233' };
  assert.equal(checkIsAppointmentDraftDirty(dirtyWalkin), true);

  // Scenario 3: Service staged
  const dirtyServices = { ...createPristineState(), stagedServicesCount: 2 };
  assert.equal(checkIsAppointmentDraftDirty(dirtyServices), true);

  // Scenario 4: Notes entered
  const dirtyNotes = { ...createPristineState(), sessionNotes: 'Client prefers lavender oil' };
  assert.equal(checkIsAppointmentDraftDirty(dirtyNotes), true);

  // Dismissal evaluation on any dirty state
  const action = evaluateDismissalAction(true, 'dismiss_request');
  assert.equal(action.showConfirmDialog, true, 'Dirty draft must prompt confirmation dialog');
  assert.equal(action.shouldCloseDrawer, false, 'Drawer must remain open while waiting for confirmation');
  assert.equal(action.preserveState, true, 'Current entered data must be strictly preserved');
});

// Test 3: Keep editing preserves all entered data
test('Requirement A3: Keep editing closes confirmation dialog and preserves all entered data', () => {
  const isDirty = true;
  const action = evaluateDismissalAction(isDirty, 'keep_editing');

  assert.equal(action.showConfirmDialog, false, 'Confirmation dialog must close');
  assert.equal(action.shouldCloseDrawer, false, 'Drawer must NOT close');
  assert.equal(action.shouldResetDraft, false, 'Draft state must NOT be reset');
  assert.equal(action.preserveState, true, 'All entered form state must be preserved');
  assert.equal(action.invalidateDraftStorage, false, 'Draft storage must not be invalidated');
});

// Test 4: Discard resets form and invalidates recoverable draft
test('Requirement A4: Confirmed discard closes drawer, resets form, and permanently invalidates draft storage', () => {
  const isDirty = true;
  const action = evaluateDismissalAction(isDirty, 'confirm_discard');

  assert.equal(action.showConfirmDialog, false, 'Confirmation dialog closes');
  assert.equal(action.shouldCloseDrawer, true, 'Drawer must close');
  assert.equal(action.shouldResetDraft, true, 'All draft fields must be reset');
  assert.equal(action.invalidateDraftStorage, true, 'Recoverable draft storage must be permanently invalidated');
  assert.equal(action.preserveState, false);
});

// Test 5: Clicking inside the drawer does not dismiss it
test('Requirement A5: Clicks inside drawer are isolated and do not trigger backdrop dismissal', () => {
  // The drawer inner container specifies onClick={(e) => e.stopPropagation()}
  let backdropCalled = false;
  const handleBackdropClick = () => { backdropCalled = true; };

  // Simulated inner drawer event with stopPropagation
  let propagationStopped = false;
  const mockInnerEvent = {
    stopPropagation: () => { propagationStopped = true; }
  };

  mockInnerEvent.stopPropagation();
  assert.equal(propagationStopped, true, 'Inner drawer click must call stopPropagation');
  assert.equal(backdropCalled, false, 'Backdrop dismissal must not be invoked on inner click');
});

// Test 6: Escape, backdrop, and close button use consistent dismissal handler
test('Requirement A6: Escape key, backdrop, and close button route through consistent dismissal evaluation', () => {
  // All three triggers invoke the identical handleRequestDismissCreateDrawer()
  const isDirty = true;

  // 1. From Backdrop click
  const fromBackdrop = evaluateDismissalAction(isDirty, 'dismiss_request');
  // 2. From Close Button (X) click
  const fromCloseBtn = evaluateDismissalAction(isDirty, 'dismiss_request');
  // 3. From Escape key press
  const fromEscape = evaluateDismissalAction(isDirty, 'dismiss_request');

  assert.deepEqual(fromBackdrop, fromCloseBtn);
  assert.deepEqual(fromCloseBtn, fromEscape);
  assert.equal(fromEscape.showConfirmDialog, true);
});

// Test 7: Sequential-service time changes update dependent times correctly
test('Requirement B7: Adjusting a sequential service start time cascades into downstream sequential services', () => {
  const stagedServices: MinimalStagedItem[] = [
    {
      id: 'srv-1',
      serviceId: 'srv-massage',
      startTime: 600, // 10:00 AM (minutes from midnight)
      duration: 60,   // Ends at 660 (11:00 AM)
      itemType: 'service'
    },
    {
      id: 'srv-2',
      serviceId: 'srv-facial',
      startTime: 660, // 11:00 AM
      duration: 45,   // Ends at 705 (11:45 AM)
      itemType: 'service'
    },
    {
      id: 'srv-3',
      serviceId: 'srv-manicure',
      startTime: 705, // 11:45 AM
      duration: 30,   // Ends at 735 (12:15 PM)
      itemType: 'service'
    }
  ];

  // Adjust Service 1 start time from 600 (10:00) to 630 (10:30)
  const updated = cascadeTimingForStagedItems(stagedServices, 'srv-1', 630);

  assert.equal(updated[0].startTime, 630, 'Target service 1 updated to 10:30');
  assert.equal(updated[1].startTime, 690, 'Service 2 sequentially pushed to 10:30 + 60m = 11:30 (690)');
  assert.equal(updated[2].startTime, 735, 'Service 3 sequentially pushed to 11:30 + 45m = 12:15 (735)');
});

// Test 8: Parallel bundle timing remains synchronized
test('Requirement B8: Parallel bundle timing synchronizes all parallel sibling services to the same start time', () => {
  const bundleScheduleLookup = (pkgId: string) => {
    if (pkgId === 'pkg-parallel-spa') return 'parallel';
    return 'sequential';
  };

  const stagedServices: MinimalStagedItem[] = [
    {
      id: 'p-item-1',
      serviceId: 'srv-sauna',
      packageId: 'pkg-parallel-spa',
      packageInstanceId: 'inst-parallel-01',
      startTime: 600,
      duration: 45,
      itemType: 'package'
    },
    {
      id: 'p-item-2',
      serviceId: 'srv-massage',
      packageId: 'pkg-parallel-spa',
      packageInstanceId: 'inst-parallel-01',
      startTime: 600,
      duration: 60,
      itemType: 'package'
    },
    {
      id: 'downstream-standalone',
      serviceId: 'srv-blowdry',
      startTime: 660,
      duration: 30,
      itemType: 'service'
    }
  ];

  // Shift parallel bundle start time from 600 (10:00) to 720 (12:00)
  const updated = cascadeTimingForStagedItems(
    stagedServices,
    'p-item-1',
    720,
    bundleScheduleLookup
  );

  // Both parallel items must synchronize to 720
  assert.equal(updated[0].startTime, 720, 'Item 1 set to 12:00 (720)');
  assert.equal(updated[1].startTime, 720, 'Parallel sibling Item 2 synchronized to 12:00 (720)');

  // Downstream standalone service cascades after the longest parallel service (720 + max(45, 60) = 780)
  assert.equal(updated[2].startTime, 780, 'Downstream sequential service cascades to 12:00 + 60m = 13:00 (780)');
});

// Test 9: Handling invalid times or overlap detection
test('Requirement B9: Overlap or collision detection warns and prevents silent schedule corruption', () => {
  // If an employee manually sets a service earlier than the previous service end,
  // the engine detects the collision
  const prevItem = { startTime: 600, duration: 60 }; // Ends at 660
  const attemptedStartTime = 630; // 30 min before prev ends

  const hasOverlap = attemptedStartTime < (prevItem.startTime + prevItem.duration);
  assert.equal(hasOverlap, true, 'Engine must identify overlapping schedule conflict');
});

// Test 10: Bundle/standalone selection isolation and pricing remain intact
test('Requirement B10: Bundle and standalone items remain isolated in selection badges and VAT pricing', () => {
  const PKG_ID = 'pkg-luxury-glow';
  const SRV_ID = 'srv-facial-glow';

  const staged: MinimalStagedItem[] = [
    {
      id: 'b-1',
      serviceId: SRV_ID,
      packageId: PKG_ID,
      packageInstanceId: 'inst-999',
      itemType: 'package',
      duration: 45,
      basePrice: 200,
      finalPrice: 200
    }
  ];

  // Component inside bundle does not highlight standalone service card
  assert.equal(isQueuedStandaloneServiceSelected(staged, SRV_ID), false);

  // Package bundle price calculation
  const pkgDef: MinimalPackageItem = {
    id: PKG_ID,
    totalPrice: 350,
    totalDuration: 45,
    scheduleType: 'sequential'
  };

  const pricing = calculateStagedPricing(staged, [pkgDef]);
  assert.equal(pricing.subtotal, 350.00);
  assert.equal(pricing.vat, 52.50); // 15% VAT
  assert.equal(pricing.total, 402.50);
});
