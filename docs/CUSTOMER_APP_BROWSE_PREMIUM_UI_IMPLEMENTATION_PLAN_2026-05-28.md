# Customer App Browse Premium UI Implementation Plan (2026-05-28)

## Scope
Rebuild `BrowseScreen` in customer app into a premium wellness-discovery experience aligned with updated Tenant/Service UI direction.

## Goals
- Replace list-directory feel with editorial luxury layout.
- Preserve existing filtering logic (category + search).
- Keep navigation behavior intact (`Browse -> Tenant`).
- Provide strong RTL parity (AR/LTR mirror-safe).

## Phase Tracker

## Phase 1 - Hero + Search + Structure
- Status: `Completed`
- Tasks:
- Add immersive hero section with background image and gradient overlay.
- Add floating search bar overlapping hero/content.
- Add dynamic category title and emotional subtitle.
- Keep back navigation and safe area behavior.
- Exit Criteria:
- Page opens with new hero-first layout.
- Search input still updates results.

## Phase 2 - Category Chips + Featured Section Header
- Status: `Completed`
- Tasks:
- Load categories for horizontal chips row.
- Highlight active category chip.
- Support quick category switching from chips.
- Add featured section heading/subheading.
- Exit Criteria:
- Chip tap updates listing/filter instantly.
- Selected chip visual state is clear.

## Phase 3 - Premium Tenant Cards
- Status: `Completed`
- Tasks:
- Replace simple cards with premium editorial cards.
- Add hero image, optional floating logo, metadata row, business type pill, description, CTA arrow.
- Keep click-through to tenant page.
- Exit Criteria:
- Cards feel premium and still navigate correctly.

## Phase 4 - Support States + Trust Banner + Bottom Bar
- Status: `Completed`
- Tasks:
- Improve loading/empty states with better messaging.
- Add trust information banner.
- Add local bottom nav-style bar for visual continuity while on stack screen.
- Exit Criteria:
- UX complete with non-empty/empty/loading coverage.
- Bottom bar actions route correctly.

## Phase 5 - Polish + RTL QA
- Status: `Completed`
- Tasks:
- Tune spacing, typography rhythm, shadows.
- Verify RTL/LTR mirroring and alignment.
- Verify no functional regression in search/category/tenant open flows.
- Exit Criteria:
- Layout and interactions are stable in EN/AR.

## Notes
- No backend schema/API changes required.
- If any tenant field is missing (rating/description/image), use graceful fallback UI.
