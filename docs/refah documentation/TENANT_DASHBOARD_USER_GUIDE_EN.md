# Refah Tenant Dashboard - Full User Documentation (v1)

Date: 2026-05-17
Audience: Tenant Owner / Tenant Admin / Operations Team
Scope: Tenant dashboard web app end-to-end guidance (registration through daily operations)

## 1) Purpose of This Document
This document explains the Tenant Dashboard in a complete, operational way:
1. What each page/section is.
2. What each section can do.
3. How to use each section step by step.
4. Recommended sequence for tenant onboarding and go-live.

---

## 2) Tenant Journey Overview

## 2.1 High-Level Lifecycle
1. Register tenant account.
2. Complete onboarding and business profile.
3. Wait for platform approval/acceptance (if approval flow is enabled).
4. Configure core operations:
- Team
- Services
- Schedules
- Payments and billing settings
5. Start receiving/managing appointments.
6. Operate daily using dashboard modules (appointments, POS, customers, reports, payroll, reviews, notifications).

## 2.2 Recommended First-Time Setup Order
1. My Page / Settings: complete business identity and contact details.
2. Employees: add team members.
3. Services: add services and assign providers.
4. Schedules: define working hours and shifts.
5. Products (if selling products).
6. Appointments: test booking + confirmation + status flow.
7. POS: validate payment flow and receipts.
8. Reports / Financial / Payroll: verify numbers and reconciliation.

---

## 3) Authentication and Access

## 3.1 Register
What it is:
- Creates the tenant account and initial admin identity.

What you can do:
- Submit business and owner information.
- Create login credentials.

How to use:
1. Open `Register` page.
2. Enter owner/admin details.
3. Enter tenant/business details.
4. Submit.
5. Verify email/phone if prompted.

## 3.2 Login
What it is:
- Access gateway for tenant dashboard.

How to use:
1. Open `Login`.
2. Enter email + password.
3. Complete 2FA/OTP if configured.
4. Land on Dashboard Home.

## 3.3 Forgot Password
What it is:
- Recovery flow for locked-out admins.

How to use:
1. Open `Forgot Password`.
2. Enter account email.
3. Use reset link/code.
4. Set new password.

## 3.4 Acceptance / Approval State
What it is:
- Some environments require platform approval before full tenant activation.

What it affects:
- Access to paid features.
- Ability to receive live bookings.

Operational note:
- If tenant is pending approval, finish profile + compliance data quickly to avoid activation delays.

---

## 4) Dashboard Home (`/dashboard`)
What it is:
- Operational summary screen.

What it can do:
- Show key activity/alerts.
- Shortcut to urgent tasks.

How to use:
1. Review today’s summary.
2. Check pending items (payments, no-shows, alerts).
3. Jump to Appointments, POS, or Notifications.

---

## 5) Appointments (`/dashboard/appointments`)

## 5.1 What It Is
Central calendar + list management for bookings.

## 5.2 Main Capabilities
1. Board view by provider/time.
2. Open appointment details drawer.
3. Reassign provider by drag/drop.
4. Reschedule and rebook.
5. Manage blocked time.
6. Update appointment status manually (Booked/Confirmed/Arrived/Started/No-show/Cancelled/Completed).

## 5.3 How to Use (Board View)
1. Select date using header controls.
2. Filter scheduled team or show all providers.
3. Click a card to open details drawer.
4. Use drawer actions:
- Rebook (creates new appointment)
- Reschedule (now in-drawer flow)
- Update status
5. Drag card to another provider/time when needed.

## 5.4 Appointment Status Rules (Operational)
1. New booking default: `Booked` (pending confirmation if applicable).
2. Customer confirms attendance: `Confirmed`.
3. Customer declines attendance: `Cancelled`.
4. Staff updates service lifecycle: `Arrived` -> `Started` -> `Completed`.
5. No attendance: `No-show`.

## 5.5 Payment Status Consistency
- Always verify payment state in both:
1. Appointment details context.
2. Customer Transactions tab.
- Investigate mismatches immediately (usually incomplete transaction capture or stale sync).

---

## 6) Appointments Details Page (`/dashboard/appointments/[id]`)
What it is:
- Full-page deep view of one booking.

Use cases:
1. Complex investigation.
2. Historical notes/references.
3. Full context beyond quick drawer.

---

## 7) Customers (`/dashboard/customers`)

## 7.1 What It Is
Customer CRM for booking history, spend, and engagement.

## 7.2 What It Can Do
1. View customer profile.
2. View appointments/orders/transactions.
3. Identify high-value, no-show, or inactive customers.

## 7.3 How to Use
1. Search customer by name/phone/email.
2. Open profile.
3. Review tabs:
- Overview
- Appointments
- Transactions
4. Use insights for retention actions.

---

## 8) Employees (`/dashboard/employees`)

## 8.1 What It Is
Team management for providers/staff.

## 8.2 What It Can Do
1. Add/edit employees.
2. Assign service capabilities.
3. Configure shift patterns.
4. Track staff availability impact on booking.

## 8.3 How to Use
1. Add employee profile.
2. Assign services employee can deliver.
3. Set recurring/specific schedule.
4. Save and validate in Appointments board.

---

## 9) Services (`/dashboard/services`)

## 9.1 What It Is
Catalog of bookable services.

## 9.2 What It Can Do
1. Create services and variants.
2. Set duration and pricing.
3. Control staff eligibility per service.

## 9.3 How to Use
1. Add service name and details.
2. Configure price and duration.
3. Add variants (if needed).
4. Assign valid providers.
5. Publish and test bookability.

---

## 10) Schedules (`/dashboard/schedules`)
What it is:
- Working-hours and shift orchestration.

What it can do:
1. Define recurring shifts.
2. Add exceptions/specific-date changes.
3. Control appointment slot generation.

How to use:
1. Set weekly schedule baseline.
2. Add break windows.
3. Apply holiday/special-day overrides.
4. Verify slot output in Appointments.

---

## 11) POS (`/dashboard/pos`)

## 11.1 What It Is
Point-of-sale operations for in-branch payments.

## 11.2 What It Can Do
1. Collect payment for appointments/products.
2. Register payment method.
3. Produce transaction records and receipts.

## 11.3 How to Use
1. Open POS.
2. Select customer and payable item.
3. Choose payment method.
4. Confirm payment.
5. Verify transaction appears in records.

---

## 12) Orders (`/dashboard/orders`)
What it is:
- Product order management.

What it can do:
1. View and process incoming orders.
2. Update order status.
3. Follow payment state and delivery mode.

How to use:
1. Open order details.
2. Validate payment status.
3. Update fulfillment status.

---

## 13) Products (`/dashboard/products`)
What it is:
- Product catalog for sale.

What it can do:
1. Add/edit product inventory listing.
2. Set price and basic metadata.
3. Manage product availability.

How to use:
1. Create product.
2. Set image/name/price/description.
3. Save and verify in app storefront.

---

## 14) Bills (`/dashboard/bills`)
What it is:
- Invoice/billing obligations area.

What it can do:
1. View outstanding bills.
2. Track payment attempts.
3. Confirm settlement state.

How to use:
1. Open bill.
2. Check due date and amount.
3. Pay and confirm status update.

---

## 15) Financial (`/dashboard/financial`)
What it is:
- Revenue and financial analysis overview.

What it can do:
1. Monitor income windows.
2. Compare service/provider performance.
3. Validate net collections.

How to use:
1. Set date range.
2. Review totals and breakdowns.
3. Export/compare with POS and payroll.

---

## 16) Payroll (`/dashboard/payroll`)
What it is:
- Staff payout and payroll support.

What it can do:
1. Calculate payable values.
2. Track compensation basis.

How to use:
1. Filter by cycle/date.
2. Review provider performance contribution.
3. Confirm payout records.

---

## 17) Reports (`/dashboard/reports`)

## 17.1 What It Is
Formal reporting center.

## 17.2 What It Can Do
1. Generate operational/financial reports.
2. Preview and export outputs.

## 17.3 How to Use
1. Open `Generate`.
2. Select report type + date range.
3. Generate and preview.
4. Export if needed.

---

## 18) Reviews (`/dashboard/reviews`)
What it is:
- Customer feedback management.

What it can do:
1. Read incoming reviews.
2. Identify service quality issues.

How to use:
1. Filter by rating/time.
2. Escalate recurring complaints.
3. Feed insights to team coaching.

---

## 19) Hot Deals (`/dashboard/hot-deals`)
What it is:
- Promotions/campaign management.

What it can do:
1. Create offers.
2. Define validity windows.
3. Boost demand on selected services/products.

How to use:
1. Create deal.
2. Set terms and period.
3. Publish and monitor conversions.

---

## 20) Messages (`/dashboard/messages`)
What it is:
- Messaging center.

What it can do:
1. View communication threads/notifications context.
2. Follow customer communication history.

How to use:
1. Open thread.
2. Review context before response/action.

---

## 21) Notifications (`/dashboard/notifications`)
What it is:
- Alert inbox for operational events.

What it can do:
1. Show appointment/payment/system alerts.
2. Mark read/dismiss.

How to use:
1. Check new alerts at start/end of shift.
2. Resolve high-priority items first.

---

## 22) Subscription (`/dashboard/subscription`)
What it is:
- Plan and limits management.

What it can do:
1. View plan entitlements.
2. Track usage/limits.
3. Upgrade plan.

How to use:
1. Open subscription status.
2. Check active limits.
3. Upgrade before blocking thresholds are reached.

---

## 23) Settings (`/dashboard/settings`)
What it is:
- Tenant-wide configuration.

What it can do:
1. Business identity and account settings.
2. Operational defaults.
3. Control parts of tenant profile exposure.

How to use:
1. Fill all required business details.
2. Verify contact channels.
3. Confirm policy and branding settings.

---

## 24) My Page (`/dashboard/mypage`)
What it is:
- Public presence/brand-facing setup area.

What it can do:
1. Configure elements seen by customers.
2. Adjust presentation components.

How to use:
1. Update business visuals/details.
2. Validate changes in customer app/web views.

---

## 25) Page Setup (`/dashboard/page-setup`)
What it is:
- Structured control of public page tabs/content.

What it can do:
1. Show/hide sections (`Services`, `Products`, `Reviews`, `About`).
2. Configure About and media/content blocks.
3. Manage location/contact presentation.

How to use:
1. Open `Page Setup`.
2. Configure tab visibility.
3. Update about content.
4. Save and verify rendering on customer side.

---

## 26) Day-1 Go-Live Checklist for Tenant Admin
1. Account active and approved.
2. Business profile complete.
3. Team added with schedule.
4. Services configured with assigned providers.
5. Booking test completed from customer side.
6. Confirmation flow tested (attend/cancel).
7. POS payment test completed.
8. Appointment/payment status consistency verified.
9. Notifications working.
10. Reports generation tested.

---

## 27) Daily Operations Checklist
1. Open Notifications and clear urgent alerts.
2. Review today Appointments board.
3. Confirm provider availability and shifts.
4. Monitor payment pending/overdue cases.
5. Close day with POS/Financial reconciliation.

---

## 28) Common Operational Mistakes to Avoid
1. Creating services before assigning capable staff.
2. Ignoring schedule exceptions, causing slot conflicts.
3. Updating appointment status without verifying payment state.
4. Using Rebook when intent is Reschedule (or vice versa).
5. Delaying subscription upgrade when limits are close.

---

## 29) Roles and Permissions (Recommended Policy)
1. Owner/Admin:
- Full access to financial, subscription, settings, team, services.
2. Operations Manager:
- Appointments, customers, schedules, POS, messages.
3. Front Desk:
- Appointments, customer check-in, POS collection.
4. Marketing user:
- My Page, Page Setup, Hot Deals, Reviews.

---

## 30) Versioning and Next Steps
This is Documentation v1 for Tenant Dashboard.

Suggested next document phases:
1. Add screenshots per page and per critical workflow.
2. Add Arabic version (`TENANT_DASHBOARD_USER_GUIDE_AR.md`).
3. Add role-specific quick guides (Owner, Front Desk, Scheduler).
4. Add troubleshooting playbook (auth errors, payment mismatch, slot conflicts, notification issues).
