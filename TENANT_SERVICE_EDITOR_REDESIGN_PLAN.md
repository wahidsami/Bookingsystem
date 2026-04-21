# Tenant Service Editor Redesign Plan

## Goal
Rebuild the tenant service add/edit experience into one shared, section-based editor that mirrors the Teams editor pattern, while preserving existing service management, pricing, employee assignment, and customer booking behavior.

## Current State
- The tenant services list already uses a two-pane category + service card layout.
- Add/edit service pages still use the older long form layout.
- Current service data already supports:
  - category
  - target audience
  - image
  - offers and gifts
  - active/inactive
  - duration
  - pricing fields
  - employee assignment
- The backend already calculates service pricing from final/raw price using global tax and commission settings.
- The customer app currently uses tenant-level payment settings, not per-service payment options.

## Target Layout
- Split add/edit service into two halves.
- Left half: vertical section list, acting like tabs.
- Right half: active section content only.
- Save and Cancel stay at the top.
- Add a completion meter per section.
- Arabic layout mirrors the same structure:
  - section list on the right
  - content on the left
  - labels and alignment mirrored

## Sections

### 1. Basic Information
Fields:
- service name
- description
- category dropdown
- target audience dropdown
- pricing subsection

Pricing subsection:
- price type dropdown: `free` / `fixed`
- price field: final total price
- duration field in minutes
- eye icon for price breakdown
- options icon with menu:
  - Add variant
  - Advanced pricing and duration

Variant behavior:
- Add variant opens a popup with:
  - title
  - description
  - duration
  - price
  - Add / Cancel
- Variants appear below the pricing block.
- Each variant should support:
  - eye icon for price breakdown
  - active/inactive toggle
  - delete action

### 2. Team
Fields:
- list of all active service providers
- checkbox per employee
- employee avatar
- employee name
- commission checkbox

Commission behavior:
- when enabled, show commission type dropdown:
  - fixed
  - percentage
- then show the value input
- the commission value should reduce the service price breakdown for the main service or selected variant

### 3. Service Options
Fields:
- service image upload
- `hasOffer`
- `hasGift`

Notes:
- These already exist in the backend and should be surfaced more cleanly in the new layout.

### 4. Settings
Fields:
- service payment options:
  - up to 3 checkboxes
  - one, two, or all three options can be enabled
- service status:
  - active / inactive

Notes:
- This is separate from tenant-level payment settings.
- The customer app should read service-level payment options first, then fall back to tenant defaults if needed.

## Database Changes Likely Needed
Likely required:
- `priceType` on `services`
- `paymentOptions` on `services` as `JSONB`
- `variants` storage for services
  - either `service_variants` table or a `variants` JSONB field
- per-employee service commission fields
  - likely in `service_employees`
    - `commissionType`
    - `commissionValue`
    - `commissionPercent`

Likely not required:
- schedule tables
- offer/gift persistence
- existing service status fields
- current service category tables

## Customer App Impact
Current behavior:
- booking payment options come from tenant-level payment settings
- service selection does not yet filter or override payment options per service

Target behavior:
- service-level payment options should control what the customer sees during booking
- if a service defines payment options, those should take precedence
- if not, fall back to tenant payment settings
- when a variant is selected, its price and duration should override the base service

Touch points:
- `server/src/controllers/publicTenantController.js`
- `RifahMobile/src/screens/BookingFlow.tsx`
- `RifahMobile/src/api/client.ts`
- possibly booking validation in the booking controller or shared booking service

## Implementation Order
1. Extract a shared service editor shell for add/edit.
2. Build the section navigator and top action bar.
3. Move current service fields into the new section structure.
4. Add the variant popup and variant list.
5. Add per-employee commission controls in Team.
6. Add service payment options in Settings.
7. Add the minimum database migrations needed.
8. Wire the public API and customer app to respect per-service payment options.
9. Verify Arabic and English layouts separately.
10. Confirm save-as-draft behavior for every section.

## Safety Notes
- Keep the existing service create/update endpoints intact where possible.
- Avoid changing booking payment behavior until the service payload is ready.
- Prefer explicit DB columns/tables for fields that need filtering or future reporting.
- Keep add/edit pages on the same shared component path to avoid drift.

## Reference Files
- `tenant/src/app/[locale]/dashboard/services/new/page.tsx`
- `tenant/src/app/[locale]/dashboard/services/[id]/page.tsx`
- `tenant/src/app/[locale]/dashboard/services/page.tsx`
- `tenant/src/components/TenantLayout.tsx`
- `server/src/controllers/tenantServiceController.js`
- `server/src/controllers/publicTenantController.js`
- `server/src/models/Service.js`
- `server/src/models/ServiceEmployee.js`
- `RifahMobile/src/screens/BookingFlow.tsx`
- `RifahMobile/src/api/client.ts`
