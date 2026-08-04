# Refah V2 Production Readiness Certification Matrix

**Document purpose:** master release checklist for Refah V2 before launch.  
**Audience:** QA, Product, Engineering, Release Management.  
**Scope:** tenant dashboard, public experience, backend APIs, admin surfaces, support platform, and core SaaS flows.  
**Rule:** this document is a living checklist. Update the checkboxes and module status only after runtime verification.

---

## Status Legend

- 🟢 **Certified** - all required checks passed in runtime and production evidence is attached.
- 🟡 **Partial** - module is functional but not yet fully certified, or evidence is incomplete.
- 🔴 **Blocked** - a critical defect prevents safe launch.

> **Baseline rule:** unless a module has been explicitly certified, treat it as **🟡 Partial**.

---

## Release Dashboard

| Metric | Value |
| --- | --- |
| Total modules in scope | 22 |
| Certified modules | 0 |
| Partial modules | 22 |
| Blocked modules | 0 |
| Overall completion % | 0% |
| Estimated production readiness % | 0% |
| Critical blockers | None recorded yet |
| Medium issues | None recorded yet |
| Low priority polish | None recorded yet |
| Recommended next module | Teams |

**Completion formula:** `(Certified modules ÷ Total modules) × 100`

---

## Global Acceptance Framework

Use the same baseline checklist for every module, then add the module-specific actions listed in each section.

### Functional Test Baseline

- [ ] Open the workspace directly from the sidebar.
- [ ] Load the default list / overview view.
- [ ] Create a new record where supported.
- [ ] Edit an existing record.
- [ ] Delete / archive / deactivate where supported.
- [ ] Restore / reactivate where supported.
- [ ] Search records.
- [ ] Filter records.
- [ ] Sort records.
- [ ] Paginate through results.
- [ ] Export data where supported.
- [ ] Import data where supported.
- [ ] Upload / attach files where supported.
- [ ] Download files or receipts where supported.
- [ ] Use bulk actions where supported.
- [ ] Save and re-open state where supported.
- [ ] Validate required fields.
- [ ] Verify empty state copy.
- [ ] Verify success toast / success state.
- [ ] Verify failure / error state.

### Integration Test Baseline

- [ ] Authentication is required where appropriate.
- [ ] Tenant isolation is enforced.
- [ ] Subscription limits are enforced.
- [ ] Notification events are created where expected.
- [ ] Audit trail entries are created where expected.
- [ ] Reports receive the correct canonical data.
- [ ] Analytics surfaces use live backend values.
- [ ] Storage uploads resolve to working URLs.
- [ ] Email / SMS / push events fire when designed.
- [ ] Payment-related actions persist correctly.
- [ ] AI-related actions route to the correct service.

### Security Test Baseline

- [ ] Cross-tenant access is blocked.
- [ ] Role permissions are enforced.
- [ ] Unauthorized access returns the correct error.
- [ ] Expired tokens are rejected.
- [ ] Invalid tenant context is rejected.
- [ ] File upload validation rejects invalid content.
- [ ] SQL injection payloads do not execute.
- [ ] XSS payloads are escaped or rejected.
- [ ] CSRF controls behave as expected where applicable.
- [ ] Rate limiting is active on sensitive endpoints.

### Performance Test Baseline

- [ ] List pages remain usable with large datasets.
- [ ] Pagination remains stable at scale.
- [ ] Search latency remains acceptable.
- [ ] Filtering remains responsive.
- [ ] Images load without blocking the UI.
- [ ] Concurrent actions do not corrupt state.
- [ ] Large datasets do not crash the page.

### UI Test Baseline

- [ ] Responsive layout works on desktop.
- [ ] Responsive layout works on tablet.
- [ ] Responsive layout works on mobile.
- [ ] RTL layout works correctly.
- [ ] LTR layout works correctly.
- [ ] Loading indicators appear correctly.
- [ ] Empty states render correctly.
- [ ] Validation feedback is visible and helpful.
- [ ] Success feedback is visible and helpful.
- [ ] Accessibility basics are respected.

### Production Checklist Baseline

- [ ] Database tables exist.
- [ ] API endpoints respond successfully.
- [ ] Frontend state matches backend data.
- [ ] Browser console has no application errors.
- [ ] Network requests are correct.
- [ ] Mobile layout is usable.
- [ ] Desktop layout is usable.
- [ ] Tablet layout is usable.

---

## 1. Teams

### Module Information

- **Module name:** Teams
- **Purpose:** employee management, roles, schedules, shifts, breaks, time off, payroll, staff messaging.
- **Backend endpoints:** `/api/v1/tenant/employees`, `/api/v1/tenant/employees/:id`, `/api/v1/tenant/employees/:id/permissions`, `/api/v1/tenant/employees/:id/app-access`, `/api/v1/tenant/employees/:id/send-invite`, `/api/v1/tenant/employees/:id/reset-password`, `/api/v1/tenant/employees/:id/shifts`, `/api/v1/tenant/employees/:id/breaks`, `/api/v1/tenant/employees/:id/time-off`, `/api/v1/tenant/employees/:id/overrides`, `/api/v1/tenant/payroll`, `/api/v1/tenant/messages`
- **Database tables:** `staff`, `staff_permissions`, `staff_schedules`, `staff_shifts`, `staff_breaks`, `staff_time_off`, `staff_schedule_overrides`, `staff_payroll`, `staff_messages`, `tenant_dashboard_accounts`
- **Dependencies:** authentication, tenant profile, subscription limits, uploads, schedule data, payroll feature flag

### Module-Specific Functional Tests

- [ ] Create an employee.
- [ ] Edit employee identity fields.
- [ ] Upload employee photo.
- [ ] Delete / deactivate employee.
- [ ] Invite employee to staff app.
- [ ] Reset employee password.
- [ ] Assign permissions.
- [ ] Assign app access.
- [ ] Create weekly shifts.
- [ ] Edit shifts.
- [ ] Delete shifts.
- [ ] Create breaks.
- [ ] Edit breaks.
- [ ] Delete breaks.
- [ ] Create time off.
- [ ] Edit time off.
- [ ] Delete time off.
- [ ] Manage schedule overrides.
- [ ] View payroll.
- [ ] Send staff messages where supported.

### Module-Specific Integration Tests

- [ ] Employee image uploads are saved and rendered.
- [ ] Shift data saves and reloads from the same canonical source.
- [ ] Permissions updates affect the correct staff record.
- [ ] Invites and resets use the correct backend account.
- [ ] Schedule changes survive page refresh.

### Module-Specific Security Tests

- [ ] Employee records are tenant-scoped.
- [ ] Staff image uploads reject invalid files.
- [ ] Unauthorized staff data access is blocked.
- [ ] Permission changes require the correct role.

### Module-Specific Performance Tests

- [ ] Load the directory with 100 employees.
- [ ] Open a single employee with many shifts and breaks.
- [ ] Search remains responsive with a large roster.

### Module-Specific UI Tests

- [ ] Directory cards render one employee per card.
- [ ] Employee avatar renders without a broken image icon.
- [ ] Working hours and weekly shifts render correctly.
- [ ] Tabs remain usable on tablet and mobile.

### Production Checklist

- [ ] Employee image URL returns HTTP 200.
- [ ] Schedules reload after refresh.
- [ ] No duplicate employee cards appear.
- [ ] No console errors from the Teams workspace.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** core Teams flows are present; certification requires repeated runtime verification for photo, schedule, permissions, and duplication paths.

---

## 2. Services

### Module Information

- **Module name:** Services
- **Purpose:** manage service catalog, pricing, duration, images, categories, and staff assignment.
- **Backend endpoints:** `/api/v1/services`, `/api/v1/services/:id`, `/api/v1/tenant/services`, `/api/v1/tenant/services/categories`
- **Database tables:** `services`, `service_categories`, `service_employees`
- **Dependencies:** tenant auth, subscription limits, category taxonomy, uploads, booking availability

### Module-Specific Functional Tests

- [ ] Create a service.
- [ ] Edit a service.
- [ ] Delete a service.
- [ ] Search services.
- [ ] Filter by category.
- [ ] Sort services.
- [ ] Upload service image.
- [ ] Link employees to a service.
- [ ] Update duration and price.
- [ ] Toggle active state.

### Module-Specific Integration Tests

- [ ] Category dropdown uses live categories.
- [ ] Service availability reflects linked staff.
- [ ] Service limits reflect the active subscription.
- [ ] Public booking surfaces the updated service data.

### Module-Specific Security Tests

- [ ] Tenant cannot edit another tenant's services.
- [ ] Invalid uploads are rejected.
- [ ] Service feature access respects subscription entitlements.

### Module-Specific Performance Tests

- [ ] Load 500 services.
- [ ] Filter and sort without lag.
- [ ] Images do not block list rendering.

### Module-Specific UI Tests

- [ ] Service cards render consistently.
- [ ] Category selector shows real categories.
- [ ] Empty and error states are clear.

### Production Checklist

- [ ] Service count matches backend.
- [ ] Category count matches backend.
- [ ] Uploaded image resolves correctly.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** service management must be certified against category data, images, and subscription-driven capacity.

---

## 3. Products

### Module Information

- **Module name:** Products
- **Purpose:** catalog, inventory, pricing, images, and product sales.
- **Backend endpoints:** `/api/v1/tenant/products`, `/api/v1/tenant/products/:id`, `/api/v1/orders`, `/api/v1/orders/:id`, `/api/v1/cart/products/purchase`
- **Database tables:** `products`, `orders`, `order_items`, `payment_transactions`
- **Dependencies:** tenant auth, products-and-orders entitlement, inventory availability, image storage

### Module-Specific Functional Tests

- [ ] Create a product.
- [ ] Edit a product.
- [ ] Delete a product.
- [ ] Search products.
- [ ] Filter products.
- [ ] Sort products.
- [ ] Upload product images.
- [ ] Update stock / availability.
- [ ] Sell a product through POS or cart.
- [ ] View product detail.

### Module-Specific Integration Tests

- [ ] Product counts follow the subscription entitlement.
- [ ] Product sales write to the correct order/payment records.
- [ ] Inventory changes survive refresh.

### Module-Specific Security Tests

- [ ] Product endpoints are blocked when the entitlement is unavailable.
- [ ] Cross-tenant product access is rejected.

### Module-Specific Performance Tests

- [ ] Load 500 products.
- [ ] Image-heavy catalog remains usable.

### Module-Specific UI Tests

- [ ] Product cards render correctly.
- [ ] Inventory badges are readable.
- [ ] Empty state is explicit.

### Production Checklist

- [ ] Product count matches entitlement and backend rows.
- [ ] Product image URL returns HTTP 200.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** product catalog behavior must align with entitlement limits, inventory, and order flow.

---

## 4. Customers

### Module Information

- **Module name:** Customers
- **Purpose:** customer directory, profile, history, transactions, notes, wallet, and export.
- **Backend endpoints:** `/api/v1/tenant/customers`, `/api/v1/tenant/customers/:id`, `/api/v1/tenant/customers/:id/history`, `/api/v1/tenant/customers/:id/transactions`, `/api/v1/tenant/customers/:id/profile`, `/api/v1/tenant/customers/:id/notes`, `/api/v1/tenant/customers/:id/wallet/topup`, `/api/v1/tenant/customers/export`
- **Database tables:** `customers`, `customer_invoices`, `customer_invoice_items`, `customer_invoice_events`, `payment_transactions`, `wallet_ledger_entries`, `customer_insights`
- **Dependencies:** tenant auth, appointment/payment history, wallet ledger, reports

### Module-Specific Functional Tests

- [ ] Create a customer.
- [ ] Edit customer profile.
- [ ] Delete or archive customer where supported.
- [ ] Search customers.
- [ ] Filter customers.
- [ ] Sort customer lists.
- [ ] View customer history.
- [ ] View customer transactions.
- [ ] Edit notes.
- [ ] Top up wallet.
- [ ] Export customer list.

### Module-Specific Integration Tests

- [ ] History matches the appointment and payment timeline.
- [ ] Wallet balance matches ledger entries.
- [ ] Customer notes persist across refresh.

### Module-Specific Security Tests

- [ ] Customer data is tenant-scoped.
- [ ] Wallet actions require authorization.
- [ ] Export respects permissions.

### Module-Specific Performance Tests

- [ ] Load 2,000 customers.
- [ ] Search remains responsive.
- [ ] Detail drawer opens without lag.

### Module-Specific UI Tests

- [ ] Customer card layout is stable.
- [ ] Drawer tabs render correctly.
- [ ] Empty state is helpful.

### Production Checklist

- [ ] Customer detail endpoint returns the right record.
- [ ] Wallet top-up updates after refresh.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** customers must remain consistent across history, notes, transactions, and wallet views.

---

## 5. Appointments

### Module Information

- **Module name:** Appointments
- **Purpose:** appointment creation, status, payment state, reassignment, and rescheduling.
- **Backend endpoints:** `/api/v1/bookings/create`, `/api/v1/tenant/appointments`, `/api/v1/tenant/appointments/:id`, `/api/v1/tenant/appointments/:id/status`, `/api/v1/tenant/appointments/:id/payment`, `/api/v1/tenant/appointments/:id/reassign-staff`, `/api/v1/tenant/appointments/:id/reschedule`, `/api/v1/tenant/appointments/:id/reassign-reschedule`
- **Database tables:** `appointments`, `appointment_events`, `booking_sessions`, `payment_transactions`
- **Dependencies:** customer auth, tenant auth, staff availability, payment flow, notifications

### Module-Specific Functional Tests

- [ ] Create an appointment.
- [ ] Edit appointment details.
- [ ] Cancel an appointment.
- [ ] Reassign staff.
- [ ] Reschedule the visit.
- [ ] Update payment status.
- [ ] Search appointments.
- [ ] Filter by status.
- [ ] Sort by date or time.
- [ ] Open appointment details.

### Module-Specific Integration Tests

- [ ] Booking session data matches the appointment record.
- [ ] Payment updates flow back to the appointment row.
- [ ] Status changes create event history.

### Module-Specific Security Tests

- [ ] Tenant cannot access another tenant's appointments.
- [ ] Customer booking endpoints require the right auth mode.
- [ ] Invalid appointment IDs are rejected.

### Module-Specific Performance Tests

- [ ] Load 10,000 appointments.
- [ ] Calendar and board views remain responsive.

### Module-Specific UI Tests

- [ ] Board, list, and detail layouts are usable.
- [ ] Empty state and no-results state are clear.
- [ ] Time-based controls behave correctly.

### Production Checklist

- [ ] Appointment API returns live data.
- [ ] Calendar refresh matches backend state.
- [ ] No duplicate appointment records appear.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** appointments are launch-critical and must be certified against booking, payment, and board flows.

---

## 6. Calendar

### Module Information

- **Module name:** Calendar
- **Purpose:** schedule visualization for appointments, shifts, availability, and time off.
- **Backend endpoints:** `/api/v1/tenant/appointments/calendar`, `/api/v1/tenant/appointments/board`, `/api/v1/tenant/employees/:id/shifts`, `/api/v1/tenant/employees/:id/time-off`, `/api/v1/tenant/employees/:id/overrides`
- **Database tables:** `appointments`, `staff_shifts`, `staff_time_off`, `staff_schedule_overrides`
- **Dependencies:** appointments, teams scheduling, availability rules

### Module-Specific Functional Tests

- [ ] Switch between calendar views where supported.
- [ ] Open an appointment from the calendar.
- [ ] Confirm availability displays correctly.
- [ ] Confirm blocked times display correctly.
- [ ] Confirm schedule overrides display correctly.

### Module-Specific Integration Tests

- [ ] Calendar reflects the same appointment source as the list.
- [ ] Staff availability matches the Teams schedule source.

### Module-Specific Security Tests

- [ ] Calendar access respects tenant isolation.
- [ ] Hidden or blocked data does not leak.

### Module-Specific Performance Tests

- [ ] Large appointment sets do not freeze the calendar.

### Module-Specific UI Tests

- [ ] Drag / click interactions are intuitive where supported.
- [ ] Current time indicators and day labels are readable.

### Production Checklist

- [ ] Calendar load matches the appointment API.
- [ ] Refresh does not lose visible state unexpectedly.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** calendar behavior must match appointments and scheduling data exactly.

---

## 7. POS

### Module Information

- **Module name:** POS
- **Purpose:** collections queue, transaction handling, closing summary, operational alerts, gift-card redemption.
- **Backend endpoints:** `/api/v1/tenant/pos/queue`, `/api/v1/tenant/pos/alerts`, `/api/v1/tenant/pos/alerts/:alertKey/read`, `/api/v1/tenant/pos/alerts/read-all`, `/api/v1/tenant/pos/transactions`, `/api/v1/tenant/pos/transactions/:id/receipt-pdf`, `/api/v1/tenant/pos/closing`, `/api/v1/tenant/pos/closing/export`, `/api/v1/tenant/pos/gift-cards/validate`, `/api/v1/tenant/pos/gift-cards/redeem`
- **Database tables:** `payment_transactions`, `tenant_operational_alert_reads`, `gift_card_transactions`, `tenant_wallet_ledger_entries`, `order_items`
- **Dependencies:** payments, wallet ledger, gift cards, alerts, invoice PDF generation

### Module-Specific Functional Tests

- [ ] Load the queue.
- [ ] Validate a gift card.
- [ ] Redeem a gift card.
- [ ] View transaction history.
- [ ] Download a receipt PDF.
- [ ] Open closing summary.
- [ ] Export closing summary CSV.
- [ ] Read an alert.
- [ ] Mark all alerts read.

### Module-Specific Integration Tests

- [ ] Payment and wallet records align with queue actions.
- [ ] Gift card redemption updates the canonical ledger.

### Module-Specific Security Tests

- [ ] POS endpoints require tenant access.
- [ ] Gift card validation does not leak another tenant's data.

### Module-Specific Performance Tests

- [ ] Queue remains responsive with many transactions.

### Module-Specific UI Tests

- [ ] Queue and summary panels are readable.
- [ ] PDF/download actions are obvious.

### Production Checklist

- [ ] Queue data is live.
- [ ] Receipt download returns HTTP 200.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** POS is a money-moving workspace and must be certified against queue, redemption, and receipt paths.

---

## 8. Bills

### Module Information

- **Module name:** Bills
- **Purpose:** current unpaid bill tracking, bill details, invoice and receipt PDFs.
- **Backend endpoints:** `/api/v1/tenant/bills/current-unpaid`, `/api/v1/tenant/bills`, `/api/v1/tenant/bills/:id`, `/api/v1/tenant/bills/:id/invoice-pdf`, `/api/v1/tenant/bills/:id/receipt-pdf`
- **Database tables:** `bills`, `bill_payment_attempts`
- **Dependencies:** subscription billing, financial records, PDF generation

### Module-Specific Functional Tests

- [ ] View current unpaid bill.
- [ ] List bills.
- [ ] Open bill details.
- [ ] Download invoice PDF.
- [ ] Download receipt PDF.

### Module-Specific Integration Tests

- [ ] Bill rows match the billing backend.
- [ ] PDF output matches the selected bill.

### Module-Specific Security Tests

- [ ] Bills are tenant-scoped.
- [ ] Unauthorized bill access is rejected.

### Module-Specific Performance Tests

- [ ] Bill history loads quickly.

### Module-Specific UI Tests

- [ ] Billing cards and rows are legible.

### Production Checklist

- [ ] Unpaid bill state is correct.
- [ ] PDF endpoints return HTTP 200.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** billing must be verified against invoice generation and payment history.

---

## 9. Finance

### Module Information

- **Module name:** Finance
- **Purpose:** revenue overview, ledger, employee/service/product revenue, invoices, daily summaries, and reporting.
- **Backend endpoints:** `/api/v1/tenant/financial/overview`, `/api/v1/tenant/financial/ledger`, `/api/v1/tenant/financial/landing-summary`, `/api/v1/tenant/financial/employees`, `/api/v1/tenant/financial/employees/:id`, `/api/v1/tenant/financial/services`, `/api/v1/tenant/financial/products`, `/api/v1/tenant/financial/daily`, `/api/v1/tenant/financial/invoices`, `/api/v1/tenant/financial/invoices/:id`, `/api/v1/tenant/financial/invoices/:id/invoice-pdf`, `/api/v1/tenant/financial/invoices/:id/receipt-pdf`
- **Database tables:** `payment_transactions`, `customer_invoices`, `customer_invoice_items`, `customer_invoice_events`, `tenant_wallet_ledger_entries`, `orders`, `order_items`, `appointments`
- **Dependencies:** payment ledger, invoices, refunds, discount and tax calculations, reports

### Module-Specific Functional Tests

- [ ] Open financial overview.
- [ ] Open ledger.
- [ ] Drill into employee revenue.
- [ ] Drill into service revenue.
- [ ] Drill into product revenue.
- [ ] Open daily revenue.
- [ ] List invoices.
- [ ] Open invoice detail.
- [ ] Download invoice PDF.
- [ ] Download receipt PDF.

### Module-Specific Integration Tests

- [ ] Revenue, VAT, discounts, and refunds match canonical backend values.
- [ ] Overview cards match ledger totals.
- [ ] Invoices and payment history agree.

### Module-Specific Security Tests

- [ ] Financial data is tenant-scoped.
- [ ] Unauthorized finance access is rejected.

### Module-Specific Performance Tests

- [ ] Large date ranges remain responsive.
- [ ] Ledger pagination remains stable.

### Module-Specific UI Tests

- [ ] Tables and cards render correctly.
- [ ] Summary widgets use live data, not fallback zeros.

### Production Checklist

- [ ] Financial endpoints return HTTP 200.
- [ ] No NaN values appear in rendered totals.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** finance is a production-critical domain and must be certified against ledger, invoices, and report outputs.

---

## 10. Reports

### Module Information

- **Module name:** Reports
- **Purpose:** operational reporting, saved reports, report builder, download/export, and specialized report views.
- **Backend endpoints:** `/api/v1/tenant/reports/summary`, `/api/v1/tenant/reports/builder/options`, `/api/v1/tenant/reports/full`, `/api/v1/tenant/reports/pdf`, `/api/v1/tenant/reports/saved`, `/api/v1/tenant/reports/saved/:id`, `/api/v1/tenant/reports/saved/:id/run`, `/api/v1/tenant/reports/saved/:id/preview`, `/api/v1/tenant/reports/saved/:id/deliver`, `/api/v1/tenant/reports/saved/:id/history`, `/api/v1/tenant/reports/booking-trends`, `/api/v1/tenant/reports/service-performance`, `/api/v1/tenant/reports/employee-performance`, `/api/v1/tenant/reports/peak-hours`, `/api/v1/tenant/reports/customer-analytics`, `/api/v1/tenant/reports/rebookings`, `/api/v1/tenant/reports/refunds`, `/api/v1/tenant/reports/payment-methods`, `/api/v1/tenant/reports/advanced-analytics`, `/api/v1/tenant/bi/sales-overview`
- **Database tables:** `tenant_saved_reports`, `admin_saved_reports`, `consultant_reports`, `consultant_snapshots`, `customer_insights`, `payment_transactions`, `appointments`, `orders`, `customer_invoices`
- **Dependencies:** finance, appointments, customers, subscription, export/PDF generation

### Module-Specific Functional Tests

- [ ] Open report summary.
- [ ] Open full report.
- [ ] Open report builder options.
- [ ] Create a saved report.
- [ ] Edit a saved report.
- [ ] Delete a saved report.
- [ ] Run a saved report.
- [ ] Preview a saved report.
- [ ] Deliver a saved report.
- [ ] View saved report history.
- [ ] Open booking trends.
- [ ] Open service performance.
- [ ] Open employee performance.
- [ ] Open peak hours.
- [ ] Open customer analytics.
- [ ] Open rebookings.
- [ ] Open refunds report.
- [ ] Open payment methods report.
- [ ] Open advanced analytics.

### Module-Specific Integration Tests

- [ ] Report outputs match the canonical backend slices.
- [ ] Saved reports persist and reload correctly.
- [ ] PDF / export outputs match on-screen data.

### Module-Specific Security Tests

- [ ] Reports respect tenant isolation.
- [ ] Report builder respects permissions.

### Module-Specific Performance Tests

- [ ] Large reports render within acceptable time.
- [ ] Saved report history loads quickly.

### Module-Specific UI Tests

- [ ] Report shell is stable on desktop and tablet.
- [ ] Empty states are readable.

### Production Checklist

- [ ] Report data loads from live endpoints.
- [ ] Export actions return files successfully.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** reports must be validated against finance, customer, appointment, and saved-report flows.

---

## 11. Analytics

### Module Information

- **Module name:** Analytics
- **Purpose:** customer analytics, rebooking analytics, advanced analytics, AI-assisted analysis.
- **Backend endpoints:** `/api/v1/tenant/reports/customer-analytics`, `/api/v1/tenant/reports/rebookings`, `/api/v1/tenant/reports/advanced-analytics`, `/api/v1/tenant/ai/consultant/analyze`, `/api/v1/tenant/ai/consultant/reports`, `/api/v1/tenant/ai/consultant/reports/:id`, `/api/v1/tenant/ai/consultant/briefings`, `/api/v1/tenant/ai/consultant/workflows/run`
- **Database tables:** `customer_insights`, `consultant_conversations`, `consultant_reports`, `consultant_snapshots`
- **Dependencies:** reports, customer data, appointment history, AI services

### Module-Specific Functional Tests

- [ ] Open customer analytics.
- [ ] Open rebooking analytics.
- [ ] Open advanced analytics.
- [ ] Run AI consultant analysis.
- [ ] Open AI consultant reports.
- [ ] Open AI consultant briefings.
- [ ] Run AI workflow.

### Module-Specific Integration Tests

- [ ] Analytics values match source data.
- [ ] AI outputs link to the correct tenant.

### Module-Specific Security Tests

- [ ] Analytics endpoints block cross-tenant access.
- [ ] AI actions require the intended subscription.

### Module-Specific Performance Tests

- [ ] Analytics charts remain responsive under large datasets.

### Module-Specific UI Tests

- [ ] Charts and scorecards remain readable.

### Production Checklist

- [ ] Analytics widgets show live backend values.
- [ ] AI outputs load without console errors.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** analytics must be certified against underlying reporting and AI data paths.

---

## 12. Gift Cards

### Module Information

- **Module name:** Gift Cards
- **Purpose:** gift card package management, issuance, redemption, reporting, and settlements.
- **Backend endpoints:** `/api/v1/tenant/gift-cards/packages`, `/api/v1/tenant/gift-cards/packages/:id`, `/api/v1/tenant/gift-cards/packages/:id/active`, `/api/v1/tenant/gift-cards/packages/:id/image`, `/api/v1/tenant/gift-cards/reports/summary`, `/api/v1/tenant/gift-cards/reports/transactions`, `/api/v1/tenant/gift-cards/reports/transactions.csv`, `/api/v1/tenant/gift-cards/reports/redemptions`, `/api/v1/tenant/cart/gift-cards/purchase`, `/api/v1/tenant/pos/gift-cards/validate`, `/api/v1/tenant/pos/gift-cards/redeem`
- **Database tables:** `gift_card_packages`, `gift_card_codes`, `gift_card_transactions`, `gift_card_code_redemptions`, `tenant_gift_card_packages`, `tenant_gift_card_transactions`, `tenant_gift_card_settlements`
- **Dependencies:** POS, wallet, payments, uploads, reporting

### Module-Specific Functional Tests

- [ ] Create a gift card package.
- [ ] Edit a gift card package.
- [ ] Activate / deactivate a package.
- [ ] Upload package artwork.
- [ ] Issue a gift card.
- [ ] Redeem a gift card.
- [ ] View summary report.
- [ ] View transaction report.
- [ ] Export transaction CSV.
- [ ] View redemption report.

### Module-Specific Integration Tests

- [ ] Gift card issuance writes to the correct transaction tables.
- [ ] Redemption is reflected in POS and reports.

### Module-Specific Security Tests

- [ ] Gift card operations are tenant-scoped.
- [ ] Invalid redemption requests are rejected.

### Module-Specific Performance Tests

- [ ] Large gift card histories render cleanly.

### Module-Specific UI Tests

- [ ] Package cards render correctly.
- [ ] Upload preview works.

### Production Checklist

- [ ] Package image URL returns HTTP 200.
- [ ] Reports match the issued and redeemed totals.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** gift cards must be certified across package CRUD, issuance, redemption, and reports.

---

## 13. Memberships

### Module Information

- **Module name:** Memberships
- **Purpose:** SaaS subscription browsing, current plan, usage, consumption, alerts, and plan changes.
- **Backend endpoints:** `/api/v1/subscriptions/packages`, `/api/v1/subscription/current`, `/api/v1/subscription/usage`, `/api/v1/subscription/consumption`, `/api/v1/subscription/alerts`, `/api/v1/subscription/alerts/:alertId/acknowledge`, `/api/v1/subscription/change-request`, `/api/v1/subscription/request-upgrade`
- **Database tables:** `tenant_subscriptions`, `subscription_packages`, `tenant_usage`, `tenant_feature_usage`, `tenant_settings`
- **Dependencies:** authentication, billing, entitlements, tenant plan state

### Module-Specific Functional Tests

- [ ] Browse packages.
- [ ] Open current subscription.
- [ ] View usage.
- [ ] View consumption.
- [ ] View alerts.
- [ ] Acknowledge alerts.
- [ ] Submit change request.
- [ ] Request upgrade.

### Module-Specific Integration Tests

- [ ] Subscription state is the canonical source of truth.
- [ ] Usage counters match entitlement rules.

### Module-Specific Security Tests

- [ ] Subscription data is tenant-scoped.
- [ ] Invalid tokens cannot inspect subscription state.

### Module-Specific Performance Tests

- [ ] Usage panels render without lag.

### Module-Specific UI Tests

- [ ] Plan cards and usage bars are readable.

### Production Checklist

- [ ] Active plan matches backend subscription rows.
- [ ] Limits and consumption match the package definition.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** subscription behavior must be verified end-to-end because it gates other modules.

---

## 14. Hot Deals

### Module Information

- **Module name:** Hot Deals
- **Purpose:** promotional deal creation, scheduling, activation, quota tracking, and admin approval.
- **Backend endpoints:** `/api/v1/hot-deals`, `/api/v1/tenant/hot-deals/limits`, `/api/v1/tenant/hot-deals`, `/api/v1/tenant/hot-deals/:id`, `/api/v1/tenant/hot-deals/:id/pause`, `/api/v1/tenant/hot-deals/:id/resume`, `/api/v1/tenant/hot-deals/:id`, `/api/v1/admin/hot-deals`, `/api/v1/admin/hot-deals/pending`, `/api/v1/admin/hot-deals/:id/approve`, `/api/v1/admin/hot-deals/:id/reject`
- **Database tables:** `hot_deals`, `tenant_feature_usage`, `subscription_packages`, `tenants`
- **Dependencies:** subscription entitlement, image uploads, admin approval, tenant status

### Module-Specific Functional Tests

- [ ] Create a hot deal.
- [ ] Edit a hot deal.
- [ ] Pause a hot deal.
- [ ] Resume a hot deal.
- [ ] Delete a hot deal.
- [ ] Search hot deals.
- [ ] Filter by status.
- [ ] Inspect quota usage.

### Module-Specific Integration Tests

- [ ] Quota values come from the active subscription.
- [ ] Tenant and admin views see the same deal state.

### Module-Specific Security Tests

- [ ] Tenant cannot exceed quota.
- [ ] Admin approval endpoints are protected.

### Module-Specific Performance Tests

- [ ] Large deal lists remain responsive.

### Module-Specific UI Tests

- [ ] Quota widget is readable.
- [ ] Empty state is clear when no deals exist.

### Production Checklist

- [ ] Hot deal counts match the package entitlement.
- [ ] Dashboard reflects live quota data.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** hot deal quota and entitlement flow must remain aligned with the subscribed package.

---

## 15. Push Notifications

### Module Information

- **Module name:** Push Notifications
- **Purpose:** campaign usage, image upload, sending, history, recipients, and delivery logs.
- **Backend endpoints:** `/api/v1/tenant/notifications/usage`, `/api/v1/tenant/notifications/image`, `/api/v1/tenant/notifications/send`, `/api/v1/tenant/notifications/history`, `/api/v1/tenant/notifications/history/:id`, `/api/v1/tenant/notifications/history/:id/recipients`, `/api/v1/tenant/notifications/delivery-logs`
- **Database tables:** `tenant_push_campaigns`, `tenant_push_campaign_recipients`, `tenant_push_usage`, `mobile_push_tokens`, `notification_delivery_logs`
- **Dependencies:** subscription entitlement, uploads, push tokens, delivery infrastructure

### Module-Specific Functional Tests

- [ ] Upload an image.
- [ ] Send a push notification.
- [ ] Inspect notification history.
- [ ] Inspect recipients.
- [ ] Inspect delivery logs.
- [ ] Refresh usage telemetry.

### Module-Specific Integration Tests

- [ ] Usage counters match the subscription.
- [ ] Recipients and delivery logs match the sent campaign.

### Module-Specific Security Tests

- [ ] Notification endpoints are tenant-scoped.
- [ ] Invalid uploads are rejected.

### Module-Specific Performance Tests

- [ ] Large recipient lists remain manageable.

### Module-Specific UI Tests

- [ ] Composer and history views are readable.

### Production Checklist

- [ ] Usage and delivery data are live.
- [ ] Campaign image URL returns HTTP 200.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** push notifications must be certified against quota, sending, and delivery logging.

---

## 16. Messages

### Module Information

- **Module name:** Messages
- **Purpose:** internal staff messaging.
- **Backend endpoints:** `/api/v1/tenant/messages`
- **Database tables:** `staff_messages`, `support_messages` where applicable to the support surface
- **Dependencies:** tenant auth, internal messaging entitlement, staff roles

### Module-Specific Functional Tests

- [ ] List messages.
- [ ] Send a message.
- [ ] Delete a message.
- [ ] Read and unread states update correctly.

### Module-Specific Integration Tests

- [ ] Messages are delivered to the correct staff members.
- [ ] Message deletion respects permissions.

### Module-Specific Security Tests

- [ ] Internal messages are not exposed to tenant-facing endpoints.
- [ ] Message access respects role permissions.

### Module-Specific Performance Tests

- [ ] Message list remains responsive with many rows.

### Module-Specific UI Tests

- [ ] Composer is easy to use on desktop and mobile.

### Production Checklist

- [ ] Send / list endpoints return live data.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** messaging must remain role-aware and consistent with read state and visibility rules.

---

## 17. AI Consultant

### Module Information

- **Module name:** AI Consultant
- **Purpose:** AI-assisted product/service generation and consultant analysis.
- **Backend endpoints:** `/api/v1/tenant/ai/generate-product`, `/api/v1/tenant/ai/generate-service`, `/api/v1/tenant/ai/generate-about-us`, `/api/v1/tenant/ai/translate`, `/api/v1/tenant/ai/consultant/analyze`, `/api/v1/tenant/ai/consultant/reports`, `/api/v1/tenant/ai/consultant/reports/:id`, `/api/v1/tenant/ai/consultant/briefings`, `/api/v1/tenant/ai/consultant/briefings/:id`, `/api/v1/tenant/ai/consultant/workflows/run`
- **Database tables:** `consultant_conversations`, `consultant_reports`, `consultant_snapshots`
- **Dependencies:** AI service, reports, subscription entitlement, tenant context

### Module-Specific Functional Tests

- [ ] Generate product copy.
- [ ] Generate service copy.
- [ ] Generate about-us content.
- [ ] Translate text.
- [ ] Run consultant analysis.
- [ ] Open consultant reports.
- [ ] Open consultant briefings.
- [ ] Run consultant workflows.

### Module-Specific Integration Tests

- [ ] AI outputs are tenant-scoped.
- [ ] AI outputs persist in the expected records.

### Module-Specific Security Tests

- [ ] Unauthorized AI access is rejected.
- [ ] Entitlement gating works correctly.

### Module-Specific Performance Tests

- [ ] AI requests return without UI lockups.

### Module-Specific UI Tests

- [ ] Loading and result states are clear.

### Production Checklist

- [ ] AI endpoints return stable responses.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** AI features must be certified against entitlement, persistence, and error handling.

---

## 18. Settings

### Module Information

- **Module name:** Settings
- **Purpose:** tenant profile, business info, working hours, booking, notifications, payment, localization, dashboard, appearance, logo, and cover image.
- **Backend endpoints:** `/api/v1/tenant/settings/limits`, `/api/v1/tenant/settings`, `/api/v1/tenant/settings/business`, `/api/v1/tenant/settings/working-hours`, `/api/v1/tenant/settings/booking`, `/api/v1/tenant/settings/notifications`, `/api/v1/tenant/settings/payment`, `/api/v1/tenant/settings/localization`, `/api/v1/tenant/settings/dashboard`, `/api/v1/tenant/settings/appearance`, `/api/v1/tenant/settings/logo`, `/api/v1/tenant/settings/cover`
- **Database tables:** `tenant_settings`, `tenants`, `global_settings`
- **Dependencies:** authentication, uploads, localization, dashboard preferences, booking settings

### Module-Specific Functional Tests

- [ ] Update business info.
- [ ] Update working hours.
- [ ] Update booking rules.
- [ ] Update notification settings.
- [ ] Update payment settings.
- [ ] Update localization settings.
- [ ] Update dashboard settings.
- [ ] Update appearance settings.
- [ ] Upload logo.
- [ ] Upload cover image.

### Module-Specific Integration Tests

- [ ] Settings persist after refresh.
- [ ] Settings are reflected in the dashboard shell.

### Module-Specific Security Tests

- [ ] Settings are tenant-scoped.
- [ ] Invalid uploads are rejected.

### Module-Specific Performance Tests

- [ ] Settings pages load quickly.

### Module-Specific UI Tests

- [ ] Tabs and form sections are readable.
- [ ] Upload previews are clear.

### Production Checklist

- [ ] Settings endpoints return live data.
- [ ] Logo / cover URLs return HTTP 200.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** settings affect many other modules and must be certified as the canonical tenant configuration source.

---

## 19. Profile

### Module Information

- **Module name:** Profile
- **Purpose:** tenant profile and authenticated identity display.
- **Backend endpoints:** `/api/v1/tenant/profile`
- **Database tables:** `tenants`, `tenant_dashboard_accounts`
- **Dependencies:** authentication, tenant session, settings

### Module-Specific Functional Tests

- [ ] Open profile page.
- [ ] Update profile where supported.
- [ ] Refresh session and reload profile.

### Module-Specific Integration Tests

- [ ] Profile data is loaded from the current tenant record.
- [ ] Authenticated redirect works correctly.

### Module-Specific Security Tests

- [ ] Guest users cannot access profile data.
- [ ] Invalid sessions are rejected.

### Module-Specific Performance Tests

- [ ] Profile loads quickly after login.

### Module-Specific UI Tests

- [ ] Profile header is readable on all breakpoints.

### Production Checklist

- [ ] Profile endpoint returns the active tenant.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** profile is a foundational identity surface and must stay consistent with auth state.

---

## 20. Subscription

### Module Information

- **Module name:** Subscription
- **Purpose:** subscription browsing, current plan, usage, limit breakdown, and upgrade requests.
- **Backend endpoints:** `/api/v1/subscriptions/packages`, `/api/v1/subscription/current`, `/api/v1/subscription/usage`, `/api/v1/subscription/consumption`, `/api/v1/subscription/alerts`, `/api/v1/subscription/alerts/:alertId/acknowledge`, `/api/v1/subscription/change-request`, `/api/v1/subscription/request-upgrade`
- **Database tables:** `tenant_subscriptions`, `subscription_packages`, `tenant_usage`, `tenant_feature_usage`
- **Dependencies:** billing, entitlements, tenant status, package definitions

### Module-Specific Functional Tests

- [ ] View packages.
- [ ] View current plan.
- [ ] View usage snapshot.
- [ ] View consumption breakdown.
- [ ] View alerts.
- [ ] Acknowledge alerts.
- [ ] Request upgrade or change.

### Module-Specific Integration Tests

- [ ] The active package is the source of truth.
- [ ] Usage and limits match package definitions.

### Module-Specific Security Tests

- [ ] Tenant cannot inspect another tenant's subscription.

### Module-Specific Performance Tests

- [ ] Usage and limit panels render quickly.

### Module-Specific UI Tests

- [ ] Plan cards and usage bars are readable.

### Production Checklist

- [ ] Subscription data matches the active database row.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** subscriptions drive permissions and must be certified before dependent modules are considered ready.

---

## 21. Billing

### Module Information

- **Module name:** Billing
- **Purpose:** bill tracking, bill details, invoice PDFs, receipt PDFs, and payment link handling.
- **Backend endpoints:** `/api/v1/tenant/bills/current-unpaid`, `/api/v1/tenant/bills`, `/api/v1/tenant/bills/:id`, `/api/v1/tenant/bills/:id/invoice-pdf`, `/api/v1/tenant/bills/:id/receipt-pdf`, `/api/v1/tenant/subscription/payment`, `/api/v1/tenant/subscription/payment?token=...`
- **Database tables:** `bills`, `bill_payment_attempts`, `tenant_subscriptions`, `customer_invoices`
- **Dependencies:** subscription lifecycle, payment links, email delivery, PDF generation

### Module-Specific Functional Tests

- [ ] Open billing page.
- [ ] View bills.
- [ ] Download invoice.
- [ ] Download receipt.
- [ ] Open payment session from a link.
- [ ] Complete payment flow if applicable.

### Module-Specific Integration Tests

- [ ] Payment link uses the current tenant session correctly.
- [ ] Paid status matches the backend record.

### Module-Specific Security Tests

- [ ] Invalid or expired payment links are rejected safely.
- [ ] Unauthorized billing access is rejected.

### Module-Specific Performance Tests

- [ ] Billing history remains responsive.

### Module-Specific UI Tests

- [ ] Invoice tables and status badges are clear.

### Production Checklist

- [ ] Payment link endpoint resolves correctly.
- [ ] Billing assets render correctly.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** billing must be verified against subscription payment flows and invoice generation.

---

## 22. Support

### Module Information

- **Module name:** Support
- **Purpose:** support tickets, conversation messages, attachments, categories, assignment, status, priority, read state, and audit trail.
- **Backend endpoints:** `/api/v1/tenant/support/tickets`, `/api/v1/tenant/support/tickets/:id`, `/api/v1/tenant/support/tickets/:id/messages`, `/api/v1/tenant/support/tickets/:id/attachments`, `/api/v1/tenant/support/tickets/:id/assign`, `/api/v1/tenant/support/tickets/:id/unassign`, `/api/v1/tenant/support/tickets/:id/status`, `/api/v1/tenant/support/tickets/:id/priority`, `/api/v1/tenant/support/tickets/:id/category`, `/api/v1/tenant/support/tickets/:id/reopen`, `/api/v1/tenant/support/tickets/:id/close`, `/api/v1/tenant/support/tickets/:id/read`, `/api/v1/tenant/support/categories`
- **Database tables:** `support_tickets`, `support_messages`, `support_attachments`, `support_categories`, `support_agents`, `support_ticket_events`, `support_ticket_links`, `support_ticket_notification_events`, `support_ticket_read_states`
- **Dependencies:** tenant auth, admin auth, attachments, notifications, role permissions, tenant support context

### Module-Specific Functional Tests

- [ ] Create a ticket.
- [ ] View ticket list.
- [ ] Open ticket details.
- [ ] Reply to a ticket.
- [ ] Attach files to a message.
- [ ] Assign a ticket.
- [ ] Unassign a ticket.
- [ ] Change ticket status.
- [ ] Change ticket priority.
- [ ] Change ticket category.
- [ ] Reopen a ticket.
- [ ] Close a ticket.
- [ ] Mark a ticket as read.
- [ ] Manage categories in super admin.

### Module-Specific Integration Tests

- [ ] Ticket events, notifications, and read state are written correctly.
- [ ] Tenant-facing and admin-facing ticket views stay in sync.
- [ ] Internal messages stay hidden from tenant-facing endpoints.

### Module-Specific Security Tests

- [ ] Ticket access is tenant-scoped.
- [ ] Support agent and super admin permissions are enforced.
- [ ] Attachments are validated.
- [ ] Category management is protected.

### Module-Specific Performance Tests

- [ ] Ticket queues remain usable at scale.

### Module-Specific UI Tests

- [ ] Conversation timeline is linear and readable.
- [ ] Attachments and composer work on desktop and mobile.

### Production Checklist

- [ ] Ticket creation returns a visible record in the queue.
- [ ] Ticket reply reaches the correct admin/support surface.

### Acceptance Criteria

- **Status:** 🟡 Partial
- **Explanation:** support is a conversation platform and must be validated end-to-end for ticketing, visibility, and notifications.

---

## Final Release Checklist

- [ ] Every module has a module owner.
- [ ] Every module has a current status recorded.
- [ ] Every module has runtime evidence attached.
- [ ] Every module has a green path for authentication.
- [ ] Every module has tenant isolation evidence.
- [ ] Every module has subscription / entitlement evidence where applicable.
- [ ] Every module has upload validation evidence where applicable.
- [ ] Every module has browser console verification.
- [ ] Every module has network verification.
- [ ] Every module has a rollback / recovery note if it is blocked.

## Release Dashboard Update Rules

- When a module passes all checks, update its status to **🟢 Certified**.
- When a module is partially verified, keep it **🟡 Partial**.
- When a blocker is discovered, set it to **🔴 Blocked** and link the issue.
- Recalculate the dashboard counts after every change.

## Recommended Next Module

**Teams** is the recommended next module because it touches employee identity, uploads, schedules, and subscription enforcement.

