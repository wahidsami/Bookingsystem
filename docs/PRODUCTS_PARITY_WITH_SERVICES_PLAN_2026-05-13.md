# Products Parity Plan With Services (2026-05-13)

## Goal
Bring `Products` pages to the same UX/architecture level as `Services` pages:
- `services/page.tsx` parity with `products/page.tsx`
- `services/new/page.tsx` parity with `products/new/page.tsx`

## Current Gap Summary

### Main list page gap (`products/page.tsx` vs `services/page.tsx`)
- Services has richer filter model (`filterMode` + category chips + sort modes); products still uses basic filters only.
- Services has stronger action UX (icon actions, status toggle confirm dialogs, better success/error handling); products has basic delete + alerts.
- Services has improved cards and status tagging consistency; products uses older card styling and ad-hoc emoji labels.
- Services uses `useMemo` for filtering/sorting/category grouping; products loads via API each filter change.
- Services page supports cleaner empty states and toolbar behavior; products page is simpler and less consistent.

### New page gap (`products/new/page.tsx` vs `services/new/page.tsx`)
- Services uses modular editor frame:
  - `ServiceEditorFrame`
  - section progress
  - sticky section nav
  - structured form sections
- Products new page is monolithic.
- Services has stronger team/assignment/policy setup flow; products form structure is older.
- Services has clearer field grouping and progressive completion; products has long single-form layout.

## Implementation Strategy

## Phase 1: Shared UX Baseline for Products Main Page
- [ ] Introduce products filter mode model like services:
  - `all`, `available`, `unavailable`, `featured`, `in_stock`, `low_stock`, `out_of_stock`, `az`, `za`, `newest`, `oldest`
- [ ] Move filtering/sorting to client `useMemo` pipeline (like services) after loading product list.
- [ ] Add category chip strip with counts (same interaction pattern as services categories).
- [ ] Keep search local and instant (no API reload on each keystroke).
- [ ] Preserve API query support but default to single load + local filtering for responsiveness.

## Phase 2: Products Main Page Action Parity
- [ ] Add active toggle action with confirmation dialog (`isAvailable` toggle) matching service status toggle UX.
- [ ] Standardize action buttons to icon style:
  - edit
  - availability toggle
  - delete
- [ ] Replace browser `alert` with app dialogs (`useAppDialog`) for all product actions.
- [ ] Add consistent success/failure dialog copy in EN/AR.
- [ ] Ensure subscription limit presentation matches services visual pattern.

## Phase 3: Products Main Page Visual Parity
- [ ] Upgrade header/tooling section to match services hierarchy.
- [ ] Align card structure with services density and metadata badges:
  - availability badge
  - stock status badge
  - featured badge
  - category tag
- [ ] Improve empty state and CTA consistency with services style.
- [ ] Remove emoji-based labels and use icon components for consistency.

## Phase 4: New Product Page Structural Refactor
- [ ] Create product editor shell components mirroring service architecture:
  - `ProductEditorFrame`
  - `ProductEditorSection`
- [ ] Split form into sections:
  - basic info
  - pricing and stock
  - merchandising (brand/size/color/category)
  - content (description/features/ingredients/how-to-use)
  - media
  - availability and fulfillment
- [ ] Add section progress summary and click-to-scroll section navigation.
- [ ] Keep AI helper block, but reposition into clear section with mode state and feedback.

## Phase 5: New Product Page Behavior Parity
- [ ] Preserve current product-specific validations:
  - at least one image
  - max images (current max = 5)
  - stock and price constraints
- [ ] Standardize submit error/success handling (dialog + inline message strategy as used in services).
- [ ] Improve cancel/back behavior consistency with services pattern.
- [ ] Ensure form field defaults and persistence behavior are predictable after failed submit.

## Phase 6: Optional Reuse and Cleanup
- [ ] Extract shared helper patterns for services/products:
  - sort and filter option rendering
  - status badges
  - image fallback behavior
- [ ] Normalize category source:
  - short term: keep existing product categories list
  - future: move to backend-driven product categories (like services categories).

## Acceptance Criteria
- [ ] Products main page feels functionally equivalent to services main page in filtering, sorting, actions, and visual quality.
- [ ] New product page uses sectioned editor flow with progress/anchors similar to new service page.
- [ ] No regression in product creation payload and image upload behavior.
- [ ] EN/AR layout and copy quality preserved (RTL/LTR behavior intact).
- [ ] Tenant build passes.

## Rollout Plan
1. Refactor `products/page.tsx` first (safe, high-impact UX).
2. Refactor `products/new/page.tsx` with new editor components.
3. Validate create/edit/delete/toggle + limits.
4. Deploy tenant dashboard.

## Files Expected To Change
- `tenant/src/app/[locale]/dashboard/products/page.tsx`
- `tenant/src/app/[locale]/dashboard/products/new/page.tsx`
- `tenant/src/components/ProductEditorFrame.tsx` (new)
- `tenant/src/components/ProductPricingSection.tsx` (new, if needed)
- `tenant/src/components/ProductMediaSection.tsx` (new, if needed)
- `tenant/src/components/ProductContentSection.tsx` (new, if needed)

## Notes
- Keep backend API contract unchanged in this phase.
- This is a UI/UX and frontend architecture parity pass, not a pricing engine rewrite.
