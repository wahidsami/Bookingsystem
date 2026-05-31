# Tenant Dashboard Features And QA E2E Test Cases (2026-05-28)

## Scope
This document covers tenant dashboard capabilities from the tenant web app (`tenant/src/app/[locale]/dashboard/*`) and defines end-to-end QA test cases for production readiness.

## Tenant Dashboard Feature List

1. `Dashboard Home`
- What tenant admin can do: View high-level business status, quick activity, alerts, and operational summary.
- Why: Gives instant health check and priority actions.

2. `Appointments`
- What tenant admin can do: View appointment board/list, create appointments, edit appointment details, manage statuses, assign/reassign providers, view appointment details drawer.
- Why: Core scheduling engine for daily operations.

3. `POS`
- What tenant admin can do: Manage in-center payment collection and due alerts.
- Why: Converts service completion into confirmed revenue.

4. `Teams / Employees`
- What tenant admin can do: Add/edit team members, assign roles, manage permissions, schedule visibility, staff app credentials/invites, dashboard account access, payroll-related profile fields.
- Why: Workforce structure and controlled access are essential for secure operations.

5. `Schedules`
- What tenant admin can do: Configure staff schedules, recurring/period-based shifts, visibility windows, and working availability.
- Why: Enables correct slot generation and appointment load balancing.

6. `Catalog > Services`
- What tenant admin can do: Create/edit services, set pricing/duration/variants, service team assignments, payment options, gift behavior, reschedule capability.
- Why: Services are the primary commercial offering and booking object.

7. `Catalog > Products`
- What tenant admin can do: Create/edit products, inventory-aware listing, media/content management.
- Why: Supports retail upsell and non-service revenue.

8. `Catalog > Orders`
- What tenant admin can do: View customer product orders, inspect order details, track processing states.
- Why: Ensures reliable fulfillment and customer trust.

9. `Customers`
- What tenant admin can do: Browse customer profiles, appointment/purchase context, contact and service history views.
- Why: Improves retention, personalization, and support quality.

10. `Marketing > Hot Deals`
- What tenant admin can do: Create/update campaigns and promotional deal windows.
- Why: Drives traffic and conversion uplift.

11. `Marketing > Push / Notifications`
- What tenant admin can do: Send campaign notifications to customers, track delivery context.
- Why: Reactivation and direct conversion channel.

12. `Marketing > Reviews`
- What tenant admin can do: Monitor customer feedback and ratings.
- Why: Reputation management and service quality loop.

13. `Marketing > Page Setup / My Page`
- What tenant admin can do: Configure public page content, banners, hero slider, profile identity assets.
- Why: Controls customer-facing brand presentation.

14. `Gift Cards`
- What tenant admin can do: Create/manage tenant-scoped gift card packages, activation/deactivation, view package performance context.
- Why: Prepaid revenue and gifting-driven acquisition.

15. `Billing & Finance`
- What tenant admin can do: Access bills, subscription state/upgrade, financial records, payroll section where entitled.
- Why: Financial governance and subscription continuity.

16. `Reports`
- What tenant admin can do: Generate reports, preview exports, analyze operations/financial performance.
- Why: Data-driven decision support.

17. `Settings`
- What tenant admin can do: Manage business info, working hours, booking settings, notifications, payment settings, localization, team & access controls.
- Why: Defines how all major modules behave.

18. `Messages / Internal Communication` (entitlement based)
- What tenant admin can do: Access internal messaging (if package allows).
- Why: Improves operational coordination.

19. `System Navigation Controls`
- What tenant admin can do: Language switch, user menu, notification center, section-based sidebar with permission guards.
- Why: Usability and access safety across the platform.

## QA E2E Test Cases

## Test Data / Preconditions
- Tenant account with approved subscription.
- At least 2 employee accounts (service provider + non-provider).
- At least 2 services and 2 products available.
- One customer account with booking/purchase history.
- Notification and campaign permissions enabled.
- For entitlement tests: one package with feature enabled and one without.

## Authentication And Entry

1. `TD-AUTH-001` Tenant login success
- Steps: Open tenant login page, submit valid credentials.
- Expected: Redirect to dashboard home, tenant context loaded, no permission errors.

2. `TD-AUTH-002` Invalid credentials
- Steps: Submit wrong password.
- Expected: Error message shown, no session created.

3. `TD-AUTH-003` Forgot password flow
- Steps: Trigger forgot password, complete reset, login with new password.
- Expected: Reset token accepted, login succeeds with new password.

4. `TD-REG-001` New tenant registration happy path
- Steps:
- Open tenant registration page.
- Submit valid business/profile/contact details.
- Complete required uploads/fields and submit.
- Expected:
- Registration request is accepted.
- User sees confirmation message that application is under review.
- Record is created for review/approval workflow.

5. `TD-REG-002` Registration validation and duplicate checks
- Steps:
- Attempt registration with missing required fields and invalid email/phone formats.
- Retry with already-used email/identifier.
- Expected:
- Field-level validation errors shown clearly.
- Duplicate entity is blocked with correct error message.

6. `TD-REG-003` Post-approval activation to dashboard access
- Steps:
- Approve registered tenant through admin flow (or seed approved state).
- Complete required payment/subscription activation step.
- Login with tenant credentials.
- Expected:
- Tenant can access dashboard only after approval + payment/activation.
- Entitlements and initial dashboard state load correctly.

## Navigation And Layout

4. `TD-NAV-001` Sidebar section visibility by permissions
- Steps: Login as owner/full-permission, then limited dashboard account.
- Expected: Limited account only sees allowed sections; denied links blocked.

5. `TD-NAV-002` Group navigation expand/collapse
- Steps: Expand/collapse `Catalog`, `Marketing`, `Billing`.
- Expected: Children show/hide correctly; active child keeps parent visibly active.

6. `TD-NAV-003` Language switcher
- Steps: Toggle AR/EN from header.
- Expected: UI direction, labels, and routes switch consistently.

## Dashboard And Alerts

7. `TD-DB-001` Dashboard renders alerts and summaries
- Steps: Open dashboard with active alerts.
- Expected: Alerts load, counts match data source, no overlap/z-index defects.

8. `TD-DB-002` Notification center mark-all-read
- Steps: Open notification menu, click mark all read.
- Expected: Badge decreases to 0/new correct count; menu state refreshed.

## Appointments And Scheduling

9. `TD-APT-001` Create new appointment
- Steps: Go to appointments, create appointment for existing customer.
- Expected: Appointment appears on board/list with correct time/staff/status.

10. `TD-APT-002` Create appointment with guest/new customer mode
- Steps: Create appointment using guest/new customer flow.
- Expected: Appointment created without forced full member profile where allowed.

11. `TD-APT-003` Reassign provider from board
- Steps: Move/reassign appointment between staff.
- Expected: Provider changes, audit/status data updated.

12. `TD-APT-004` Blocked time single
- Steps: Add one-time blocked slot.
- Expected: Block appears on selected day/time only.

13. `TD-APT-005` Blocked time recurring/continues
- Steps: Add recurring/continues block then navigate next days.
- Expected: Block appears according to recurrence rules.

14. `TD-APT-006` Appointment detail integrity
- Steps: Open appointment details drawer.
- Expected: Service, staff, customer, status, payment, timeline are consistent.

## Teams, Access, And Schedules

15. `TD-TEAM-001` Add employee service provider
- Steps: Create employee as service provider with required fields.
- Expected: Employee saved, visible in assignments and appointment staff lists.

16. `TD-TEAM-002` Add employee dashboard-only role
- Steps: Create non-provider role with dashboard permissions.
- Expected: Dashboard account permissions enforce section restrictions.

17. `TD-TEAM-003` Employee invite/reset access
- Steps: Send invite or reset credentials from employee profile.
- Expected: Action completes with success feedback and audit-safe behavior.

18. `TD-SCH-001` Staff schedule setup with period
- Steps: Configure schedule with from/to dates.
- Expected: Slots generated only within period.

19. `TD-SCH-002` Staff schedule continues mode
- Steps: Configure continues schedule without end date.
- Expected: Future availability continues beyond current week range.

## Services, Products, Orders

20. `TD-SVC-001` Create service with pricing and duration
- Steps: Add new service with required details.
- Expected: Service appears in services list and booking flow.

21. `TD-SVC-002` Service provider assignments
- Steps: Assign specific employees to service.
- Expected: Only assigned providers appear for that service booking.

22. `TD-SVC-003` Service payment options and reschedule flag
- Steps: Toggle payment options and allow-reschedule.
- Expected: Checkout behavior and customer reschedule option follow settings.

23. `TD-PRD-001` Create product with image and price
- Steps: Add product and publish.
- Expected: Product appears in product catalog and customer-facing endpoints.

24. `TD-ORD-001` Order detail lifecycle
- Steps: Open an order, update fulfillment state.
- Expected: State transitions persist and display correctly.

## Customers, Marketing, Reviews

25. `TD-CUS-001` Customer profile detail
- Steps: Open customer detail page.
- Expected: History and profile metadata render correctly.

26. `TD-MKT-001` Create hot deal
- Steps: Add deal with valid date range.
- Expected: Deal appears in tenant dashboard and relevant public surfaces.

27. `TD-MKT-002` Push notification campaign
- Steps: Send campaign notification.
- Expected: Campaign stored, dispatch result visible, notification count updates.

28. `TD-REV-001` Reviews listing
- Steps: Open reviews page with existing reviews.
- Expected: Ratings/comments list loads with correct sorting/filter behavior.

## Page Setup And Branding

29. `TD-PAGE-001` Update public page hero/banner
- Steps: Upload/update banner/logo and save.
- Expected: Changes persist and display on public page.

30. `TD-PAGE-002` Localization content save
- Steps: Update EN/AR fields and save.
- Expected: Correct locale content appears by selected language.

## Gift Cards (Tenant Scoped)

31. `TD-GFT-001` Create tenant gift package
- Steps: Create package with amount, credit, status, optional image.
- Expected: Package appears in tenant list and customer tenant gift tab.

32. `TD-GFT-002` Activate/deactivate package
- Steps: Toggle package status.
- Expected: Inactive package hidden from purchase flow; active package visible.

33. `TD-GFT-003` Tenant gift transaction visibility
- Steps: Complete purchase in customer app; check tenant side.
- Expected: Transaction/report rows visible with purchaser/value context.

## Billing, Subscription, Finance, Payroll

34. `TD-BIL-001` Subscription page access and state
- Steps: Open subscription page and upgrade page.
- Expected: Current plan, limits, and upgrade actions render correctly.

35. `TD-FIN-001` Financial records list
- Steps: Open financial page.
- Expected: Transaction rows and totals load without mismatch.

36. `TD-PAY-001` Payroll entitlement guard
- Steps: Access payroll with and without entitlement.
- Expected: Visible only when entitled; denied state handled gracefully.

## Reports

37. `TD-RPT-001` Generate report
- Steps: Open reports generate, set filters, generate.
- Expected: Preview page shows correct filtered data.

38. `TD-RPT-002` Export/report consistency
- Steps: Export/print from preview.
- Expected: Values match on-screen preview totals and date range.

## Settings

39. `TD-SET-001` Working hours save
- Steps: Change working hours and save.
- Expected: Settings persist and affect appointment slot boundaries.

40. `TD-SET-002` Booking settings save
- Steps: Modify booking buffer/behavior settings.
- Expected: New bookings follow updated policy.

41. `TD-SET-003` Notification settings save
- Steps: Toggle notification settings.
- Expected: Saved values reflected after reload.

42. `TD-SET-004` Payment settings save
- Steps: Change payment settings and save.
- Expected: Checkout/payment option logic updates accordingly.

43. `TD-SET-005` Team access settings
- Steps: Modify team/access controls.
- Expected: Permission changes enforced after next auth/session refresh.

## Security, Reliability, And Regression

44. `TD-SEC-001` Unauthorized route direct access
- Steps: Open a restricted URL directly as limited account.
- Expected: Access denied/redirect; no sensitive data leakage.

45. `TD-REL-001` Session expiry handling
- Steps: Let session expire and attempt action.
- Expected: Redirect to login with safe error prompt.

46. `TD-REG-001` Cross-module regression sanity
- Steps: Create service -> create appointment -> collect payment -> verify report row.
- Expected: End-to-end flow completes with consistent linked data.

## QA Exit Criteria

1. All P0/P1 scenarios pass (`Auth`, `Appointments`, `Teams`, `Services`, `Settings`, `Billing`, `Reports`).
2. No permission bypass found for dashboard accounts.
3. No critical data mismatch between operational pages and reports.
4. Localization (`AR/EN`) and RTL/LTR behavior verified on all key modules.
5. Smoke run completed after latest deployment.

## Cross-Section End-To-End Scenarios

1. `TD-XMOD-001` Service launch to live booking path
- Flow: `Services` -> `Teams` assignment -> `Settings` working hours -> `Appointments` board.
- Steps:
- Create a new service.
- Assign at least one provider.
- Ensure provider has active schedule and center working hours.
- Create a new appointment for that service.
- Expected:
- Service is selectable in booking.
- Provider appears as eligible.
- Appointment lands correctly on board time slot.

2. `TD-XMOD-002` Marketing campaign conversion tracking
- Flow: `Marketing > Hot Deals` + `Marketing > Push` -> `Appointments` / `Orders` -> `Reports`.
- Steps:
- Publish a hot deal.
- Send a push campaign for the deal.
- Create a related booking/order as customer.
- Open reports filtered for campaign date range.
- Expected:
- Campaign exists and is visible.
- Booking/order appears in operational sections.
- Report totals reflect post-campaign activity.

3. `TD-XMOD-003` Team role security and operational limits
- Flow: `Teams` permissions -> restricted user login -> `Catalog` / `Billing` / `Reports`.
- Steps:
- Create dashboard account with limited permissions.
- Login with limited account.
- Attempt access to denied sections via sidebar and direct URL.
- Attempt allowed action in permitted section.
- Expected:
- Denied sections are hidden/blocked.
- Direct URL bypass is prevented.
- Allowed features work normally.

4. `TD-XMOD-004` Appointment lifecycle to payment and finance
- Flow: `Appointments` -> `POS` -> `Financial/Bills` -> `Reports`.
- Steps:
- Create and complete an appointment.
- Collect payment through POS.
- Verify entry in financial/billing views.
- Verify same transaction in reports.
- Expected:
- Status transitions are valid.
- Payment record is saved once (no duplicates).
- Finance and reports show consistent values.

5. `TD-XMOD-005` Tenant gift card lifecycle
- Flow: `Gift Cards` -> customer purchase -> `POS` redeem -> `Financial` -> `Reports`.
- Steps:
- Create active tenant gift package.
- Complete customer purchase.
- Redeem gift value at POS for appointment/order.
- Validate financial/report impact.
- Expected:
- Package appears in customer-facing flow.
- Purchase and redemption transactions are linked.
- Remaining balance logic is correct.
- Finance/report totals remain consistent.

6. `TD-XMOD-006` Public page content governance
- Flow: `Page Setup / My Page` -> public page validation -> `Reviews` sync.
- Steps:
- Update logo/banner/about content in AR/EN.
- Open public page in both locales.
- Add or view a new review and verify dashboard visibility.
- Expected:
- Public page reflects latest content per locale.
- Brand assets render correctly.
- Reviews appear in dashboard moderation/list.

7. `TD-XMOD-007` Customer support traceability
- Flow: `Customers` -> `Appointments` detail -> `Messages/Notifications` (if entitled).
- Steps:
- Open a specific customer profile.
- Navigate to their appointment history and details.
- Send an operational message/notification where available.
- Expected:
- Customer context is consistent across sections.
- Appointment detail links back to same customer.
- Communication action logs successfully.

8. `TD-XMOD-008` Subscription entitlement enforcement
- Flow: `Subscription` change -> `Navigation visibility` -> feature access (`Hot Deals`, `Reports`, `Messages`, `Payroll`).
- Steps:
- Move tenant to a package without selected entitlements.
- Reload dashboard.
- Confirm hidden/blocked features.
- Restore entitled package and verify reappearance.
- Expected:
- Entitlement gates apply immediately/after refresh as designed.
- No hidden-feature data exposure through direct URLs.

9. `TD-XMOD-009` Localization consistency audit
- Flow: All primary sections in `EN` then `AR`.
- Steps:
- Switch to EN, capture labels, dates/times/currency placement.
- Switch to AR, repeat same paths.
- Validate forms, table headers, buttons, and alerts.
- Expected:
- Texts are translated and context-correct.
- RTL layout is intact and usable.
- Functional behavior remains identical.

10. `TD-XMOD-010` Regression smoke across full dashboard
- Flow: `Dashboard` -> `Appointments` -> `Teams` -> `Services` -> `Products` -> `Orders` -> `Customers` -> `Marketing` -> `Gift Cards` -> `Billing/Finance` -> `Reports` -> `Settings`.
- Steps:
- Perform one core action in each section/subsection.
- Verify no critical console/API errors and no broken navigation.
- Expected:
- All core paths execute successfully.
- No blocker defects across modules.
