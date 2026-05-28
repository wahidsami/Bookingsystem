# Customer App Critical Surgical Fix Plan (2026-05-29)

## Objective
Resolve 8 critical customer app issues with a phased, low-risk, verifiable rollout, preserving premium UX and preventing regressions in multilingual layout behavior.

## Scope
- App: `RifahMobile`
- Affected areas:
  - Tenant page (`Services`, `Gift Cards`, `Reviews`)
  - Product details page
  - Global language/layout direction behavior (LTR/RTL)
  - Review submission flow and review identity rendering

## Critical Issues (From QA)
1. Services images under tenant page are not loading despite uploaded tenant images.
2. Services filter button shows "upcoming soon" with no real filter options.
3. Product details page CTA (`Add to cart`) positioning/layout clipping.
4. Arabic RTL broken in Services cards under tenant page.
5. Arabic RTL broken in Gift Cards cards under tenant page + untranslated strings remain.
6. Language switch AR/EN changes text but not full layout direction (stays RTL).
7. Review drawer star picker interaction is broken; reviewer name appears as "Valued customer".
8. Tenant reply label should be `<Tenant Name> reply` instead of generic `Center reply`.

---

## Delivery Strategy
- Surgical phases with hard acceptance gates.
- Each phase: implement + self-test + commit.
- Avoid broad refactors; target only affected modules.
- Keep UI parity with premium design system.

---

## Phase 0 - Baseline & Impact Mapping
### Goal
Freeze current behavior and map exact files/endpoints before edits.

### Tasks
- Capture affected screens/components and translation keys.
- Map image URL pipeline for services and gifts.
- Map language direction sources (`I18nManager`, context, navigator wrappers, card container styles).
- Map review write/read API payload and response fields (customer display name, tenant reply label).

### Deliverables
- File list + API list + risk notes.

### Exit Criteria
- All impacted files/endpoints identified with no ambiguity.

---

## Phase 1 - Tenant Services Image Loading Fix
### Goal
Ensure service images always render when uploaded, with stable fallback behavior.

### Suspected Root Causes
- Inconsistent image field mapping (`image`, `imageUrl`, `thumbnail`, `media`).
- Improper URL normalization (`getImageUrl` not applied in all branches).
- Fallback overriding valid URLs due to load-error state caching.

### Tasks
- Normalize service image resolution order in tenant services cards.
- Ensure `getImageUrl` usage is consistent across service card and details.
- Fix `onError` cache behavior so one failed candidate does not block future valid URLs.
- Add premium fallback tile (non-empty visual).

### Acceptance Criteria
- Uploaded service images appear in tenant services list and service details.
- Broken/empty images show graceful fallback, no blank boxes.

---

## Phase 2 - Services Filter Implementation
### Goal
Replace placeholder filter with real actionable filters.

### Initial Filter Set (MVP)
- Duration: short/medium/long
- Price: low-to-high / high-to-low
- Availability hint: available today / all
- Category (if tenant has service categories)

### Tasks
- Build filter modal/sheet with premium UI.
- Implement local filtering/sorting over loaded services.
- Persist active filter state while tab is open.
- Add "Clear filters".

### Acceptance Criteria
- Filter button opens working filter UI.
- Applying filters changes services immediately.
- No "upcoming soon" placeholder remains.

---

## Phase 3 - Product Details Layout/CTA Correction
### Goal
Fix clipping and ensure bottom CTA is anchored and safe-area aware.

### Tasks
- Convert page to scrollable content + fixed bottom CTA container.
- Add bottom spacer to avoid overlap with gesture/nav bar.
- Ensure all product content is visible before CTA.
- Validate on small-height devices.

### Acceptance Criteria
- `Add to cart` is always visible and properly positioned.
- Product content is fully visible with no clipping.

---

## Phase 4 - RTL/LTR Card Mirroring (Services + Gift Cards)
### Goal
Enforce proper mirrored card layout in Arabic.

### Rules
- English: media left, content right.
- Arabic: media right, content left.
- Text alignment, icon placement, spacing order must mirror.

### Tasks
- Patch Services card row direction based on language direction.
- Patch Gift Cards card row direction similarly.
- Validate paddings, arrows, metadata rows in both directions.
- Remove mixed-direction artifacts.

### Acceptance Criteria
- Arabic cards visually mirror English cards correctly.
- No crowded/misaligned text in Arabic cards.

---

## Phase 5 - Global Direction Switching Reliability
### Goal
Fix language switch so layout direction actually changes app-wide (not just text).

### Tasks
- Audit direction propagation path from language switch action.
- Ensure direction-aware containers reactively update on language change.
- Handle navigator/screen remount strategy if required for direction flip.
- Validate core screens: Home, Tenant, Appointments, Gifts, Product details.

### Acceptance Criteria
- AR->EN returns full LTR layout.
- EN->AR returns full RTL layout.
- No stale direction state after switch.

---

## Phase 6 - Review UX and Identity Fixes
### Goal
Repair star interaction and correct reviewer/reply labeling.

### Tasks
- Fix star picker state binding in review drawer (tap feedback + selected state).
- Ensure selected stars visibly highlight before submit.
- Ensure reviewer name is resolved from customer profile/account and rendered (fallback only if truly missing).
- Replace `Center reply` label with `<Tenant Name> reply`.
- Verify Arabic/English localization for labels.

### Acceptance Criteria
- Star selection visually works before submission.
- New reviews show real reviewer name when available.
- Tenant replies display `<Tenant Name> reply`.

---

## Phase 7 - Localization Cleanup Sweep
### Goal
Remove leftover English strings in Arabic mode from touched flows.

### Tasks
- Scan touched screens for hardcoded labels.
- Add missing translation keys and Arabic values.
- Validate in AR mode end-to-end.

### Acceptance Criteria
- No obvious English remnants in Arabic for touched modules.

---

## Phase 8 - Regression & Release Gate
### Goal
Ship with confidence.

### Test Matrix
- Devices: small + medium screens
- Locales: AR and EN
- Flows:
  - Tenant -> Services images and filters
  - Tenant -> Gift cards rendering
  - Product details -> content + CTA
  - Language switch AR/EN direction flip
  - Review create -> star interaction -> display identity
  - Tenant reply label rendering

### Exit Criteria
- All 8 critical issues pass.
- No blocker regressions in tenant page navigation and booking flow.

---

## Implementation Order (Strict)
1. Phase 0
2. Phase 1
3. Phase 4
4. Phase 5
5. Phase 2
6. Phase 3
7. Phase 6
8. Phase 7
9. Phase 8

Reason: fix data/display correctness and direction framework first, then UX enhancements.

---

## Risk Notes
- Direction switching may require navigator remount strategy.
- Reviewer identity may require backend payload check if missing user fields.
- Service image issue may involve backend media field inconsistency; UI fallback logic must handle multiple shapes safely.

---

## Tracking Checklist
- [x] Phase 0 complete
- [x] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete
- [ ] Phase 5 complete
- [ ] Phase 6 complete
- [ ] Phase 7 complete
- [ ] Phase 8 complete

---

## Progress Log
### 2026-05-29 - Phase 0 Completed
- Impact mapping confirmed:
  - Services cards: `RifahMobile/src/screens/TenantScreen.tsx`
  - Service details hero media: `RifahMobile/src/screens/ServiceDetailsScreen.tsx`
  - Service data normalization contract: `RifahMobile/src/api/client.ts`
- Observed root issue: service images rendered only from one field branch (`image`) in services tab.
- Confirmed backend payload variability risk (`image`, `imageUrl`, `images`, `thumbnail`, `coverImage`, `media`).

### 2026-05-29 - Phase 1 Completed
- Implemented robust service media normalization in `RifahMobile/src/api/client.ts`:
  - Added optional media fields to `Service` interface: `image`, `imageUrl`, `images`, `thumbnail`, `coverImage`, `media`.
  - Extended `normalizeService` to consistently normalize all these fields.
- Implemented resilient image resolver in services tab:
  - `RifahMobile/src/screens/TenantScreen.tsx`
  - Added ordered media candidate resolution and stable image fallback behavior.
  - Added per-service load-error map to avoid blank UI and preserve fallback tiles.
- Hardened service details hero media fallback:
  - `RifahMobile/src/screens/ServiceDetailsScreen.tsx`
  - Hero now resolves from full candidate set (not only `image`), then tenant cover/logo, then final static fallback.
