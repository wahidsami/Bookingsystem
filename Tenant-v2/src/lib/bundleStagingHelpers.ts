/**
 * Helpers for managing staged services and bundles in appointment drawers,
 * ensuring strict isolation between standalone service selections and bundle components.
 */

export interface MinimalStagedItem {
  id?: string;
  serviceId: string;
  variantId?: string | null;
  itemType?: string;
  packageId?: string | null;
  packageInstanceId?: string | null;
  basePrice?: number;
  finalPrice?: number;
  duration?: number;
}

export interface MinimalPackageItem {
  id: string;
  totalPrice?: number;
  price?: number;
  totalDuration?: number;
  scheduleType?: string;
}

/**
 * Checks whether a standalone service (or variant) is currently selected.
 * Strictly ignores bundle component items so that services inside packages
 * do not falsely appear as standalone bookings.
 */
export const isQueuedStandaloneServiceSelected = (
  stagedServices: MinimalStagedItem[],
  serviceId: string,
  variantId?: string | null
): boolean => {
  return stagedServices.some((item) => {
    if (item.itemType === 'package' || Boolean(item.packageId)) {
      return false;
    }
    if (item.serviceId !== serviceId) {
      return false;
    }
    if (variantId) {
      return item.variantId === variantId;
    }
    return !item.variantId;
  });
};

/**
 * Removes a standalone service from staged services.
 * Preserves all bundle component items intact even if they share the same serviceId.
 */
export const removeStandaloneQueuedService = <T extends MinimalStagedItem>(
  stagedServices: T[],
  serviceId: string,
  variantId?: string | null
): T[] => {
  return stagedServices.filter((item) => {
    if (item.itemType === 'package' || Boolean(item.packageId)) {
      return true;
    }
    if (item.serviceId !== serviceId) {
      return true;
    }
    if (variantId) {
      return item.variantId !== variantId;
    }
    return Boolean(item.variantId);
  });
};

/**
 * Removes all child services belonging to a package instance or package ID.
 */
export const removeBundleFromStagedServices = <T extends MinimalStagedItem>(
  stagedServices: T[],
  packageOrInstanceId: string
): T[] => {
  return stagedServices.filter((item) => {
    const isTarget = item.packageInstanceId === packageOrInstanceId || item.packageId === packageOrInstanceId;
    return !isTarget;
  });
};

/**
 * Calculates pricing for staged items, verifying that packages charge the package price
 * and component services are not charged individually.
 */
export const calculateStagedPricing = (
  stagedServices: MinimalStagedItem[],
  packages: MinimalPackageItem[]
): { subtotal: number; vat: number; total: number } => {
  const standaloneItems = stagedServices.filter((s) => s.itemType !== 'package' && !s.packageId);
  const pkgItems = stagedServices.filter((s) => s.itemType === 'package' || Boolean(s.packageId));

  const standaloneTotal = standaloneItems.reduce((sum, item) => sum + Number(item.finalPrice ?? item.basePrice ?? 0), 0);

  const pkgGroups = pkgItems.reduce((acc, curr) => {
    const groupKey = curr.packageInstanceId || curr.packageId!;
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(curr);
    return acc;
  }, {} as Record<string, MinimalStagedItem[]>);

  const packagesTotal = Object.values(pkgGroups).reduce((sum, items) => {
    const pkgId = items[0]?.packageId;
    const pkg = packages.find((p) => p.id === pkgId);
    return sum + Number(pkg?.totalPrice ?? pkg?.price ?? 0);
  }, 0);

  const subtotal = Number((standaloneTotal + packagesTotal).toFixed(2));
  const vat = Number((subtotal * 0.15).toFixed(2));
  const total = Number((subtotal + vat).toFixed(2));

  return { subtotal, vat, total };
};
