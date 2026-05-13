# Tenant Dashboard - Page Setup Implementation Plan

## 1) Goal
Enable each tenant to control what appears on their public/mobile tenant page from the dashboard, through a new section:

- `Marketing` -> `Page Setup`

This includes:
- Show/hide page tabs (`Services`, `Products`, `Reviews`, `About`)
- Configure About content blocks
- Keep text inputs single-field (no forced EN/AR split), so tenant admin can write in any language

---

## 2) Scope

### In Scope
1. New dashboard area: `Marketing -> Page Setup`
2. Section visibility toggles for tenant page tabs
3. About section builder (content + media + location/contact blocks)
4. Mobile app rendering based on tenant configuration
5. Backward-compatible migration from current/legacy public-page settings

### Out of Scope (Phase 1)
1. Full public web template redesign
2. AI-generated about content redesign
3. Advanced per-language content fields (EN/AR split editors)

---

## 3) Current State (Audit Summary)

1. Mobile tenant tabs are fixed in code (`services/products/reviews/about`), and reviews is effectively disabled by logic.
2. Dashboard General Settings has partial section toggles (`heroSlider/services/products/callToAction`) and does not cleanly expose `about/reviews`.
3. About data model already exists and is rich (story, missions, visions, values, facilities, final word), but mobile only renders part of it.
4. Tenant profile data (address, map, working hours, contact/social) exists in tenant settings and can be reused in About.

---

## 4) Target UX

## 4.1 Dashboard Navigation
- Add menu item: `Marketing -> Page Setup`
- Keep existing `My Page` for backward compatibility during rollout; eventually merge/deprecate duplicate controls.

## 4.2 Page Setup Tabs (inside dashboard page)
1. `Tab Visibility`
2. `About Content`
3. `Location & Contact`
4. `Media`

## 4.3 Tab Visibility (toggles)
- `Show Services`
- `Show Products`
- `Show Reviews`
- `Show About`

Rules:
1. At least one tab must remain enabled.
2. If currently active tab is disabled, mobile falls back to first enabled tab.

## 4.4 About Content Blocks
- `About Text` (single textarea)
- Optional repeatable cards:
  - `Highlights` (instead of strict Mission/Vision naming if preferred)
  - Each card: title + description + optional icon/image
- `Final Note` (optional short text)

Single-language policy:
1. One text field per content item.
2. Tenant can write Arabic, English, or mixed text freely.
3. No forced duplicated inputs (`...En/...Ar`) in the new UI.

## 4.5 Location & Contact
- `Address text`
- `Google Map URL`
- `Phone`
- `Email`
- `Website`
- Social links (IG, TikTok, X, etc.)

## 4.6 Media
- `About gallery images` (center photos)
- Max images (recommended): 10
- Reorder + remove support

---

## 5) Data Model Strategy

Use `PublicPageData.generalSettings` as source of truth for section visibility + page setup layout config, and add a new JSON object for simplified content.

Recommended shape:

```json
{
  "generalSettings": {
    "sections": {
      "services": true,
      "products": true,
      "reviews": false,
      "about": true,
      "heroSlider": true
    }
  },
  "mobilePageSetup": {
    "aboutText": "string",
    "highlights": [
      {
        "id": "uuid-or-temp",
        "title": "string",
        "description": "string",
        "type": "icon|image",
        "iconName": "string|null",
        "imageUrl": "string|null"
      }
    ],
    "finalNote": "string",
    "galleryImages": ["path1", "path2"],
    "location": {
      "addressText": "string",
      "googleMapUrl": "string"
    },
    "contact": {
      "phone": "string",
      "email": "string",
      "website": "string",
      "social": {
        "instagram": "url",
        "tiktok": "url",
        "twitter": "url",
        "linkedin": "url",
        "youtube": "url",
        "snapchat": "url"
      }
    }
  }
}
```

Notes:
1. Keep existing legacy `aboutUs_*` columns readable for backward compatibility.
2. For Phase 1, we can store new content under JSON while still exposing old fields to old screens.

---

## 6) API Changes

## 6.1 Tenant APIs (Dashboard)
Extend existing public-page endpoints:
- `GET /api/v1/tenant/public-page`
- `PUT /api/v1/tenant/public-page`

Add/normalize in response:
- `generalSettings.sections.reviews`
- `generalSettings.sections.about`
- `mobilePageSetup` object

## 6.2 Public APIs (Mobile consumption)
Current:
- `GET /api/v1/public/tenant/:tenantId/page-data`

Ensure response contains normalized:
- `generalSettings.sections` with all keys
- `mobilePageSetup`
- fallback fields mapped from legacy if missing

---

## 7) Mobile App Changes

In tenant page screen:
1. Read tab visibility from `generalSettings.sections`.
2. Render only enabled tabs.
3. Remove hardcoded review disable behavior.
4. Render About from `mobilePageSetup` first; fallback to legacy data if absent.
5. Keep robust fallback so old tenants still display content.

---

## 8) Migration Plan

For existing tenants:
1. If `generalSettings.sections.about` missing -> default `true`
2. If `generalSettings.sections.reviews` missing -> default `false` (or business decision: `true`)
3. Map legacy data into new `mobilePageSetup` when absent:
   - `aboutText` from existing story/description
   - `galleryImages` from existing facilities images
   - `location/contact` from tenant profile fields
4. Keep old fields untouched to avoid regression.

---

## 9) Rollout Phases

## Phase 1 (Recommended immediate)
1. Add `Marketing -> Page Setup` screen in tenant dashboard
2. Add tab toggles (`services/products/reviews/about`)
3. Add simplified About single-language editor + gallery + map/address/contact
4. Update mobile tenant page to consume visibility + simplified about

## Phase 2
1. Optional advanced blocks (rich cards, reorder)
2. Reviews tab full feed behavior refinement
3. Migrate/deprecate old duplicate About editor screens

---

## 10) QA Checklist

1. Toggle each tab on/off independently.
2. Ensure at least one tab remains enabled.
3. Verify mobile fallback when active tab disabled.
4. Verify About rendering with:
   - only text
   - text + gallery
   - map only
   - contact/social only
5. Verify mixed-language input (Arabic/English in same field).
6. Verify old tenants still render with legacy data.

---

## 11) Product Decisions Needed

1. Default `reviews` visibility for existing tenants:
   - Option A: `false` (safe)
   - Option B: `true` (more discovery)
2. Naming in UI:
   - `Mission/Vision/Values` vs neutral `Highlights`
3. Keep old `My Page` editor visible during transition or hide after Phase 1.

---

## 12) Recommendation

Proceed with `Phase 1` now using `mobilePageSetup` + normalized `sections` and single-language fields.
This gives immediate tenant control, reduces content complexity, and avoids breaking current data.
