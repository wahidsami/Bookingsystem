# Rifah Tenant Package Feature Access Audit

Document date: 2026-04-03
Scope: validate whether package features created in Admin Packages are actually enforced and reflected in Tenant Dashboard UI and backend APIs.
Apps involved: `server`, `admin`, `tenant`

## Executive Summary

Your concern is valid, captain: the current package system is not yet a complete entitlement system.

What we have today:

- Admin can create packages with resource limits and selected feature flags/quotas.
- Tenants subscribe to one package.
- Some backend APIs check subscription status and some specific features.
- Some tenant pages read `/tenant/settings/limits` and disable a few actions based on usage limits.

What is still incomplete or inconsistent:

- Tenant sidebar/navigation currently shows almost all modules regardless of package entitlement.
- Many tenant routes/pages are accessible even if the package does not include that module.
- Backend feature enforcement is only applied to AI routes explicitly; most package-specific modules are not protected by feature middleware.
- Some package feature keys are inconsistent across admin package creation, backend checks, and tenant UI checks.
- Some features selected in package creation are pricing-only today, not true product access toggles.
- Some package flags exist in old seeded packages but are not present in the package create/edit UI, while some newer UI flags are not present in old seeds.

That means a tenant may see a feature that should not be available, or a tenant may pay for a feature that still fails or is hidden because the entitlement key is mismatched.

## Most Important Confirmed Bug

### AI Content Assistant key mismatch

Package creation stores AI quota under:

- `limits.aiContentAssistant`

Tenant service/product pages check:

- `response.limits.hasAIContentAssistant`

Backend `/tenant/settings/limits` tries to normalize this alias and derive `hasAIContentAssistant` from `aiContentAssistant`, but the actual result still depends on whether the package limits payload is merged and normalized consistently for all tenants and all package versions.

Backend AI routes use:

- `checkTenantFeature('hasAIContentAssistant')`

And `server/src/middleware/authTenant.js` maps:

- `hasAIContentAssistant -> ['hasAIContentAssistant', 'aiContentAssistant']`

So backend AI route access is partially alias-safe, but frontend feature visibility can still be wrong if the limits API payload or legacy package data is inconsistent.

### Immediate risk

A tenant can subscribe to a package that appears to include AI, but service/product pages may hide or reject AI actions because the UI checks a derived boolean key instead of the canonical quota key.

## Current Package Feature Sources

## Admin Package Create/Edit UI

Defined in:

- `admin/src/app/dashboard/packages/new/page.tsx`
- `admin/src/app/dashboard/packages/[id]/page.tsx`

Current package limit/feature fields saved into `SubscriptionPackage.limits`:

| Category | Package field key | Type | Intended meaning |
| --- | --- | --- | --- |
| Resource limit | `maxBookingsPerMonth` | number, `-1` unlimited | Max bookings per month |
| Resource limit | `maxStaff` | number, `-1` unlimited | Max staff records |
| Resource limit | `maxServices` | number, `-1` unlimited | Max services |
| Resource limit | `maxProducts` | number, `-1` unlimited | Max products |
| Resource limit | `storageGB` | number | File storage quota |
| Module toggle | `hasSubscriptionFee` | boolean | Subscription fee feature flag, business meaning currently unclear in tenant UI |
| Module toggle | `hasProductsAndOrders` | boolean | Products & orders module |
| Module toggle | `hasInternalMessaging` | boolean | Internal messages module |
| Quota feature | `whatsappNotifications` | number | WhatsApp notification quota |
| Quota feature | `inAppMarketingNotifications` | number | Customer push/in-app marketing notification quota |
| Quota feature | `aiContentAssistant` | number | AI content assistant quota/availability |
| Quota feature | `promotionalEmails` | number | Promotional email quota |
| Quota feature | `searchRankingBoost` | number | Search boost count/level |
| Promotional toggle | `hasNewToRefah` | boolean | New-to-Refah tag enabled |
| Promotional quota | `newToRefahDays` | number | Duration of new-to-Refah tag |
| Promotional toggle | `featuredCarousel` | boolean | Can appear in featured carousel |
| Promotional setting | `carouselPriority` | string | Featured carousel priority |
| Promotional quota | `maxHotDeals` | number, `-1` unlimited | Max hot deals |
| Promotional toggle | `hotDealsAutoApprove` | boolean | Auto-approve hot deals |
| Promotional quota | `featuredProducts` | number, `-1` unlimited | Number of featured products |

## Seeded Package Fields Not Fully Aligned With New Package UI

Defined in:

- `server/src/utils/seedPackages.js`

Old seeded packages include many keys that the current package create/edit UI does not manage directly:

- `hasAdvancedReports`
- `hasSMSNotifications`
- `hasEmailNotifications`
- `hasVoiceNotifications`
- `hasMultiLocation`
- `hasInventoryManagement`
- `hasLoyaltyProgram`
- `hasGiftCards`
- `hasOnlinePayments`
- `hasCustomBranding`
- `hasAPIAccess`
- `hasPrioritySupport`
- `hasDedicatedAccountManager`
- `customDomain`
- `whiteLabel`
- `advancedAnalytics`
- `dataExport`
- `maxAdvanceBookingDays`
- `allowWaitlist`
- `allowGroupBookings`
- `allowMemberships`
- `emailMarketingCampaigns`
- `smsMarketingCampaigns`
- `supportChannels`
- `supportResponseTime`

### Risk

These old seed fields may influence legacy assumptions, but many are not enforced consistently in tenant UI/API. New custom packages created from admin UI may not include these old flags at all, so older code paths that expect them can behave unpredictably.

## Feature Entitlement Enforcement Architecture Today

## Backend subscription/feature utilities

| Code | Current responsibility | Status |
| --- | --- | --- |
| `server/src/services/tenantSubscriptionService.js` | Find tenant's active/trial subscription and package limits | Exists |
| `server/src/middleware/checkSubscription.js` | Check active subscription, check feature flag, check resource limits | Exists, but not widely used on tenant routes |
| `server/src/middleware/authTenant.js` `checkTenantFeature(feature)` | Check package/TenantSettings feature access with alias fallback | Exists, but only applied to AI routes currently |
| `server/src/controllers/tenantSettingsController.js` `getSubscriptionLimits` | Return package limits + current usage and normalize some aliases | Exists |
| `server/src/services/promotionService.js` | Check hot deals/featured carousel/search boost package features | Exists, but uses some old assumptions and active-only subscription |

## Tenant Dashboard navigation today

Defined in:

- `tenant/src/components/TenantLayout.tsx`

Current sidebar always shows:

- Dashboard
- Services
- Products
- Employees
- Schedules
- Appointments
- Orders
- Hot Deals
- Messages
- Customer Push
- Customers
- My Bills
- My Subscription
- Financial
- Payroll
- Reviews
- Reports
- My Page
- Settings

### Risk

This sidebar is static and does not hide package-restricted modules. So if a package does not include Products & Orders, Messages, Hot Deals, or Customer Push, those menu items still appear unless each page separately blocks access.

## Tenant Feature Access Matrix

Legend:

- `UI hidden?` = whether module/action is hidden when package does not include feature
- `UI disabled?` = whether module/action remains visible but blocked with a clear message
- `API enforced?` = whether backend route checks package entitlement
- `Current risk` = what can go wrong today

| Tenant feature/module | Package control key(s) | Tenant UI hidden? | Tenant UI disabled? | API enforced? | Current risk / observation | Required fix |
| --- | --- | --- | --- | --- | --- | --- |
| Services module | `maxServices` | No | Create button disabled at limit in list page | Create limit partially checked in UI; backend route not wrapped with subscription middleware in `tenantRoutes.js` | Tenant can still see Services regardless of plan; backend limit enforcement path must be verified route-by-route | Add backend resource-limit middleware on create routes and keep UI usage badge |
| AI service content generation/translation | `aiContentAssistant`, alias `hasAIContentAssistant` | Partially, button visibility depends on `/settings/limits` | Button may be hidden if `hasAIContentAssistant` false | Yes, AI routes use `checkTenantFeature('hasAIContentAssistant')` | Key mismatch / quota-vs-boolean ambiguity can make AI unavailable despite package quota | Standardize one canonical entitlement schema and expose both quota and boolean from one backend endpoint |
| Products module | `hasProductsAndOrders`, `maxProducts` | No | Create button disabled at product limit only | No feature guard on product routes; no `checkTenantFeature('hasProductsAndOrders')` in `tenantRoutes.js` | Products page appears even when package excludes products; API likely still allows product actions unless limit 0 logic blocks count only | Hide Products nav/page when feature unavailable and add backend feature + resource limit guards |
| Orders module | `hasProductsAndOrders` | No | No obvious package block | No feature guard on order routes | Tenant can open Orders even if Products & Orders package feature is off | Hide Orders nav/page and guard order APIs with package feature middleware |
| Internal Messages module | `hasInternalMessaging`, alias `internalMessaging` | No | No obvious package block | No feature guard on message routes | Messages page/API may work for tenants whose package does not include messaging | Hide Messages nav/page and guard `/tenant/messages` routes |
| Customer Push Notifications | `inAppMarketingNotifications` | No | Page shows quota and hides form when `usage.limit === 0` | Usage quota enforced in service, but route not guarded by a feature middleware | Sidebar still shows feature when plan limit is 0; if quota naming changes, UI can misrepresent availability | Hide nav/page when quota is 0 and enforce quota consistently in backend |
| WhatsApp Notifications settings | `whatsappNotifications` or old `hasWhatsAppNotifications` | No | Settings page shows toggle regardless of package | No obvious route guard on settings update | Tenant may enable WhatsApp notifications in settings even if package has zero quota | Hide/lock notification settings based on package limits |
| Hot Deals | `maxHotDeals`, `hotDealsAutoApprove` | No | Page displays `current/max` and blocks create if limit reached | Backend hot deals controller has package-limit logic, but route guard consistency should be audited | Hot Deals menu appears even if package max is 0; behavior may depend on page/controller implementation | Hide Hot Deals nav/page when `maxHotDeals === 0`, keep backend limit check |
| Featured Carousel / Public promotion | `featuredCarousel`, `carouselPriority` | No tenant package visibility UI in core dashboard | N/A | `featuredController` and `promotionService` check package | Tenant may pay for promotion feature but has no clear dashboard status/control or package explanation | Expose promotion entitlement/status clearly in tenant subscription or marketing pages |
| Featured Products | `featuredProducts` | No package visibility UI | N/A | Not clearly enforced in current tenant product flows | Package may include featured products but tenant has no obvious control or enforcement | Add explicit UI/API behavior or remove pricing flag until implemented |
| Search Ranking Boost | `searchRankingBoost` | No package visibility UI | N/A | `promotionService.getSearchRankingBoost` exists, but tenant-facing enforcement/status unclear | Paid boost feature may not have a visible tenant workflow | Add UI/status and backend usage accounting if this is a sold feature |
| Employees module | `maxStaff` | No | Create button disabled at limit in list page | Create route not wrapped with package limit middleware in `tenantRoutes.js` | Staff module appears for all plans, and backend limit enforcement must be verified | Add backend resource-limit guard on employee creation and keep usage UI |
| Schedules module | No clear package key in current admin package UI | No | No | No | Scheduling appears available to all packages because no entitlement key exists | Decide if Schedules are universal or create a package feature flag |
| Appointments module | `maxBookingsPerMonth` | No | No clear package block except usage in limits endpoint | Appointment create is customer-side, tenant appointment management routes not package-guarded | Tenant can manage appointments even if package theoretically exceeded monthly booking quota; booking creation limit enforcement may live elsewhere and must be audited | Audit customer booking APIs and tenant appointment APIs separately |
| Customers module | No clear package key in current admin package UI | No | No | No | Customers appears universal | Decide whether Customers are universal or package-gated |
| My Bills | Always needed | No | No | Auth only | Billing should remain visible regardless of package | Keep always available |
| My Subscription | Always needed | No | No | Auth only | Should remain always visible | Keep always available |
| Financial module | `hasAdvancedReports`, `advancedAnalytics`, maybe universal finance | No | No | No | Financial page appears regardless of package; package UI currently does not directly expose these old report flags | Decide finance entitlement model and enforce consistently |
| Payroll module | No clear package key in current admin package UI | No | No | No | Payroll appears for all packages and is not package-gated | Decide if Payroll is universal or add package feature flag |
| Reviews module | No clear package key in current admin package UI | No | No | No | Reviews appears universal | Decide if Reviews are universal or package-gated |
| Reports module | Old seed flags `hasAdvancedReports`, `advancedAnalytics`, `dataExport`; package UI currently lacks these fields | No | No | No | Tenant sees Reports even if package should not include advanced analytics; package create UI cannot configure those old report flags | Add report entitlement flags in package UI and backend/UI guards, or make Reports universal |
| My Page / Public Page branding | Old seed flags `hasCustomBranding`, `customDomain`, `whiteLabel`; current package UI lacks these | No | No | No | Public page and branding tools appear regardless of package; no clear entitlement gating | Add package-controlled branding flags and enforce in My Page/Public Page routes/UI |
| Settings module | Mixed old flags `hasWhatsAppNotifications`, `maxAdvanceBookingDays`, etc. | No | Partially no | No | Tenants may configure settings beyond package limits, e.g. WhatsApp or max advance booking days | Make settings page package-aware and enforce save-time limits in backend |
| Logo/cover uploads and storage | `storageGB` | No | No | Storage usage enforcement not clearly wired in upload routes | Package storage quotas may be sold but not actually enforced | Add upload size/storage accounting and enforce `storageGB` |
| Public Page hero/content AI | `aiContentAssistant` | No obvious package visibility | Maybe backend AI route guarded | AI about-us route guarded, but page UX package awareness should be checked | Feature may be blocked by backend only with no clear package messaging | Add package-aware UI messaging |

## Current Route Guard Gap Summary

Defined in:

- `server/src/routes/tenantRoutes.js`

Current explicit feature middleware usage is limited to AI routes only:

- `POST /tenant/ai/generate-product`
- `POST /tenant/ai/generate-service`
- `POST /tenant/ai/generate-about-us`
- `POST /tenant/ai/translate`

No `checkTenantFeature(...)` wrappers are currently applied to these package-specific module routes:

- `/tenant/products/*`
- `/tenant/orders/*`
- `/tenant/messages/*`
- `/tenant/notifications/*`
- `/tenant/hot-deals/*`
- `/tenant/reports/*`
- `/tenant/payroll/*`
- `/tenant/public-page/*`

No `checkResourceLimit(...)` middleware from `server/src/middleware/checkSubscription.js` is currently attached in `tenantRoutes.js` for create routes such as:

- `POST /tenant/employees`
- `POST /tenant/services`
- `POST /tenant/products`

So resource and feature enforcement currently depends on scattered controller/UI checks instead of one consistent route-level entitlement layer.

## Root Causes

## Root Cause 1 - No canonical package entitlement schema

Package features are stored as loosely structured JSON (`SubscriptionPackage.limits`), but there is no single shared schema file used by:

- admin package forms
- backend feature checks
- tenant UI visibility
- subscription/usage APIs

That allows key drift such as:

- `aiContentAssistant`
- `hasAIContentAssistant`
- `internalMessaging`
- `hasInternalMessaging`
- `hotDeals`
- `maxHotDeals`

## Root Cause 2 - Sidebar and page access are not package-aware

Tenant navigation is static. Even when a feature is not included in the package, its nav link is still rendered.

## Root Cause 3 - Backend feature enforcement is not centralized

AI routes have feature middleware, but most other package-related routes do not.

## Root Cause 4 - Some sold package features are not implemented as tenant-facing workflows

Example: `featuredProducts`, `searchRankingBoost`, `hasNewToRefah`, some old analytics/branding flags.

## Root Cause 5 - Old package seeds and new package admin UI are not aligned

Legacy seed keys and modern package-builder keys do not fully match, so package definitions can be inconsistent depending on how the package was created.

## Recommended Entitlement Architecture

## 1. Define one canonical package entitlement schema

Create one shared backend schema/normalizer for `SubscriptionPackage.limits`.

Recommended canonical fields:

| Canonical key | Type | Meaning |
| --- | --- | --- |
| `maxBookingsPerMonth` | number | booking quota |
| `maxStaff` | number | staff quota |
| `maxServices` | number | service quota |
| `maxProducts` | number | product quota |
| `storageGB` | number | storage quota |
| `features.productsAndOrders` | boolean | Products + Orders module |
| `features.internalMessaging` | boolean | Messages module |
| `features.aiContentAssistant` | number | AI quota, 0 means disabled, `-1` unlimited |
| `features.pushNotifications` | number | customer push quota, 0 means disabled, `-1` unlimited |
| `features.whatsappNotifications` | number | WhatsApp notification quota |
| `features.promotionalEmails` | number | promotional email quota |
| `features.hotDeals` | number | max hot deals, 0 disabled, `-1` unlimited |
| `features.hotDealsAutoApprove` | boolean | hot deal auto-approval |
| `features.featuredCarousel` | boolean | featured carousel inclusion |
| `features.carouselPriority` | string | carousel priority |
| `features.searchRankingBoost` | number | search boost quota/level |
| `features.newToRefahTag` | boolean | new badge enabled |
| `features.newToRefahDays` | number | badge duration |
| `features.featuredProducts` | number | featured product quota |
| `features.reports` | boolean | reports module |
| `features.advancedAnalytics` | boolean | advanced reports/analytics |
| `features.payroll` | boolean | payroll module |
| `features.publicPageCustomization` | boolean | public page branding/editing |
| `features.customDomain` | boolean | custom domain |
| `features.apiAccess` | boolean | API access |

Implementation note: current JSON can stay, but we need one normalizer that accepts legacy aliases and outputs one canonical shape.

## 2. Expose one tenant entitlement endpoint

Create or upgrade one endpoint such as:

- `GET /tenant/subscription/entitlements`

Response should include:

- current package ID/name
- subscription status
- resource limits + usage
- feature flags/quotas in canonical schema
- derived booleans for UI, e.g. `canUseAI`, `canUseProducts`, `canUseMessages`, `canUseReports`
- action-level deny reasons if possible

Tenant UI should read this once in layout/context and use it to hide/show modules consistently.

## 3. Make tenant sidebar and routes package-aware

Tenant sidebar should hide modules when entitlement is false/zero, except `My Bills`, `My Subscription`, and base settings/account pages.

Tenant pages should also guard direct URL access:

- if route is not entitled, show a professional upgrade screen
- do not just rely on hidden nav

## 4. Apply backend route-level entitlement middleware consistently

Use one middleware stack pattern:

- auth
- subscription active
- feature entitlement
- resource quota where needed
- controller

Example:

- `POST /tenant/products` should require `productsAndOrders` and product quota.
- `GET /tenant/messages` and `POST /tenant/messages` should require `internalMessaging`.
- `GET /tenant/reports/*` should require reports/analytics entitlement if not universal.
- `POST /tenant/notifications/send` should require push notification quota.
- `POST /tenant/hot-deals` should require hot deal quota.

## 5. Add an Admin Package Feature Consistency QA checklist

For every package field added in admin:

- verify tenant UI shows or hides the matching module/action
- verify direct route access is blocked if not entitled
- verify API returns a clear upgrade-required error if called directly
- verify quota counters and limits match package values
- verify upgrading package unlocks the feature after payment and old package no longer restricts it

## Immediate Engineering Action Plan

## Phase PF-1 - Canonical Entitlement Audit and Hotfixes

Goal: fix the most dangerous mismatches first, especially AI and obvious module visibility gaps.

### To Do

- Create one backend package-limits normalizer utility and reuse it in:
  - tenant subscription limits API
  - tenant feature middleware
  - subscription/package services
- Standardize AI entitlement:
  - expose `aiContentAssistant` quota and `hasAIContentAssistant` derived boolean together
  - tenant UI should use the derived boolean and optionally show quota
  - backend AI middleware should keep alias support
- Verify all active packages in DB have correct AI keys and no malformed limits objects.
- Patch tenant `TenantLayout` to hide package-restricted nav items once entitlement data is available.
- Add a package-aware blocked-state page/component for direct URL access to disabled modules.

## Phase PF-2 - Backend Route Enforcement

Goal: make package access impossible to bypass by direct API calls.

### To Do

- Add feature middleware to Products, Orders, Messages, Notifications, Hot Deals, Reports, Payroll, and Public Page routes based on the final entitlement schema.
- Add resource-limit middleware to create routes for staff, services, and products.
- Audit customer booking/order/public APIs if booking/product package limits must be enforced from the customer side too.
- Ensure all deny responses use one standard error shape and clear upgrade message.

## Phase PF-3 - Admin Package Builder and Feature Schema Alignment

Goal: make every feature sold in admin packages map to one real tenant capability.

### To Do

- Compare every package create/edit field to an implemented tenant module or API capability.
- Remove or mark as "not implemented yet" any package feature that currently has no tenant-facing behavior.
- Add missing package fields for tenant modules we want to gate but currently cannot configure, such as:
  - Reports
  - Payroll
  - Public Page customization
  - Reviews, if not universal
- Align old seed package keys with new package-builder keys through a migration/normalizer.
- Update package cards and package create/edit UI labels so feature meaning is business-clear.

## Phase PF-4 - Tenant Subscription/Usage UI Transparency

Goal: tenant should clearly see what package features they have and why a feature is hidden or locked.

### To Do

- Enhance `My Subscription` to show all package features/quotas included in the current plan.
- Add an "Included in your plan" vs "Upgrade to unlock" section.
- On locked pages or hidden actions, show upgrade messaging that references the current package and target feature.
- On AI buttons, display remaining quota if quotas are implemented, not only a boolean.

## Phase PF-5 - Full Entitlement QA Matrix

Goal: prevent package/feature drift from returning.

### To Do

- Extend tenant QA docs with package entitlement test cases:
  - package includes feature and tenant can use it
  - package excludes feature and tenant cannot see/use it
  - direct API access to excluded feature is denied
  - upgrading package unlocks the feature
  - downgrading package removes access after period transition according to business rules
- Test one package per feature category:
  - no-products package
  - no-messaging package
  - AI-enabled package
  - no-AI package
  - zero-hot-deals package
  - reports/payroll restricted package

## Phase PF-6 - Package Consumption Table and Near-Limit Alerts

Goal: give tenant admins a clear consumption dashboard for every package quantity and warn them before a quota or resource limit is exhausted.

### To Do

- Add a dedicated package consumption tab or section in `My Subscription`.
- Display each package-controlled resource/feature in a table with:
  - service or feature name
  - total allowance from the subscribed package
  - consumed quantity
  - remaining quantity
  - current status, for example healthy / near limit / limit reached
- Cover both resource limits and quota-based features such as:
  - employees
  - services
  - products
  - monthly bookings
  - AI usage
  - hot deals
  - customer push notifications
  - internal messages, if message quota is introduced
  - WhatsApp notifications
  - promotional emails
  - featured products
- For unlimited package values (`-1`), show a clear "Unlimited" state and avoid false near-limit warnings.
- Add tenant dashboard notifications/alerts when a package quantity is close to exhaustion, for example at 80%, 90%, and 100%.
- Show a prominent upgrade CTA inside the consumption table when a feature is near limit or fully consumed.
- Standardize usage counters so consumed/remaining values are computed from one trusted backend source, not mixed stale counters and live counts.
- Persist alert acknowledgment state so tenant admins do not repeatedly see the same warning after dismissing it.
- Leave this as the final package-entitlement phase after the current PF-1 to PF-5 implementation is stable.

## Immediate High-Confidence Findings From This Code Pass

| Finding | Evidence | Risk level |
| --- | --- | --- |
| Tenant sidebar is not package-aware | `tenant/src/components/TenantLayout.tsx` renders a static `navigation` array | High |
| AI entitlement key naming is inconsistent | Admin package uses `aiContentAssistant`, tenant UI checks `hasAIContentAssistant`, backend aliases both | High |
| Most tenant package-specific routes are not feature-guarded | `server/src/routes/tenantRoutes.js` applies `checkTenantFeature` only to AI routes | High |
| Resource-limit middleware exists but is not attached to create routes in tenant routes | `server/src/middleware/checkSubscription.js` vs `server/src/routes/tenantRoutes.js` | High |
| Products & Orders can appear even if not included | Sidebar always shows Products/Orders; no route feature guard visible | High |
| Messages can appear even if not included | Sidebar always shows Messages; no route feature guard visible | High |
| Customer Push appears even with zero quota | Sidebar always shows Notifications; page blocks only when `usage.limit === 0` | Medium |
| Old package seeds and current admin package fields are not aligned | `seedPackages.js` contains many keys absent from current package forms | High |
| Some package fields may currently be pricing-only, not real tenant capabilities | `featuredProducts`, `searchRankingBoost`, `hasNewToRefah`, some old report/branding flags | High |
| Promotion service uses active-only subscriptions, while other subscription logic accepts trial/active | `promotionService.getTenantSubscription` checks `status: 'active'` only | Medium |

## Recommended Next Step

Before continuing the billing/invoicing roadmap, implement **Phase PF-1** and **Phase PF-2** from this entitlement audit so package features and backend access are trustworthy.

My recommendation for order:

1. Fix canonical entitlement normalization and AI mismatch.
2. Add backend feature/resource route guards.
3. Make tenant sidebar and direct page access package-aware.
4. Align admin package builder fields with real tenant capabilities.
5. Add package entitlement QA test cases.
6. Build the package consumption table and near-limit alerts as the final enhancement phase.
