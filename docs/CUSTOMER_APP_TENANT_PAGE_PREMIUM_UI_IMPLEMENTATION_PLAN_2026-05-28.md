# Customer App Tenant Page Premium UI Implementation Plan (2026-05-28)

## Objective
Rebuild `RifahMobile/src/screens/TenantScreen.tsx` to match the premium tenant-page UX direction:
- luxury, calm, clean, booking-oriented
- hero-first brand experience
- sticky tabs with focused conversion path
- premium service cards
- safe-area compliant layout with persistent bottom navigation

## Current Screen Mapping (Existing Structure)
- Main screen file: `RifahMobile/src/screens/TenantScreen.tsx`
- Existing tabs: `services | products | gifts | reviews | about`
- Existing render blocks:
  - `renderHero`
  - `renderTabs`
  - `renderServices`
  - `renderGifts`
  - `renderReviews`
  - `renderAbout`
- Existing data sources:
  - tenant public profile
  - page-data sections flags
  - services/products/staff/gifts/reviews APIs

## Scope Decisions
1. Keep business logic and APIs intact.
2. Rebuild visual structure and interaction hierarchy.
3. Keep `Products` internally supported but not shown in primary tab order for this redesign.
4. Primary tab order becomes:
   - Services
   - Gift Cards
   - Reviews
   - About
5. Preserve current navigation flows (service details, gifts flow, review prompt, share, favorites where available).

## Target Layout Blueprint
1. Hero Header Section
2. Floating identity card block (logo, title, subtitle, meta, chips)
3. Sticky tab bar
4. Tab content area
5. Bottom-safe scroll spacing for persistent app navbar

## Phase Plan

### Phase 1 - Foundation + Tokens
Status: `completed`

Tasks:
1. Add tenant-page-specific style tokens inside the screen (spacing, radius, elevation presets).
2. Add reusable local helpers:
   - chip renderer
   - meta row item renderer
   - empty/loading block renderer
3. Normalize image fallbacks for hero/logo/service cards.
4. Set bottom scroll padding floor to avoid overlap with bottom navbar (`>= 120px effective`).

Acceptance:
- No feature regression.
- Visual constants centralized and readable.

---

### Phase 2 - Hero Rebuild
Status: `completed`

Tasks:
1. Rebuild `renderHero` into:
   - cover image block (rounded bottom corners)
   - top floating actions (back/share/favorite placeholders as available)
   - centered overlapping logo
   - floating white info card
2. Info card content:
   - tenant name (with optional verified badge position)
   - subtitle/description
   - meta row (rating/location/distance when available)
   - max 3 chips visible (open status/category/premium)
3. Keep image and text fallbacks stable when fields are missing.

Acceptance:
- Hero visually matches premium direction.
- Logo overlap and action buttons are responsive on small/large devices.

---

### Phase 3 - Sticky Tabs + Behavior
Status: `completed`

Tasks:
1. Update visible tab set and order:
   - Services, Gift Cards, Reviews, About
2. Add sticky tab behavior while scrolling.
3. Active tab style:
   - purple active text
   - animated underline indicator
4. Hide tabs conditionally if section disabled/no data.

Acceptance:
- Tabs remain accessible during scroll.
- Active indicator and state transitions are smooth.

---

### Phase 4 - Services Tab Premium Cards
Status: `completed`

Tasks:
1. Build services section header:
   - title + subtitle
   - filter button shell (UI first, wire behavior to existing options later if needed)
2. Rebuild service cards:
   - left image
   - title
   - two-line description
   - duration + price row
   - right arrow CTA button
3. Make entire card tappable.
4. Add loading skeleton and premium empty state copy.

Acceptance:
- Services tab is default conversion path.
- Cards are premium and readable in EN/AR.

---

### Phase 5 - Gift Cards / Reviews / About Visual Alignment
Status: `completed`

Tasks:
1. Bring Gift Cards tab visual language in line with services card system.
2. Keep gift card image, title, description, price/credit clear and consistent.
3. Update Reviews and About sections to match spacing/typography system.
4. Standardize section paddings and card shadows.

Acceptance:
- Non-services tabs feel part of same design system.

---

### Phase 6 - Motion + Polish
Status: `completed`

Tasks:
1. Add subtle entry animation to hero/cards.
2. Add micro-interaction scale feedback (`~0.97`) on pressable cards/buttons.
3. Add sticky-tab shadow transition on stick start.
4. Validate iOS/Android safe areas.

Acceptance:
- Motion is smooth and not heavy.
- No jank on mid-range Android.

---

### Phase 7 - QA + Regression Pass
Status: `completed`

Tasks:
1. Validate flows:
   - open tenant
   - open service detail
   - add booking
   - open gifts page
   - open reviews/about
2. Validate EN/AR layout and truncation.
3. Validate network states (loading, error, empty).
4. Run typecheck/build checks.

Acceptance:
- No broken navigation or API handling.
- UI stable across typical devices.

## Non-Goals (This Iteration)
1. Backend API changes.
2. Reworking checkout/payment logic.
3. Replacing bottom app navigation structure.

## Risks + Mitigations
1. Risk: long Arabic strings break hero rows
   - Mitigation: clamp text and allow wrap where needed.
2. Risk: sticky tab conflicts with scroll nesting
   - Mitigation: single parent scroll strategy.
3. Risk: image-heavy cards impact performance
   - Mitigation: constrained dimensions and fallback placeholders.

## Execution Order
1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6
7. Phase 7

## Milestone Tracker
- [x] Phase 1 - Foundation + Tokens
- [x] Phase 2 - Hero Rebuild
- [x] Phase 3 - Sticky Tabs + Behavior
- [x] Phase 4 - Services Tab Premium Cards
- [x] Phase 5 - Gift Cards / Reviews / About Visual Alignment
- [x] Phase 6 - Motion + Polish
- [x] Phase 7 - QA + Regression Pass
