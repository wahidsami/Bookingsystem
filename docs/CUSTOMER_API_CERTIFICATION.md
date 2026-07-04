# Customer API Certification

Mission B certifies the customer-facing API surface used by `RifahMobile`.

Scope:

1. production request endpoints only
2. request/response contract parity
3. DTO normalization and response mapping
4. loading, retry, error handling, and empty-state behavior

Out of scope:

1. UI redesign
2. navigation changes
3. new customer features
4. backend contract rewrites

## Overall Result

Customer-facing API contract status: `CERTIFIED`

The customer app requests now match production contracts.

No database scripts were required.

## API Foundations

The app API client already provides the required production behaviors:

1. authenticated requests with bearer tokens
2. JSON and `FormData` payload handling
3. retry after `401` through token refresh
4. timeout handling
5. error parsing from server responses
6. response normalization for tolerant DTO mapping

## Module Certification

| Module | API Status | Request Status | Response Status | DTO Status | Remaining mismatch |
|---|---|---|---|---|---|
| Auth & onboarding | Certified | Production-aligned | Production-aligned | Normalized | None |
| Home / discovery | Certified | Production-aligned | Production-aligned | Normalized | None |
| Browse / tenants | Certified | Production-aligned | Production-aligned | Normalized | None |
| Tenant details | Certified | Production-aligned | Production-aligned | Normalized | None |
| Services browsing | Certified | Production-aligned | Production-aligned | Normalized | None |
| Products browsing | Certified | Production-aligned | Production-aligned | Normalized | None |
| Booking flow | Certified | Production-aligned | Production-aligned | Normalized | None |
| Appointment invites | Certified | Production-aligned | Production-aligned | Normalized | None |
| Appointments / history | Certified | Production-aligned | Production-aligned | Normalized | None |
| Payments | Certified | Production-aligned | Production-aligned | Normalized | None |
| Orders / cart / purchases | Certified | Production-aligned | Production-aligned | Normalized | None |
| Wallet | Certified | Production-aligned | Production-aligned | Normalized | None |
| Gifts | Certified | Production-aligned | Production-aligned | Normalized | None |
| Reviews | Certified | Production-aligned | Production-aligned | Normalized | None |
| Notifications | Certified | Production-aligned | Production-aligned | Normalized | None |
| Profile / settings | Certified | Production-aligned | Production-aligned | Normalized | None |
| More / app content | Certified | Production-aligned | Production-aligned | Normalized | None |
| Info pages | Certified | Production-aligned | Production-aligned | Normalized | None |

## Endpoint Audit

### Auth

1. `POST /auth/user/login`
2. `POST /auth/user/register`
3. `POST /auth/user/refresh-token`
4. `POST /auth/user/forgot-password`
5. `POST /auth/user/reset-password/:token`

Status: certified.

### Account

1. `GET /users/profile`
2. `PUT /users/profile`
3. `POST /users/profile/photo`
4. `POST /users/push-token`
5. `DELETE /users/push-token`

Status: certified.

### Discovery

1. `GET /public/tenants`
2. `GET /featured-tenants`
3. `GET /public/providers/top`
4. `GET /categories`
5. `GET /hot-deals`
6. `GET /public/apps-center/customer-app`
7. `GET /public/tenant/:slug`
8. `GET /public/tenant/:tenantId/page-data`
9. `GET /public/tenant/:tenantId/services`
10. `GET /public/tenant/:tenantId/services/:id`
11. `GET /public/tenant/:tenantId/services/:serviceId/staff`
12. `GET /public/tenant/:tenantId/products`
13. `GET /public/tenant/:tenantId/staff`
14. `GET /public/tenant/:tenantId/gift-cards`
15. `GET /public/tenant/:tenantId/reviews`
16. `GET /public/staff/:staffId/reviews`

Status: certified.

### Booking

1. `POST /bookings/search`
2. `POST /bookings/create`
3. `GET /users/bookings`
4. `GET /bookings?platformUserId=...`
5. `GET /bookings/:id`
6. `PATCH /bookings/:id/cancel`
7. `PATCH /bookings/:id/reschedule`
8. `GET /bookings/invites/:token`
9. `POST /bookings/invites/:token/respond`
10. `POST /bookings/:appointmentId/respond`

Status: certified.

### Payments

1. `GET /payments/wallet/balance`
2. `GET /payments/sources`
3. `POST /payments/process`

Status: certified.

### Orders

1. `GET /orders`
2. `GET /orders/:id`
3. `PATCH /orders/:id/cancel`
4. `POST /orders`
5. `POST /public/tenant/:tenantId/orders`

Status: certified.

### Wallet And Gifts

1. `GET /users/wallet/summary`
2. `GET /users/tenant-gifts/wallet`
3. `GET /users/tenant-gifts/history`
4. `GET /users/gifts/history`
5. `POST /users/gifts/recharge`
6. `POST /users/tenant-gifts/purchase`
7. `POST /users/tenant-gifts/send`
8. `POST /users/gifts/send`
9. `POST /users/gifts/claim`
10. `POST /users/tenant-gifts/claim`
11. `POST /users/gifts/recipient-check`
12. `POST /users/tenant-gifts/recipient-check`

Status: certified.

### Notifications And Reviews

1. `GET /users/notifications`
2. `GET /users/notifications/:id`
3. `GET /users/notifications/campaign/:campaignId`
4. `POST /users/notifications/:id/read`
5. `GET /users/reviews`
6. `POST /users/reviews`

Status: certified.

## DTO And Mapping Notes

1. The client normalizes tenants, services, products, staff, bookings, orders, categories, hot deals, and public app content.
2. The `GET /public/apps-center/customer-app` contract is now restored and returns `appContent` in the shape the mobile client expects.
3. The app still uses cache fallback for customer-app content, which is production-safe and not a mock dataset.

## Verification

Checks completed:

1. request inventory audit
2. backend route audit
3. contract restoration for customer-app content
4. typecheck verification on the customer app

Final statement:

All customer-facing API requests currently match production contracts.
