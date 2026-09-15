export type PackageEntitlements = Record<string, unknown> | null | undefined;

export function isEntitlementEnabled(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;

  if (typeof value === 'number') {
    return value === -1 || value > 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false' || normalized === '') return false;

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
  return isEntitlementEnabled(firstDefinedEntitlement(entitlements, ['hasAIContentAssistant', 'aiContentAssistant']));
}

export function hasAIConsultantEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(firstDefinedEntitlement(entitlements, ['aiConsultant', 'ai_consultant', 'hasAIConsultant']));
}

export function hasProductsAndOrdersEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(firstDefinedEntitlement(entitlements, ['hasProductsAndOrders', 'productsAndOrders', 'maxProducts']));
}

export function hasInternalMessagingEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(firstDefinedEntitlement(entitlements, ['hasInternalMessaging', 'internalMessaging']));
}

export function hasHotDealsEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(firstDefinedEntitlement(entitlements, ['maxHotDeals', 'hotDeals']));
}

export function hasPushNotificationsEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(
    firstDefinedEntitlement(entitlements, [
      'hasPushNotifications',
      'inAppMarketingNotifications',
      'pushNotifications'
    ])
  );
}

export function hasReportsEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(firstDefinedEntitlement(entitlements, ['reports', 'hasAdvancedReports', 'advancedAnalytics']));
}

export function hasPayrollEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(firstDefinedEntitlement(entitlements, ['payroll', 'hasPayroll']));
}

export function hasPublicPageCustomizationEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(
    firstDefinedEntitlement(entitlements, ['publicPageCustomization', 'hasCustomBranding', 'whiteLabel'])
  );
}

export function hasServicePackagesEntitlement(entitlements: PackageEntitlements): boolean {
  return isEntitlementEnabled(
    firstDefinedEntitlement(entitlements, ['hasServicePackages', 'servicePackages'])
  );
}

export function normalizePackageEntitlements(source: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!source) return null;

  const variants = [
    source.packageEntitlements,
    source.entitlements,
    source.subscription?.entitlements,
    source.subscription?.packageEntitlements,
    source.package?.entitlements,
    source.package?.packageEntitlements
  ].filter(Boolean);

  if (variants.length === 0) {
    return source;
  }

  return Object.assign({}, source, ...variants);
}

export function normalizeDashboardPermissions(
  source: Record<string, boolean> | null | undefined,
  roleKey?: string | null
): Record<string, boolean> | null {
  if (!source && !roleKey) return null;

  const permissions = { ...(source || {}) };

  if (roleKey && !permissions.roleKey) {
    permissions.roleKey = roleKey as any;
  }

  return permissions;
}
