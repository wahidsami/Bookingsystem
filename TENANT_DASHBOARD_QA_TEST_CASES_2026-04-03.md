# Tenant Dashboard QA Test Cases

Document date: 2026-04-03  
System under test: Tenant Dashboard  
Frontend app: `tenant`  
Backend app: `server` (`/api/v1/tenant/*`, `/api/v1/subscription*`, `/api/v1/settings/global`, `/api/v1/public/*`)  
Primary QA objective: validate tenant dashboard end-to-end behavior after login, including CRUD flows, permissions, package limits, billing/subscription, reporting, messaging, marketing, and localization.

## QA Execution Rules

- Test both locales where applicable: `ar` and `en`.
- Test both desktop and mobile viewport for every major page.
- Use one active tenant with a paid package, one free-package tenant, one `payment_pending` tenant, and one `more_info_required` tenant.
- Keep a reusable data set:
  - 3 staff members: one with app access enabled, one disabled, one inactive.
  - 3 services: one active, one inactive, one with product attachments.
  - 3 products: one in-stock, one low-stock, one inactive/out-of-stock.
  - 3 customers with different booking/order history.
  - at least one bill in each state if possible: `UNPAID`, `PAID`, `EXPIRED`.
  - at least one hot deal in `PENDING`, `APPROVED`, `REJECTED` states.
  - at least one review with and without tenant reply.
- For each failed test, record test case ID, environment URL, browser/device, exact steps, expected vs actual, screenshot/video, browser console output, backend log snippet, and API request/response payload.

## Status Legend

| Status | Meaning |
| --- | --- |
| Not Run | Not executed yet |
| Pass | Expected behavior confirmed |
| Fail | Bug found |
| Blocked | Could not execute due to dependency/environment/data issue |
| Retest | Fix deployed, test pending re-run |

## Global Smoke Checklist

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-GEN-001 | App boot + auth | P0 | Tenant app deployed; valid tenant credentials exist | Open `/ar/login`, log in with active tenant, wait for dashboard load | User lands on dashboard, sidebar/header visible, business name/logo shown, no white screen | `POST /auth/tenant/login` returns `success=true`; profile token stored |
| TD-GEN-002 | Locale switch | P0 | Logged in tenant | Click language switcher from Arabic to English and back | Route changes `/ar/...` <-> `/en/...`; labels and page direction update correctly; no forced logout | Browser route changes; no 404; no hydration errors |
| TD-GEN-003 | Logout | P0 | Logged in tenant | Click Logout | Session cleared and redirected to `/<locale>/login`; dashboard routes are inaccessible without login | Storage keys removed: `rifah_tenant_access_token`, `rifah_tenant_refresh_token` |
| TD-GEN-004 | Unauthorized access guard | P0 | No tenant token in browser | Open `/ar/dashboard/services` directly | User is redirected to login or blocked by auth guard; no sensitive data rendered | Protected API requests return `401` if token missing/invalid |
| TD-GEN-005 | `payment_pending` redirect | P0 | Tenant status is `payment_pending` | Log in and attempt opening `/ar/dashboard` and `/ar/dashboard/services` | App redirects to `/ar/payment`; regular dashboard pages are not usable until payment | Tenant context status = `payment_pending`; bill/payment endpoint reachable |
| TD-GEN-006 | `more_info_required` redirect | P0 | Tenant status is `more_info_required` | Log in and open any dashboard page | App redirects to `/ar/onboarding/more-info` | Tenant context status = `more_info_required` |
| TD-GEN-007 | Responsive navigation | P1 | Logged in tenant | Open dashboard on mobile width, navigate using bottom nav and header controls | No layout break; bottom nav visible; top header works; active page highlighted | No console layout/runtime errors |
| TD-GEN-008 | Media loading | P1 | Tenant has logo, product/service images, staff image | Browse dashboard pages containing uploaded images | Images load from API origin without broken placeholders unless data is actually missing | Image URLs resolve under `NEXT_PUBLIC_SERVER_URL/uploads/...` |

## Dashboard Home

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-DASH-001 | Dashboard overview load | P0 | Logged in active tenant with some appointments and revenue data | Open `/ar/dashboard` | Dashboard cards and today's appointments section load without crash | `GET /tenant/dashboard/stats`, `GET /tenant/dashboard/todays-appointments` |
| TD-DASH-002 | Empty-state handling | P1 | Tenant with no bookings/orders/services | Open dashboard home | Zero-state values render cleanly; no NaN/null labels | API returns zeros/empty lists and UI handles them |
| TD-DASH-003 | Sidebar navigation integrity | P0 | Logged in active tenant | Click every sidebar item one by one | Each route opens successfully and active highlight moves correctly | No 404 and no unexpected redirect except guarded statuses |

## Services

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-SRV-001 | Service list load | P0 | Tenant has at least 2 services | Open `/ar/dashboard/services` | Services list renders with names, status, price, actions, and search/filter controls | `GET /tenant/services` |
| TD-SRV-002 | Service search/filter | P1 | At least one active and one inactive service | Search by service name, filter by status/category if available | List updates correctly; no stale results after clearing filters | Request query string matches UI filters |
| TD-SRV-003 | Create service - happy path | P0 | Active tenant; category list available; at least one active employee | Open `/dashboard/services/new`, fill required Arabic/English name, category, price, duration, selected employee(s), optional products, upload image, save | Service is created, user returns to list/detail, new record appears with correct fields | `POST /tenant/services`; verify record in DB and image upload path |
| TD-SRV-004 | Create service - required field validation | P0 | On new-service page | Submit with missing required fields one by one | Inline validation appears and request is not sent or backend returns clear error | No malformed service record created |
| TD-SRV-005 | Create service - package limit enforcement | P0 | Tenant package with max services limit reached | Attempt creating one more service | Save is blocked with clear limit messaging; no extra service created | `GET /tenant/settings/limits`; `POST /tenant/services` should reject if over limit |
| TD-SRV-006 | AI generate service content | P1 | OpenAI key configured; package allows AI feature | On service create/edit page, enter partial service data and trigger AI helper | Generated content fills expected fields; UI shows loading and handles errors cleanly | `POST /tenant/ai/generate-service` |
| TD-SRV-007 | AI translate service fields | P1 | Service form has English or Arabic text | Use translate actions for description/array fields | Target-language field is filled with translated content and can still be edited manually | `POST /tenant/ai/translate` |
| TD-SRV-008 | Edit service | P0 | Existing service with image and employee assignment | Open `/dashboard/services/[id]`, update names, pricing, duration, status, assigned employees/products, save | Changes persist and are reflected in list, detail page, booking/customer app if public-facing | `GET /tenant/services/:id`, `PUT /tenant/services/:id` |
| TD-SRV-009 | Delete service | P0 | Existing test service not needed by a protected flow | Delete from list page, confirm browser dialog | Service disappears from list; if deletion is blocked by business rules, error is clear | `DELETE /tenant/services/:id` |
| TD-SRV-010 | Service category source | P1 | Admin has configured service categories | Open service create/edit page | Category dropdown loads admin-defined categories | `GET /tenant/services/categories` |
| TD-SRV-011 | Global pricing/tax settings load | P1 | Global settings exist or defaults apply | Open service create/edit page and review pricing/tax fields | Page loads commission/tax values without timeout and calculations are sensible | `GET /settings/global` |
| TD-SRV-012 | Inactive service visibility | P1 | At least one service marked inactive | Mark a service inactive and review tenant list and customer-facing availability | Inactive service is hidden from active-only customer booking surfaces but manageable in tenant dashboard | `PUT /tenant/services/:id`; customer app validation later |

## Products

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-PRD-001 | Product list load | P0 | Tenant has at least 2 products | Open `/ar/dashboard/products` | Product list loads with image, stock, status, price, and actions | `GET /tenant/products` |
| TD-PRD-002 | Product search/filter | P1 | Products with different categories/statuses exist | Search and filter product list | Results update accurately and clear back to full list | Request params reflect filters |
| TD-PRD-003 | Create product - happy path | P0 | Tenant package allows product creation | Open `/dashboard/products/new`, fill names, description, brand/category, prices, stock, upload image, save | Product is created and visible in list/detail | `POST /tenant/products` |
| TD-PRD-004 | Create product - validation | P0 | On new product page | Submit missing required price/name/stock fields | Clear validation shown; bad data is not saved | No malformed product row |
| TD-PRD-005 | Product package limit enforcement | P0 | Tenant package max products limit reached | Attempt creating extra product | Save is blocked with clear message | `GET /tenant/settings/limits`, `POST /tenant/products` |
| TD-PRD-006 | AI generate product content | P1 | OpenAI enabled and feature allowed | Trigger AI helper in new/edit product form using search/enhance modes if available | Product text fields are generated; errors shown if AI service fails | `POST /tenant/ai/generate-product` |
| TD-PRD-007 | AI translate product fields | P1 | Product form has source-language content | Use translation buttons | Target fields populated correctly and editable | `POST /tenant/ai/translate` |
| TD-PRD-008 | Edit product | P0 | Existing product | Open `/dashboard/products/[id]`, update names, pricing, stock, availability, image, save | Updates persist and list/detail reflect changes | `GET /tenant/products/:id`, `PUT /tenant/products/:id` |
| TD-PRD-009 | Delete product | P0 | Existing test product | Delete product from list and confirm | Product disappears or clear business-rule error appears | `DELETE /tenant/products/:id` |
| TD-PRD-010 | Inventory edge cases | P1 | Product with stock = 0 and low stock | Set stock to 0, negative, very large value if UI allows | Zero stock behavior is correct; negative stock is blocked; no NaN UI | Backend validation and list display |
| TD-PRD-011 | Global pricing/tax settings load | P1 | Global settings endpoint available | Open product create/edit page | Commission/tax settings load and do not block form | `GET /settings/global` |

## Employees

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-EMP-001 | Employee list load | P0 | Tenant has staff records | Open `/ar/dashboard/employees` | Employee list loads with names, status, role/details, and actions | `GET /tenant/employees` |
| TD-EMP-002 | Employee search/filter | P1 | At least one active and one inactive employee | Search by name and filter by active/inactive | Results update correctly | Request params reflect selected filters |
| TD-EMP-003 | Create employee - happy path | P0 | Package allows staff count > current count | Open `/dashboard/employees/new`, fill required fields, upload image, save | Employee is created and appears in list | `POST /tenant/employees` |
| TD-EMP-004 | Create employee - validation | P0 | On new employee page | Submit missing required fields and invalid email/phone if supported | Inline or backend validation appears and no bad row is created | No malformed staff record |
| TD-EMP-005 | Staff package limit enforcement | P0 | Tenant has reached max staff limit | Try creating another employee | Creation is blocked with clear limit message | `GET /tenant/settings/limits`, `POST /tenant/employees` |
| TD-EMP-006 | Edit employee profile | P0 | Existing employee | Open `/dashboard/employees/[id]`, update name/contact/job fields/image, save | Changes persist and list/detail reflect updates | `GET /tenant/employees/:id`, `PUT /tenant/employees/:id` |
| TD-EMP-007 | Delete employee | P0 | Existing test employee not required by future tests | Delete from list and confirm | Employee removed or clear business-rule error displayed | `DELETE /tenant/employees/:id` |
| TD-EMP-008 | App access toggle | P0 | Existing employee detail page | Toggle staff-app access on/off | UI reflects new state and backend saves access flag | `PUT /tenant/employees/:id/app-access` |
| TD-EMP-009 | Send staff invite email | P1 | Employee with valid email and app access enabled | Click Send Invite | Success message appears; email is sent with login URL and temporary password if expected | `POST /tenant/employees/:id/send-invite`; check Resend/log output |
| TD-EMP-010 | Reset employee password | P1 | Employee with app access enabled | Click Reset Password | Success message appears and password reset email is sent | `POST /tenant/employees/:id/reset-password` |
| TD-EMP-011 | Employee permissions load/save | P0 | Employee detail page | Toggle each permission flag and save if needed | Permission states persist after page refresh and affect staff app access scope | `GET /tenant/employees/:id/permissions`, `PUT /tenant/employees/:id/permissions` |

## Schedules

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-SCH-001 | Schedule page load | P0 | At least one active employee | Open `/ar/dashboard/schedules` | Employee selector and schedule sections load | `GET /tenant/employees?isActive=true` |
| TD-SCH-002 | Employee selection loads all schedule data | P0 | Selected employee has shifts/breaks/time off/overrides | Choose employee | All schedule panels load without stale data from previous employee | `GET /tenant/employees/:id/shifts`, `/breaks`, `/time-off`, `/overrides` |
| TD-SCH-003 | Create recurring shift | P0 | Active employee selected | Add shift with day of week, start/end, recurring flag, optional date range | Shift appears in schedule and persists after refresh | `POST /tenant/employees/:id/shifts` |
| TD-SCH-004 | Edit shift | P0 | Existing shift | Modify shift time/day/date range and save | Shift updates correctly and no duplicate ghost row remains | `PUT /tenant/employees/:id/shifts/:shiftId` |
| TD-SCH-005 | Delete shift | P0 | Existing shift | Delete shift and confirm | Shift removed from UI and does not reappear after refresh | `DELETE /tenant/employees/:id/shifts/:shiftId` |
| TD-SCH-006 | Create break | P1 | Active employee selected | Add break with type, time, recurring/specific date | Break appears and persists | `POST /tenant/employees/:id/breaks` |
| TD-SCH-007 | Edit/delete break | P1 | Existing break | Update and delete break | Changes persist and deleted break disappears | `PUT/DELETE /tenant/employees/:id/breaks/:breakId` |
| TD-SCH-008 | Create time off | P1 | Active employee selected | Add vacation/sick/personal/training time off | Time off appears and affects schedule availability if applicable | `POST /tenant/employees/:id/time-off` |
| TD-SCH-009 | Edit/delete time off | P1 | Existing time off | Update dates/reason/type and then delete | Updates/deletion persist | `PUT/DELETE /tenant/employees/:id/time-off/:timeOffId` |
| TD-SCH-010 | Create schedule override | P1 | Active employee selected | Add override/exception for a specific date, availability, time range, reason | Override appears and persists | `POST /tenant/employees/:id/overrides` |
| TD-SCH-011 | Edit/delete override | P1 | Existing override | Update override and then delete | Changes persist correctly | `PUT/DELETE /tenant/employees/:id/overrides/:overrideId` |
| TD-SCH-012 | Invalid time validation | P0 | Any schedule form open | Enter end time earlier than start time, overlapping times, invalid dates | Form/backend rejects invalid values and shows clear error | No invalid rows saved |

## Appointments

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-APT-001 | Appointment list load | P0 | Tenant has bookings in multiple statuses | Open `/ar/dashboard/appointments` | Appointment list loads with customer, service, staff, date/time, status | `GET /tenant/appointments` |
| TD-APT-002 | Appointment filtering/search/date range | P1 | Multiple appointments exist | Apply status/date/search filters and pagination if available | List updates accurately and resets cleanly | Request query matches filters |
| TD-APT-003 | Appointment details load | P0 | Existing appointment | Open `/dashboard/appointments/[id]` | Full booking details load with service, customer, staff, payment fields, status controls | `GET /tenant/appointments/:id` |
| TD-APT-004 | Update appointment status | P0 | Existing pending/confirmed appointment | Change status to confirmed/completed/cancelled/no_show where allowed | Status updates, UI refreshes, and invalid transitions are blocked | `PATCH /tenant/appointments/:id/status` |
| TD-APT-005 | Update appointment payment status | P0 | Existing appointment with unpaid/partial state | Update payment status/method | Payment values persist and financial views reflect changes | `PATCH /tenant/appointments/:id/payment` |
| TD-APT-006 | Record remainder payment | P0 | Appointment with remaining balance | Record remainder payment amount and method | Remaining amount decreases, payment history/status updates correctly | `POST /tenant/appointments/:id/record-payment` |
| TD-APT-007 | Reschedule appointment | P0 | Existing appointment; target slot available | Change date/time/staff if supported | Appointment moves to new slot and no duplicate booking appears | `PATCH /tenant/appointments/:id/reschedule` |
| TD-APT-008 | Calendar view load | P1 | Existing appointments on selected dates | If calendar view exists, navigate dates and open appointment entries | Calendar events match list data and open correct records | `GET /tenant/appointments/calendar` |
| TD-APT-009 | Appointment stats cards | P1 | Multiple appointments across statuses | Check stats section if present | Counts/revenue match visible records and date filter scope | `GET /tenant/appointments/stats` |
| TD-APT-010 | No-data state | P2 | Filter to a period with no bookings | Apply empty date range/filter | Clean empty state displayed, no crash | API returns empty list |

## Orders

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-ORD-001 | Order list load | P0 | Tenant has product orders | Open `/ar/dashboard/orders` | Orders list renders with order number/customer/date/status/payment totals | `GET /tenant/orders` |
| TD-ORD-002 | Order filters/search/date | P1 | Orders in multiple statuses and payment states | Filter by order status, payment status, date, search text | Results update and clear correctly | Query params match filter choices |
| TD-ORD-003 | Order detail load | P0 | Existing order | Open `/dashboard/orders/[id]` | Order detail page shows customer, items, address, totals, payment and fulfillment status | `GET /tenant/orders/:id` |
| TD-ORD-004 | Update fulfillment status | P0 | Existing order in processable state | Change status to processing/shipped/delivered/cancelled where allowed; enter tracking number/date if required | Status persists and timeline/details update | `PATCH /tenant/orders/:id/status` |
| TD-ORD-005 | Update payment status | P0 | Existing order with unpaid/pending status | Update order payment status | Payment status persists and financial data updates | `PATCH /tenant/orders/:id/payment` |
| TD-ORD-006 | Invalid transition handling | P1 | Delivered/cancelled order | Attempt unsupported status transition if UI allows | UI/backend blocks invalid state transition gracefully | No corrupted order state |

## Hot Deals

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-HOT-001 | Hot deals list load | P0 | Tenant has hot deals in multiple statuses | Open `/ar/dashboard/hot-deals` | Deals list loads with service, discount, dates, status, and actions | `GET /tenant/hot-deals` |
| TD-HOT-002 | Package limit display | P1 | Tenant has a hot deals quota in subscription package | Open hot deals list | Remaining/used deal quota displays correctly | `GET /tenant/hot-deals/limits` |
| TD-HOT-003 | Create hot deal - happy path | P0 | At least one service available; quota not exceeded | Open `/dashboard/hot-deals/new`, select service, title, discount, dates, image if needed, submit | Deal is created in pending/review state or configured status, then appears in list | `POST /tenant/hot-deals` |
| TD-HOT-004 | Create hot deal - validation | P0 | On new hot deal page | Submit missing service, invalid discount, end date before start date | Clear validation/error shown, no bad deal created | Backend rejects malformed payload |
| TD-HOT-005 | Hot deal status lifecycle | P1 | Deal submitted and admin can approve/reject | Create deal, review status after admin action | Status updates correctly in tenant list and customer app visibility follows approval state | `GET /tenant/hot-deals`; admin workflow later |
| TD-HOT-006 | Delete hot deal | P1 | Existing deal | Delete deal from list | Deal removed or blocked with clear message if deletion not allowed by status | `DELETE /tenant/hot-deals/:id` |

## Messages

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-MSG-001 | Messages page load | P0 | Tenant has at least one staff member | Open `/ar/dashboard/messages` | Message composer and message list load | `GET /tenant/messages` |
| TD-MSG-002 | Send message to staff | P0 | Existing staff recipient | Choose recipient(s), enter subject/body if applicable, send | Success message shown and new message appears in history | `POST /tenant/messages` |
| TD-MSG-003 | Delete message | P1 | Existing sent message | Delete message and confirm | Message removed from history | `DELETE /tenant/messages/:id` |
| TD-MSG-004 | Empty/invalid recipient handling | P1 | On messages page | Attempt sending with no recipient or empty body | Validation/error shown and no empty message saved | Backend rejects incomplete payload |

## Customer Push Notifications

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-NOT-001 | Push notifications page load | P0 | Tenant has notification feature enabled | Open `/ar/dashboard/notifications` | Usage counter, campaign form, and history load | `GET /tenant/notifications/usage`, `GET /tenant/notifications/history` |
| TD-NOT-002 | Audience options | P1 | Tenant has customers and services | Switch audience between all customers and selected customers; choose service link option | Recipient pickers and service dropdown behave correctly | `GET /tenant/customers`, `GET /tenant/services?isActive=true` |
| TD-NOT-003 | Send push to all customers | P0 | At least one customer has valid push token in customer app | Fill title/body, audience=all, optional link target, send | Success response with sent count; usage counter increments; campaign added to history | `POST /tenant/notifications/send`; verify campaign and recipient rows |
| TD-NOT-004 | Send push to selected customers | P0 | Customers loaded | Select a subset of users and send notification | Only selected recipients receive/send count reflects selection | `POST /tenant/notifications/send` payload has platformUserIds |
| TD-NOT-005 | Package quota enforcement | P0 | Tenant near or at monthly push limit | Try sending at limit and above limit | Allowed sends succeed until limit, then over-limit attempt is blocked with clear message | `GET /tenant/notifications/usage`; backend quota check |
| TD-NOT-006 | Campaign history pagination | P1 | Multiple past campaigns exist | Browse history pages | Correct page/total counts; older campaigns load | `GET /tenant/notifications/history?page=...&limit=...` |
| TD-NOT-007 | Campaign recipients modal/details | P1 | Campaign has recipients | Open campaign recipients/details | Recipient list displays correct users and counts | `GET /tenant/notifications/history/:id/recipients` |
| TD-NOT-008 | Invalid payload handling | P1 | On notification form | Send empty title/body or invalid link target | Validation/error shown, no campaign created | Backend rejects bad request |

## Customers

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-CUS-001 | Customer list load | P0 | Tenant has customer records | Open `/ar/dashboard/customers` | Customer list and stats cards load | `GET /tenant/customers`, `GET /tenant/customers/stats` |
| TD-CUS-002 | Customer search/filter/sort | P1 | Multiple customers with varied data | Search by name/email/phone, apply loyalty/customer type/min bookings/min spent filters, sort if available | Results update correctly and reset cleanly | Query params match UI inputs |
| TD-CUS-003 | Customer export | P1 | Customer records exist | Click export/download action | File downloads successfully and contains expected customer rows/columns | `GET /tenant/customers/export`; verify CSV/XLS content |
| TD-CUS-004 | Customer details load | P0 | Existing customer with history | Open `/dashboard/customers/[id]` | Profile, notes/tags, and appointment/order history sections load | `GET /tenant/customers/:id`, `GET /tenant/customers/:id/history` |
| TD-CUS-005 | Update customer notes/tags | P1 | Existing customer detail page | Edit notes/tags and save | Notes/tags persist after refresh | `PATCH /tenant/customers/:id/notes` |
| TD-CUS-006 | Customer history filters | P1 | Customer has both appointment and order history | Filter customer history by type/date | Filtered results are correct and no cross-customer leakage | `GET /tenant/customers/:id/history?type=...` |

## Bills

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-BIL-001 | Bills page load | P0 | Tenant has at least one bill | Open `/ar/dashboard/bills` | Bills list loads with bill number, type, status, amount, due date, and payment action where applicable | `GET /tenant/bills` |
| TD-BIL-002 | Unpaid bill payment entry | P0 | Tenant has `UNPAID` bill | Click Pay/Open payment action | User is routed to unified payment page with correct token/bill context | `GET /tenant/bills/current-unpaid` or tokenized public bill endpoint |
| TD-BIL-003 | Paid bill state display | P1 | Tenant has paid bill | Review bill row/card | Paid status, payment date, and amount render correctly; no pay action shown if already paid | Bill row status and paidAt fields |
| TD-BIL-004 | Expired bill handling | P1 | Tenant has expired bill | Open bills page and expired payment link if available | Expired bill clearly marked and payment action blocked/handled gracefully | Bill status/expiry fields |
| TD-BIL-005 | Initial approval invoice appears | P0 | Tenant registered with paid package, then admin approved and payment pending | Log into tenant and open bills/payment flow | Initial approval invoice appears and paying it activates tenant account | Initial `Bill` row type `initial`; tenant status becomes `active` after payment |

## Subscription

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-SUB-001 | Current subscription page load | P0 | Active tenant with current subscription | Open `/ar/dashboard/subscription` | Current package, status, billing cycle, dates, amount, and limits/usage summary display correctly | `GET /subscription/current`, `GET /tenant/settings/limits` |
| TD-SUB-002 | Payment pending subscription state | P0 | Tenant status `payment_pending` with unpaid bill | Open subscription page/payment flow | UI clearly indicates payment required and routes to payment | Tenant status + current unpaid bill |
| TD-SUB-003 | Upgrade package list load | P0 | Active tenant | Open `/dashboard/subscription/upgrade` | Available packages load with monthly/sixMonth/annual prices and current package context | `GET /subscriptions/packages`, `GET /subscription/current` |
| TD-SUB-004 | Create upgrade/renewal request | P0 | Active tenant and target package available | Choose package and billing cycle, submit upgrade/renewal | Invoice is generated and user receives payment URL/bill number | `POST /subscription/request-upgrade` |
| TD-SUB-005 | Upgrade payment completion | P0 | Upgrade/renewal bill generated | Pay invoice through unified payment page | Subscription package/billingCycle/current period update correctly after payment | Public bill payment endpoint + `GET /subscription/current` |
| TD-SUB-006 | Free package behavior | P1 | Tenant currently on free package or upgrading to free package if business rules allow | Open subscription page and attempt package changes | Free-plan amount/status behavior is correct and no payment-only assumptions break UI | Subscription row status/amount checks |
| TD-SUB-007 | Invalid package/change request | P1 | Active tenant | Attempt upgrade with missing/invalid package or unsupported billing cycle by manipulating UI/network if possible | API rejects with clear message and UI handles failure | `400/404` from `/subscription/request-upgrade` |

## Financial

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-FIN-001 | Financial overview load | P0 | Tenant has completed appointments/orders and transactions | Open `/ar/dashboard/financial` | Summary cards, charts/tables load without NaN/null or crash | `GET /tenant/financial/overview` |
| TD-FIN-002 | Date range filtering | P1 | Financial data exists across multiple days/months | Apply date range filters | Metrics/charts update to requested range | Query params `startDate`, `endDate` |
| TD-FIN-003 | Employee revenue section | P1 | Completed appointments assigned to employees | Review employee revenue and drilldown if supported | Employee totals and details are consistent with appointment data | `GET /tenant/financial/employees`, `GET /tenant/financial/employees/:id` |
| TD-FIN-004 | Service revenue section | P1 | Service sales/appointments exist | Review service revenue table/chart | Revenue totals and ordering are sensible and match source data | `GET /tenant/financial/services` |
| TD-FIN-005 | Product revenue section | P1 | Paid product orders exist | Review product revenue | Product totals match paid orders and exclude cancelled/refunded where appropriate | `GET /tenant/financial/products` |
| TD-FIN-006 | Daily revenue chart/table | P1 | Revenue over multiple days | Review daily revenue visualization | Daily totals align with underlying transactions/orders/appointments | `GET /tenant/financial/daily` |
| TD-FIN-007 | Empty financial state | P2 | Tenant with no revenue in selected range | Filter to empty period | Clean zero state, no chart crash | API returns empty/zero values |

## Payroll

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-PAY-001 | Payroll page load | P0 | At least one employee exists | Open `/ar/dashboard/payroll` | Payroll records and controls load | `GET /tenant/payroll` |
| TD-PAY-002 | Payroll filtering | P1 | Payroll records with multiple employees/statuses exist | Filter by employee, status, and date range | List updates correctly | `GET /tenant/payroll?...` |
| TD-PAY-003 | Generate payroll | P0 | Employee performance/payment data exists for selected period | Trigger payroll generation for one employee or all employees if supported | Payroll records are created and visible with expected amounts/status | `POST /tenant/payroll/generate` |
| TD-PAY-004 | Update payroll status | P1 | Payroll record exists | Change status, for example pending -> paid | Status persists and UI updates | `PUT /tenant/payroll/:id/status` |
| TD-PAY-005 | Duplicate payroll prevention | P1 | Payroll already generated for same employee/period | Attempt generating again for the same period | System blocks duplicate or handles idempotently with clear message | Backend uniqueness/business rule validation |

## Reviews

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-REV-001 | Reviews page load | P0 | Tenant has one or more customer reviews | Open `/ar/dashboard/reviews` | Reviews list, rating data, status/visibility controls load | `GET /tenant/reviews` |
| TD-REV-002 | Reviews filtering/pagination | P1 | Reviews with different statuses/services/staff exist | Filter by status/service/staff and paginate if available | Correct reviews shown and page counts are valid | `GET /tenant/reviews?...` |
| TD-REV-003 | Toggle review visibility | P0 | Existing visible/hidden review | Toggle visibility | Visibility state updates and persists after refresh | `PATCH /tenant/reviews/:id` with `isVisible` |
| TD-REV-004 | Reply to review | P0 | Existing review without reply | Enter reply text and save | Reply is saved and visible in tenant dashboard and customer-facing review display where relevant | `PATCH /tenant/reviews/:id` with `staffReply` |
| TD-REV-005 | Edit/remove reply | P1 | Review already has reply | Change reply text, then clear/remove reply if supported | Updated/cleared reply persists correctly | `PATCH /tenant/reviews/:id` |

## Reports

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-RPT-001 | Reports overview load | P0 | Tenant has operational data | Open `/ar/dashboard/reports` | Summary KPIs and charts load | `GET /tenant/reports/summary`, `/booking-trends`, `/service-performance`, `/employee-performance`, `/peak-hours`, `/customer-analytics` |
| TD-RPT-002 | Report date range/grouping | P1 | Data across multiple periods | Switch date range and grouping | Graphs/tables update and no malformed labels | Query params reflect selected range/groupBy |
| TD-RPT-003 | Generate full report config page | P1 | Report module enabled | Open `/dashboard/reports/generate`, choose date range and sections | Navigation and report config selections work | Route renders without auth/runtime errors |
| TD-RPT-004 | Preview full report | P1 | Valid report config selected | Generate preview | Preview displays selected sections and correct date range | `GET /tenant/reports/full?startDate=...&endDate=...&sections=...` |
| TD-RPT-005 | Invalid/empty report config | P2 | On report generation page | Submit missing dates or no sections | UI validates inputs and backend is not called with malformed params | No broken preview page |

## My Page

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-MYP-001 | My Page route load | P1 | Tenant is active | Open `/ar/dashboard/mypage` | Page loads without depending on removed public-page app assumptions; tenant slug and review sections render | `GET /tenant/settings`, `GET /tenant/reviews` |
| TD-MYP-002 | Business slug/link rendering | P2 | Tenant has slug | Review any displayed public link/slug references | URL/slug text is correct and does not point to localhost in production | Tenant slug from settings response |
| TD-MYP-003 | Review display consistency | P2 | Tenant has reviews | Compare reviews shown here vs Reviews page | Same review/reply/visibility data where intended | `GET /tenant/reviews` |

## Settings

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-SET-001 | Settings page load | P0 | Logged in active tenant | Open `/ar/dashboard/settings` | Business, working hours, booking, notification, payment, localization, appearance sections load | `GET /tenant/settings` |
| TD-SET-002 | Update business info | P0 | Settings page open | Change names, business types, contact details, address, descriptions, social links, save | Success message shown; values persist after refresh; sidebar business info updates where applicable | `PUT /tenant/settings/business` |
| TD-SET-003 | Business type multi-select persistence | P0 | Settings page open and tenant has multiple business types | Add/remove business types and save, refresh page | Saved array persists and displays correctly in sidebar and settings form | `PUT /tenant/settings/business`; verify JSONB businessType |
| TD-SET-004 | Logo upload | P0 | Image file ready | Upload new business logo | Logo preview/sidebar updates and image URL remains valid after refresh | `POST /tenant/settings/logo`; uploaded file exists under `/uploads/...` |
| TD-SET-005 | Cover image upload | P1 | Image file ready | Upload cover image if UI exposes this action | Cover image persists and renders in relevant page(s) | `POST /tenant/settings/cover` |
| TD-SET-006 | Working hours save | P0 | Settings page open | Edit open/close times and closed/open toggles for all weekdays, save | Working hours persist and affect booking availability if applicable | `PUT /tenant/settings/working-hours` |
| TD-SET-007 | Booking settings save | P0 | Settings page open | Update auto-approve, buffer, max advance booking, cancellation hours/policy, slot interval, allowAnyStaff, walk-in options if available | Settings persist after refresh and invalid values are rejected | `PUT /tenant/settings/booking` |
| TD-SET-008 | Notification settings save | P1 | Settings page open | Toggle email/SMS/WhatsApp/voice settings and save | Toggles persist and no unrelated fields reset | `PUT /tenant/settings/notifications` |
| TD-SET-009 | Payment settings save | P1 | Settings page open | Toggle cash/card/wallet acceptance and payout details, save | Settings persist and payment flow behavior follows toggles where implemented | `PUT /tenant/settings/payment` |
| TD-SET-010 | Localization settings save | P1 | Settings page open | Change default language, supported languages, timezone, currency, save | Settings persist; route locale switch still works; currency labels update where applicable | `PUT /tenant/settings/localization` |
| TD-SET-011 | Appearance settings save | P2 | Settings page open | Change layout/theme colors if available | Selection persists and does not break dashboard styling | `PUT /tenant/settings/appearance` |
| TD-SET-012 | Invalid settings payload handling | P1 | Settings page open | Enter invalid URLs, negative numbers, unsupported slot interval, malformed social links | UI/backend rejects invalid values gracefully and keeps last valid state | Backend 400/validation and no corrupted record |

## Cross-Module Permission and Package-Limit Tests

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-LIM-001 | Service limit enforcement across list + create/edit | P0 | Tenant package max services known | Compare services page limit badge/count with actual count, then try adding/deleting service | Limit display matches backend count; after delete, new creation becomes allowed if count drops below limit | `GET /tenant/settings/limits`, `POST/DELETE /tenant/services` |
| TD-LIM-002 | Staff limit enforcement across list + create/edit | P0 | Tenant package max staff known | Compare employees page usage with actual staff count, try adding extra staff and deleting one | Enforcement and count refresh are consistent | `GET /tenant/settings/limits`, `POST/DELETE /tenant/employees` |
| TD-LIM-003 | Product limit enforcement across list + create/edit | P0 | Tenant package max products known | Same as service/staff flow for products | Enforcement and count refresh are consistent | `GET /tenant/settings/limits`, `POST/DELETE /tenant/products` |
| TD-LIM-004 | Hot deals quota enforcement | P0 | Tenant package hot deal quota known | Create hot deals until limit, verify block at max, delete one if deletion allowed, try again | Quota usage updates consistently | `GET /tenant/hot-deals/limits`, `POST/DELETE /tenant/hot-deals` |
| TD-LIM-005 | AI feature gating | P1 | Tenant package with and without AI allowance | Attempt AI generation/translation on both package types | Allowed package succeeds, restricted package is blocked with clear message | `POST /tenant/ai/*`; package limits/features |
| TD-LIM-006 | Internal messaging feature gating | P1 | Tenant package with and without messaging | Open/send messages on both package types | Restricted package is blocked or feature hidden; allowed package works | `GET/POST /tenant/messages`; package limits/features |
| TD-LIM-007 | Customer push feature/quota gating | P1 | Tenant package with and without push campaign feature | Open notifications page and try send flow | Feature blocked or hidden when unavailable; quota enforced when available | `GET /tenant/notifications/usage`, `POST /tenant/notifications/send` |
| TD-LIM-008 | Products/Orders module hidden when not included | P0 | Tenant package has `hasProductsAndOrders=false` or `maxProducts=0` | Log in and inspect sidebar, then manually open `/dashboard/products` and `/dashboard/orders` | Sidebar links are hidden; direct URL access redirects to Subscription with upgrade messaging; API calls are denied with upgrade-required error | `GET /tenant/settings/limits`, `GET /tenant/products`, `GET /tenant/orders` |
| TD-LIM-009 | Hot Deals module hidden when quota is zero | P0 | Tenant package `maxHotDeals=0` | Log in and inspect sidebar, then manually open `/dashboard/hot-deals` | Hot Deals nav is hidden; direct URL access redirects to Subscription with locked-feature banner; backend route is denied | `GET /tenant/settings/limits`, `GET /tenant/hot-deals` |
| TD-LIM-010 | Payroll module hidden when not included | P0 | Tenant package `payroll=false` | Log in and inspect sidebar, then manually open `/dashboard/payroll` | Payroll nav is hidden; direct URL redirects to Subscription with upgrade messaging; payroll APIs are denied | `GET /tenant/settings/limits`, `GET /tenant/payroll` |
| TD-LIM-011 | Reports module hidden when not included | P0 | Tenant package `reports=false` and no legacy reports alias enabled | Log in and inspect sidebar, then manually open `/dashboard/reports` | Reports nav is hidden; direct URL redirects to Subscription with upgrade messaging; report APIs are denied | `GET /tenant/settings/limits`, `GET /tenant/reports/summary` |
| TD-LIM-012 | Public Page customization hidden when not included | P1 | Tenant package `publicPageCustomization=false` | Log in and inspect sidebar, then manually open `/dashboard/mypage` | My Page nav is hidden or blocked; direct route redirects to Subscription with upgrade messaging; public-page APIs are denied | `GET /tenant/settings/limits`, `GET /tenant/public-page` |
| TD-LIM-013 | Subscription page shows included and locked features | P0 | Tenant package with mixed enabled/disabled features | Open `/dashboard/subscription` and review package cards, quotas, and locked-feature section | Current package name, billing cycle, amount, period dates, usage, included features, and locked features are displayed correctly | `GET /subscription/current`, `GET /tenant/settings/limits` |
| TD-LIM-014 | Locked feature redirect explains blocked module | P0 | Tenant package excludes one module, such as Messages or Payroll | Manually open the restricted route URL | User is redirected to `/dashboard/subscription?lockedFeature=...` and sees the correct locked-feature banner and upgrade CTA | Browser route + `GET /tenant/settings/limits` |
| TD-LIM-015 | Feature unlock after package upgrade | P0 | Tenant starts on package excluding one feature and upgrades to a package including it | Complete upgrade/payment flow, refresh dashboard, open the previously locked route | Feature appears in sidebar, direct route opens normally, and backend API succeeds after new subscription becomes active | `POST /subscription/request-upgrade`, payment endpoint, `GET /subscription/current`, target module API |
| TD-LIM-016 | Feature removed after downgrade takes effect | P1 | Tenant package change to a lower plan is supported and effective period is known | Schedule/apply downgrade to package excluding a module, then test after effective period | Excluded module disappears/blocks only after downgrade becomes effective according to business rules; no premature access loss | `GET /subscription/current`, `GET /tenant/settings/limits`, target module API |
| TD-LIM-017 | Package feature alias backward compatibility | P1 | Existing legacy package rows and newly edited package rows both exist | Compare entitlement behavior for old packages using legacy keys and new packages using canonical keys | AI, reports, public-page, products/orders, and messaging entitlements behave consistently regardless of old/new package JSON key names | `GET /tenant/settings/limits`; inspect `SubscriptionPackage.limits` in DB |
| TD-LIM-018 | Near-limit consumption alerts and package usage table | P2 | Final PF-6 implementation is deployed and tenant has quotas near 80%, 90%, and 100% | Open Subscription usage tab and dashboard notifications after consuming package quotas | Consumption table shows total/consumed/left/status for each quantity-based feature, and tenant notifications appear when near limit or fully consumed | Future PF-6 API + alert persistence checks |

## Cross-Module Localization and RTL

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-LOC-001 | RTL layout in Arabic | P0 | Arabic locale | Review each dashboard page in `/ar/...` | Sidebar/header/content align RTL correctly, tables/forms readable, no clipped text | Visual verification + no CSS console errors |
| TD-LOC-002 | LTR layout in English | P0 | English locale | Review each page in `/en/...` | Layout flips to LTR correctly and all labels are readable | Visual verification |
| TD-LOC-003 | Language switch keeps equivalent route | P1 | Open a nested page like service detail or customer detail | Switch locale | Route remains on same logical page with locale prefix swapped; no reset to dashboard unless route intentionally unavailable | Route mapping and page content |
| TD-LOC-004 | Arabic + English field persistence | P1 | Forms that contain `name_ar` / `name_en` | Save Arabic and English content, refresh, switch locale | Both localized fields persist and display in the right contexts | Service/product/tenant settings rows |

## File Upload and Security Tests

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-UPL-001 | Allowed image upload | P0 | Valid JPG/PNG/WEBP files | Upload logo, staff photo, service image, product image | Upload succeeds and image renders from public URL | File exists under `/uploads`; response path valid |
| TD-UPL-002 | Disallowed file type | P0 | Non-image file for image-only upload | Try uploading `.exe`, `.js`, or random unsupported file | Upload blocked with clear validation message; no file stored | Backend upload filter rejects |
| TD-UPL-003 | Max file size enforcement | P1 | Oversized file larger than backend limit | Try upload | Request fails gracefully with meaningful message and no partial record corruption | Multer limit handling |
| TD-UPL-004 | Broken image fallback | P2 | Manually point record to missing image if possible or use tenant with no logo/image | Open page showing that image | Placeholder/fallback displays and page does not crash | `getImageUrl` fallback behavior |

## Error Handling and Resilience

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-ERR-001 | Expired access token + valid refresh token | P0 | Force an expired access token but keep valid refresh token | Trigger any tenant API request | Client refreshes token once and original request succeeds without logging user out | `POST /auth/tenant/refresh-token` then original API call |
| TD-ERR-002 | Expired/invalid refresh token | P0 | Clear or corrupt refresh token | Trigger protected API request | Client clears tokens and redirects to login with no infinite request loop | Auth requests and browser navigation |
| TD-ERR-003 | API 403 account suspended | P0 | Tenant account suspended | Open dashboard route/API-backed page | User is redirected/blocked as intended and sees suspension/payment guidance | `403` handling in API client |
| TD-ERR-004 | API server 500 handling | P0 | Trigger a backend error in test environment or mock API failure | Perform save/load action | UI shows user-friendly error, no endless spinner, retry possible | Browser console + backend logs |
| TD-ERR-005 | Network timeout handling | P1 | Simulate blocked API/network | Open API-backed page | UI handles loading failure and recovers after refresh/network restore | No app crash |

## Regression Tests for Recently Patched Subscription + Registration Flow

| Test ID | Area | Priority | Preconditions | Steps | Expected Result | API / Data Check |
| --- | --- | --- | --- | --- | --- | --- |
| TD-REG-001 | New tenant registration with one business type | P0 | Fresh email not used before | Register tenant selecting one business type and paid package | Registration succeeds and success screen appears | `POST /auth/tenant/register` returns `201`; tenant row created; subscription draft created |
| TD-REG-002 | New tenant registration with multiple business types | P0 | Fresh email not used before | Register tenant selecting `salon + spa + beauty_center` and a package | Registration succeeds; tenant record stores businessType as JSON array and settings.businessTypes too | DB `tenants.businessType` JSONB array and `settings.businessTypes` |
| TD-REG-003 | Registration requires package selection | P0 | Fresh browser session | Reach package step without selecting package and try continue/submit | UI blocks progress/submission with clear validation | No registration request sent without `selectedPackageId` |
| TD-REG-004 | Admin approval generates initial invoice for paid package | P0 | Tenant pending approval with paid package | Approve tenant in admin | Tenant becomes `payment_pending`, initial bill created, approval email has payment link | Tenant status, `bills` row type `initial`, email logs |
| TD-REG-005 | Free package approval activates tenant immediately | P0 | Pending tenant with free package | Approve in admin | Tenant becomes `active`, no payment required, tenant can log in | Tenant status and subscription active/trial state |
| TD-REG-006 | Initial payment activates paid tenant | P0 | Paid tenant approved and payment link available | Open payment page and complete fake payment | Tenant status changes to `active`, bill becomes `PAID`, subscription period matches billing cycle | Public bill payment endpoint + DB row updates |
| TD-REG-007 | Welcome email branding + RTL | P1 | Register tenant with Arabic preferred language | Check welcome email in recipient inbox | White Rifah logo renders in header and Arabic text is right-aligned RTL while English text stays LTR | Email body source has `cid:logo`, attachment inline CID, Arabic blocks `dir=rtl` |

## Suggested Execution Order

1. Run `TD-GEN-*` and `TD-DASH-*` smoke tests.
2. Run master-data modules in this order: Employees, Schedules, Services, Products.
3. Run transaction modules: Appointments, Orders, Customers.
4. Run monetization/account modules: Subscription, Bills, Financial, Payroll.
5. Run engagement modules: Messages, Notifications, Reviews, Hot Deals.
6. Run Settings, My Page, localization, and cross-module package-limit regression.
7. End with `TD-REG-*` full onboarding regression using a fresh tenant.

## QA Sign-Off Template

| Item | Value |
| --- | --- |
| Build / Commit SHA |  |
| Environment URL |  |
| Browser(s) / Device(s) |  |
| QA owner |  |
| Execution start / end |  |
| Total test cases |  |
| Passed |  |
| Failed |  |
| Blocked |  |
| Severity summary | P0:  / P1:  / P2:  |
| Release recommendation | Go / No-Go |
| Notes |  |
