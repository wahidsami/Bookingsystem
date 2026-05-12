# Mobile Backend Contract Audit
Date: 2026-04-09

## Scope
- `RifahMobile`
- `RifahStaff`
- Backend route mounts under `server/src/index.js`
- Current backend route/controller contracts under `server/src/routes/*` and selected controllers

## Executive Summary
- `RifahMobile` is **mostly wired correctly** to the backend. Its main issues are runtime/data-shape safety and one missing optional content endpoint.
- `RifahStaff` is **not fully aligned** with the current backend contract. Login and base URL are correct, but multiple feature modules still call endpoints the backend does not expose.
- The highest-value path is:
  1. keep stabilizing `RifahMobile` runtime/data normalization
  2. rewire `RifahStaff` service modules to the real `/api/v1/staff/*` contract
  3. either restore missing backend endpoints or remove unsupported staff-app sections

## Backend Mount Prefixes
From `server/src/index.js`:

| Prefix | Mounted Routes |
| --- | --- |
| `/api/v1/auth/user` | `userAuthRoutes.js` |
| `/api/v1/staff` | `staffRoutes.js` |
| `/api/v1/users` | `userRoutes.js` |
| `/api/v1/bookings` | `bookingRoutes.js` |
| `/api/v1/orders` | `orderRoutes.js` |
| `/api/v1/payments` | `paymentRoutes.js` |
| `/api/v1/public` | `publicRoutes.js` |
| `/api/v1` | `hotDealsRoutes.js`, `featuredRoutes.js` |
| `/api/v1/tenants` | public tenant listing shortcut |
| `/api/v1/categories` | public categories shortcut |

## RifahMobile Contract Audit

### Aligned Endpoints
These app calls match real backend routes and are structurally sound:

| App Call | Backend Route | Notes |
| --- | --- | --- |
| `/auth/user/login` | `userAuthRoutes.js` | Correct |
| `/auth/user/register` | `userAuthRoutes.js` | Correct |
| `/auth/user/refresh-token` | `userAuthRoutes.js` | Correct |
| `/auth/user/forgot-password` | `userAuthRoutes.js` | Correct |
| `/users/profile` | `userRoutes.js` | Correct |
| `/users/push-token` | `userRoutes.js` | Correct |
| `/bookings` | `bookingRoutes.js` | Correct mount |
| `/bookings/:id` | `bookingRoutes.js` | Correct |
| `/bookings/:id/cancel` | `bookingRoutes.js` | Correct |
| `/orders` | `orderRoutes.js` | Correct |
| `/orders/:id` | `orderRoutes.js` | Correct |
| `/orders/:id/cancel` | `orderRoutes.js` | Correct |
| `/payments/process` | `paymentRoutes.js` | Correct |
| `/hot-deals` | `hotDealsRoutes.js` | Correct |
| `/featured-tenants` | `featuredRoutes.js` | Correct |
| `/public/providers/top` | `publicRoutes.js` | Correct |
| `/tenants` | shortcut in `index.js` | Correct |
| `/categories` | shortcut in `index.js` | Correct |

### Contract Risks / Data-Shape Risks

#### 1. Hot deals decimal fields can arrive as strings
- Source: Postgres decimals are often serialized as strings by Sequelize.
- Symptom: runtime failures when UI uses `.toFixed()` directly.
- Status: already partially mitigated by normalizing values in `RifahMobile/src/api/client.ts`.
- Priority: high

#### 2. `getCustomerAppContent()` calls a route missing in the current backend tree
- App call: `/public/apps-center/customer-app`
- Current backend search result: no active Apps Center public route found in `server/src`
- Effect:
  - `More` and `InfoPage` do not hard-fail because the client catches errors and falls back
  - dynamic content/social/legal pages will silently use fallback text or cache instead of fresh server content
- Priority: medium

#### 3. Categories semantics are “public business categories”, not service categories
- App expects `ServiceCategory[]`
- Backend `/api/v1/categories` currently returns categories derived from active tenant business types in `publicTenantController.getPublicCategories`
- This still works visually, but the naming is misleading and could confuse later filtering logic
- Priority: medium

#### 4. Discovery lists rely on generic public tenant payloads
- `getNewTenants()` simply slices `/tenants`
- `getTrendingTenants()` reads `/featured-tenants`
- This is valid, but “new” and “trending” are not backed by strong dedicated server ranking logic today
- Priority: low

### Response Expectations That Are Currently Safe
- `getBookings()` expects `{ success, appointments }`
- `getOrders()` expects `{ success, orders }`
- `getTopProviders()` expects `{ success?, staff? }`
- `getHotDeals()` expects `{ success, deals }`
- These line up with the current backend response shapes closely enough.

## RifahStaff Contract Audit

### Correctly Wired Areas

| Area | Status | Notes |
| --- | --- | --- |
| API base URL | Correct | Points to `https://rapi.unifinitylab.com/api/v1` |
| Login route | Correct | `/staff/auth/login` |
| Refresh route | Correct | `/staff/auth/refresh-token` |
| Logout route | Correct | `/staff/auth/logout` |
| Session restore | Correct | `/staff/me` |
| Change password | Correct | `/staff/me/password` |

### Major Route Mismatches
These app services still call endpoints the backend does not expose:

| RifahStaff Call | Current App File | Backend Reality | Result |
| --- | --- | --- | --- |
| `/staff/me/appointments/today` | `src/services/appointments.ts` | backend exposes `/staff/appointments?date=YYYY-MM-DD` | Broken |
| `/staff/me/appointments/:id/status` | `src/services/appointments.ts` | backend exposes `/staff/appointments/:id/status` | Broken |
| `/staff/me/schedule?...` | `src/services/schedule.ts` | backend exposes `/staff/schedule?date=...` | Broken |
| `/staff/me/time-off` | `src/services/schedule.ts` | no backend route found | Broken |
| `/staff/me/messages` | `src/services/messages.ts` | no backend route found | Broken |
| `/staff/me/messages/:id/read` | `src/services/messages.ts` | no backend route found | Broken |
| `/staff/me/fcm-token` | `src/services/messages.ts` | backend exposes `/staff/me/push-token`, not FCM token | Broken |
| `/staff/me/earnings` | `src/services/financials.ts` | no backend route found | Broken |
| `/staff/me/reviews` | `src/services/financials.ts` | no backend route found | Broken |
| `/staff/me/reviews/:id/reply` | `src/services/financials.ts` | no backend route found | Broken |

### Response Shape Mismatches

#### Appointments service
`RifahStaff/src/services/appointments.ts` expects:
- `response.data.data`
- statuses like `started` and `no-show`

Backend `staffAppController.js` actually returns:
- `{ success, appointments, date }`
- status vocabulary aligned with backend appointment state, including `checked_in`, `in_service`, `completed`, `no_show`

This means the staff app can still break even if the route path is corrected unless the parsing logic is updated too.

#### Schedule service
`RifahStaff/src/services/schedule.ts` expects:
- `{ success, data: { shifts, timeOff } }`

Backend `/staff/schedule` currently returns a different shape based on `staffAppController.getSchedule`
- app and backend need a concrete shared schema before this screen can be reliable

### Authentication Reality Check
Even with correct routes, staff login can still be rejected if:
- there is no `User` row with `role = 'staff'`
- the `Staff` profile is not linked by matching tenant + email
- staff app access was never enabled from tenant employee management

So a login rejection is not always an app bug. It can be provisioning/data-state.

## Cross-App Push Notification Wiring

### Customer app (`RifahMobile`)
- Registration path is valid:
  - app requests permissions
  - gets Expo token
  - posts to `/users/push-token`
  - backend stores in `mobile_push_tokens`
- Sending path is valid:
  - backend looks up active customer tokens by `platformUserId`
- Current likely failure mode:
  - user has no active registered device token
  - not a send-pipeline bug

### Staff app (`RifahStaff`)
- Staff push contract is not aligned yet at feature level
- App currently references FCM naming and missing routes, while backend uses Expo push token registration at `/staff/me/push-token`

## Current Build/Runtime Risk Ranking

### Highest Risk
1. `RifahStaff` unsupported service routes
2. `RifahStaff` response-shape mismatches
3. `RifahMobile` runtime crashes from unnormalized numeric/data fields

### Medium Risk
1. Missing Apps Center public endpoint for `RifahMobile`
2. Category semantics mismatch
3. Silent push-registration failures on customer app

### Lower Risk
1. “New” and “Trending” discovery semantics being simplistic

## Recommended Fix Order

### Phase A: Stabilize RifahMobile
1. Continue normalizing all numeric fields used in UI cards and payment summaries
2. Keep the new push diagnostics
3. Restore or re-add `/api/v1/public/apps-center/customer-app` if dynamic legal/support/social content is required now

### Phase B: Rewire RifahStaff to the Real Backend
1. Replace `/staff/me/appointments/today` with `/staff/appointments?date=...`
2. Replace `/staff/me/appointments/:id/status` with `/staff/appointments/:id/status`
3. Replace `/staff/me/schedule?...` with `/staff/schedule?date=...`
4. Update parsing from `response.data.data` to the real response fields
5. Map status values from app-friendly labels to backend values like `checked_in`, `in_service`, `completed`, `no_show`

### Phase C: Decide Product Direction for Missing Staff Features
Choose one:
- implement backend endpoints for messages, earnings, reviews, and time off
- or temporarily remove/hide those sections from `RifahStaff`

## Best “Solve It In One Shot” Plan
If the goal is one cleanup wave instead of piecemeal fixes:

1. Freeze the staff-app feature surface to what the backend already supports
2. Rewire `RifahStaff` to the existing staff contract first
3. Restore missing optional backend endpoints used by `RifahMobile` only where business-critical
4. Add one shared contract checklist for every mobile endpoint:
   - route path
   - auth requirement
   - request body
   - response shape
   - nullable fields
   - numeric string fields

## Conclusion
- `RifahMobile` is close to healthy and can be stabilized with targeted normalization and a couple of backend-content fixes.
- `RifahStaff` needs a real contract reconciliation pass before it can be considered reliable.
- The fastest high-confidence path is to patch `RifahStaff` against the existing backend first, rather than expanding backend surface area blindly.
