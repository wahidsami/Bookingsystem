type PackageEntitlements = Record<string, unknown> | null | undefined;

export function isEntitlementEnabled(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;

  if (typeof value === "number") {
    return value === -1 || value > 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false" || normalized === "") return false;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) && (parsed === -1 || parsed > 0);
  }

  return false;
}

function firstDefinedEntitlement(entitlements: PackageEntitlements, keys: string[]): unknown {
  if (!entitlements) return undefined;

  for (const key of keys) {
    if (entitlements[key] !== undefined) {
      return entitlements[key];
    }
  }

  return undefined;
}

export function hasAIAssistantEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(
    firstDefinedEntitlement(entitlements, ["hasAIContentAssistant", "aiContentAssistant"])
  );
}

export function hasProductsAndOrdersEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(
    firstDefinedEntitlement(entitlements, ["hasProductsAndOrders", "productsAndOrders", "maxProducts"])
  );
}

export function hasInternalMessagingEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(
    firstDefinedEntitlement(entitlements, ["hasInternalMessaging", "internalMessaging"])
  );
}

export function hasHotDealsEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(
    firstDefinedEntitlement(entitlements, ["maxHotDeals", "hotDeals"])
  );
}

export function hasPushNotificationsEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(
    firstDefinedEntitlement(entitlements, [
      "hasPushNotifications",
      "inAppMarketingNotifications",
      "pushNotifications"
    ])
  );
}

export function hasReportsEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(
    firstDefinedEntitlement(entitlements, ["reports", "hasAdvancedReports", "advancedAnalytics"])
  );
}

export function hasPayrollEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(
    firstDefinedEntitlement(entitlements, ["payroll", "hasPayroll"])
  );
}

export function hasPublicPageCustomizationEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(
    firstDefinedEntitlement(entitlements, [
      "publicPageCustomization",
      "hasCustomBranding",
      "whiteLabel"
    ])
  );
}
