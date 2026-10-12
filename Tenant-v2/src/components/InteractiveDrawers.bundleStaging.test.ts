import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isQueuedStandaloneServiceSelected,
  removeStandaloneQueuedService,
  removeBundleFromStagedServices,
  calculateStagedPricing,
  MinimalStagedItem,
  MinimalPackageItem
} from '../lib/bundleStagingHelpers';

// Test Fixtures mirroring the user's scenario
const PERFECT_STUDENT_BUNDLE: MinimalPackageItem = {
  id: 'pkg-perfect-student',
  totalPrice: 527,
  totalDuration: 150,
  scheduleType: 'sequential'
};

const SERVICE_MOROCCAN_MASSAGE = 'srv-moroccan-massage';
const SERVICE_THAI_THERAPY = 'srv-thai-therapy';
const SERVICE_CLASSIC_MANICURE = 'srv-classic-manicure';

const createBundleStagedItems = (instanceId = 'pkg_inst_123'): MinimalStagedItem[] => [
  {
    id: 'stg-1',
    serviceId: SERVICE_MOROCCAN_MASSAGE,
    itemType: 'package',
    packageId: PERFECT_STUDENT_BUNDLE.id,
    packageInstanceId: instanceId,
    duration: 60,
    basePrice: 200,
    finalPrice: 200
  },
  {
    id: 'stg-2',
    serviceId: SERVICE_THAI_THERAPY,
    itemType: 'package',
    packageId: PERFECT_STUDENT_BUNDLE.id,
    packageInstanceId: instanceId,
    duration: 50,
    basePrice: 200,
    finalPrice: 200
  },
  {
    id: 'stg-3',
    serviceId: SERVICE_CLASSIC_MANICURE,
    itemType: 'package',
    packageId: PERFECT_STUDENT_BUNDLE.id,
    packageInstanceId: instanceId,
    duration: 40,
    basePrice: 150,
    finalPrice: 150
  }
];

test('standalone service card must not show Added when only included as a component inside a bundle', () => {
  const stagedServices = createBundleStagedItems();

  // All 3 services are part of the bundle, none are booked standalone
  assert.equal(isQueuedStandaloneServiceSelected(stagedServices, SERVICE_CLASSIC_MANICURE), false);
  assert.equal(isQueuedStandaloneServiceSelected(stagedServices, SERVICE_MOROCCAN_MASSAGE), false);
  assert.equal(isQueuedStandaloneServiceSelected(stagedServices, SERVICE_THAI_THERAPY), false);
});

test('standalone service card shows Added only when explicitly selected as a standalone service', () => {
  const stagedServices = createBundleStagedItems();

  // Add an explicit standalone Classic Manicure
  const standaloneItem: MinimalStagedItem = {
    id: 'stg-standalone-manicure',
    serviceId: SERVICE_CLASSIC_MANICURE,
    itemType: 'service',
    packageId: null,
    duration: 40,
    basePrice: 150,
    finalPrice: 150
  };

  const combinedServices = [...stagedServices, standaloneItem];

  assert.equal(isQueuedStandaloneServiceSelected(combinedServices, SERVICE_CLASSIC_MANICURE), true);
  // Moroccan massage and Thai therapy remain standalone unselected
  assert.equal(isQueuedStandaloneServiceSelected(combinedServices, SERVICE_MOROCCAN_MASSAGE), false);
  assert.equal(isQueuedStandaloneServiceSelected(combinedServices, SERVICE_THAI_THERAPY), false);
});

test('toggling/removing a standalone service does not strip child component out of the bundle', () => {
  const bundleItems = createBundleStagedItems();
  const standaloneItem: MinimalStagedItem = {
    id: 'stg-standalone-manicure',
    serviceId: SERVICE_CLASSIC_MANICURE,
    itemType: 'service',
    packageId: null,
    duration: 40,
    basePrice: 150,
    finalPrice: 150
  };

  const combinedServices = [...bundleItems, standaloneItem];
  assert.equal(combinedServices.length, 4);

  // Remove standalone Classic Manicure
  const afterRemoval = removeStandaloneQueuedService(combinedServices, SERVICE_CLASSIC_MANICURE);

  // Standalone was removed, but the bundle's component manicure is strictly preserved
  assert.equal(afterRemoval.length, 3);
  const bundleManicure = afterRemoval.find(
    (s) => s.serviceId === SERVICE_CLASSIC_MANICURE && s.itemType === 'package'
  );
  assert.ok(bundleManicure, 'Bundle component manicure must remain in staged services');
  assert.equal(bundleManicure.packageId, PERFECT_STUDENT_BUNDLE.id);
});

test('bundle removal cleanly removes all bundle components and preserves standalone services', () => {
  const bundleItems = createBundleStagedItems('pkg_inst_123');
  const standaloneItem: MinimalStagedItem = {
    id: 'stg-standalone-manicure',
    serviceId: SERVICE_CLASSIC_MANICURE,
    itemType: 'service',
    packageId: null,
    duration: 40,
    basePrice: 150,
    finalPrice: 150
  };

  const combinedServices = [...bundleItems, standaloneItem];

  // Remove the bundle
  const afterBundleRemoval = removeBundleFromStagedServices(combinedServices, 'pkg_inst_123');

  assert.equal(afterBundleRemoval.length, 1);
  assert.equal(afterBundleRemoval[0].id, 'stg-standalone-manicure');
});

test('pricing integrity: bundle charges package price, component services are not charged individually', () => {
  const bundleItems = createBundleStagedItems();

  // Pricing with bundle only
  const bundlePricing = calculateStagedPricing(bundleItems, [PERFECT_STUDENT_BUNDLE]);
  assert.equal(bundlePricing.subtotal, 527.00);
  assert.equal(bundlePricing.vat, 79.05);
  assert.equal(bundlePricing.total, 606.05);

  // Pricing with bundle + standalone Classic Manicure (150 SAR)
  const standaloneItem: MinimalStagedItem = {
    id: 'stg-standalone-manicure',
    serviceId: SERVICE_CLASSIC_MANICURE,
    itemType: 'service',
    packageId: null,
    duration: 40,
    basePrice: 150,
    finalPrice: 150
  };

  const combinedPricing = calculateStagedPricing([...bundleItems, standaloneItem], [PERFECT_STUDENT_BUNDLE]);
  assert.equal(combinedPricing.subtotal, 677.00); // 527 + 150
  assert.equal(combinedPricing.vat, 101.55);
  assert.equal(combinedPricing.total, 778.55);
});
