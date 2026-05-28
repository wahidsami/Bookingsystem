export type QACase = {
  id: string;
  title: string;
  steps: string[];
  expected: string[];
};

export type QASection = {
  key: string;
  title: string;
  cases: QACase[];
};

export const qaPreconditions: string[] = [
  "Tenant account with approved subscription.",
  "At least 2 employee accounts (service provider + non-provider).",
  "At least 2 services and 2 products available.",
  "One customer account with booking/purchase history.",
  "Notification and campaign permissions enabled.",
  "For entitlement tests: one package with feature enabled and one without."
];

export const qaSections: QASection[] = [
  {
    key: "auth-entry",
    title: "Authentication And Entry",
    cases: [
      { id: "TD-AUTH-001", title: "Tenant login success", steps: ["Open tenant login page, submit valid credentials."], expected: ["Redirect to dashboard home, tenant context loaded, no permission errors."] },
      { id: "TD-AUTH-002", title: "Invalid credentials", steps: ["Submit wrong password."], expected: ["Error message shown, no session created."] },
      { id: "TD-AUTH-003", title: "Forgot password flow", steps: ["Trigger forgot password, complete reset, login with new password."], expected: ["Reset token accepted, login succeeds with new password."] },
      { id: "TD-REG-001", title: "New tenant registration happy path", steps: ["Open tenant registration page.", "Submit valid business/profile/contact details.", "Complete required uploads/fields and submit."], expected: ["Registration request is accepted.", "User sees confirmation message that application is under review.", "Record is created for review/approval workflow."] },
      { id: "TD-REG-002", title: "Registration validation and duplicate checks", steps: ["Attempt registration with missing required fields and invalid email/phone formats.", "Retry with already-used email/identifier."], expected: ["Field-level validation errors shown clearly.", "Duplicate entity is blocked with correct error message."] },
      { id: "TD-REG-003", title: "Post-approval activation to dashboard access", steps: ["Approve registered tenant through admin flow (or seed approved state).", "Complete required payment/subscription activation step.", "Login with tenant credentials."], expected: ["Tenant can access dashboard only after approval + payment/activation.", "Entitlements and initial dashboard state load correctly."] }
    ]
  },
  {
    key: "nav-layout",
    title: "Navigation And Layout",
    cases: [
      { id: "TD-NAV-001", title: "Sidebar section visibility by permissions", steps: ["Login as owner/full-permission, then limited dashboard account."], expected: ["Limited account only sees allowed sections; denied links blocked."] },
      { id: "TD-NAV-002", title: "Group navigation expand/collapse", steps: ["Expand/collapse Catalog, Marketing, Billing."], expected: ["Children show/hide correctly; active child keeps parent visibly active."] },
      { id: "TD-NAV-003", title: "Language switcher", steps: ["Toggle AR/EN from header."], expected: ["UI direction, labels, and routes switch consistently."] }
    ]
  },
  {
    key: "dashboard-alerts",
    title: "Dashboard And Alerts",
    cases: [
      { id: "TD-DB-001", title: "Dashboard renders alerts and summaries", steps: ["Open dashboard with active alerts."], expected: ["Alerts load, counts match data source, no overlap/z-index defects."] },
      { id: "TD-DB-002", title: "Notification center mark-all-read", steps: ["Open notification menu, click mark all read."], expected: ["Badge decreases to 0/new correct count; menu state refreshed."] }
    ]
  },
  {
    key: "appointments",
    title: "Appointments And Scheduling",
    cases: [
      { id: "TD-APT-001", title: "Create new appointment", steps: ["Go to appointments, create appointment for existing customer."], expected: ["Appointment appears on board/list with correct time/staff/status."] },
      { id: "TD-APT-002", title: "Create appointment with guest/new customer mode", steps: ["Create appointment using guest/new customer flow."], expected: ["Appointment created without forced full member profile where allowed."] },
      { id: "TD-APT-003", title: "Reassign provider from board", steps: ["Move/reassign appointment between staff."], expected: ["Provider changes, audit/status data updated."] },
      { id: "TD-APT-004", title: "Blocked time single", steps: ["Add one-time blocked slot."], expected: ["Block appears on selected day/time only."] },
      { id: "TD-APT-005", title: "Blocked time recurring/continues", steps: ["Add recurring/continues block then navigate next days."], expected: ["Block appears according to recurrence rules."] },
      { id: "TD-APT-006", title: "Appointment detail integrity", steps: ["Open appointment details drawer."], expected: ["Service, staff, customer, status, payment, timeline are consistent."] }
    ]
  },
  {
    key: "teams-schedules",
    title: "Teams, Access, And Schedules",
    cases: [
      { id: "TD-TEAM-001", title: "Add employee service provider", steps: ["Create employee as service provider with required fields."], expected: ["Employee saved, visible in assignments and appointment staff lists."] },
      { id: "TD-TEAM-002", title: "Add employee dashboard-only role", steps: ["Create non-provider role with dashboard permissions."], expected: ["Dashboard account permissions enforce section restrictions."] },
      { id: "TD-TEAM-003", title: "Employee invite/reset access", steps: ["Send invite or reset credentials from employee profile."], expected: ["Action completes with success feedback and audit-safe behavior."] },
      { id: "TD-SCH-001", title: "Staff schedule setup with period", steps: ["Configure schedule with from/to dates."], expected: ["Slots generated only within period."] },
      { id: "TD-SCH-002", title: "Staff schedule continues mode", steps: ["Configure continues schedule without end date."], expected: ["Future availability continues beyond current week range."] }
    ]
  },
  {
    key: "catalog",
    title: "Services, Products, Orders",
    cases: [
      { id: "TD-SVC-001", title: "Create service with pricing and duration", steps: ["Add new service with required details."], expected: ["Service appears in services list and booking flow."] },
      { id: "TD-SVC-002", title: "Service provider assignments", steps: ["Assign specific employees to service."], expected: ["Only assigned providers appear for that service booking."] },
      { id: "TD-SVC-003", title: "Service payment options and reschedule flag", steps: ["Toggle payment options and allow-reschedule."], expected: ["Checkout behavior and customer reschedule option follow settings."] },
      { id: "TD-PRD-001", title: "Create product with image and price", steps: ["Add product and publish."], expected: ["Product appears in product catalog and customer-facing endpoints."] },
      { id: "TD-ORD-001", title: "Order detail lifecycle", steps: ["Open an order, update fulfillment state."], expected: ["State transitions persist and display correctly."] }
    ]
  },
  {
    key: "customers-marketing",
    title: "Customers, Marketing, Reviews",
    cases: [
      { id: "TD-CUS-001", title: "Customer profile detail", steps: ["Open customer detail page."], expected: ["History and profile metadata render correctly."] },
      { id: "TD-MKT-001", title: "Create hot deal", steps: ["Add deal with valid date range."], expected: ["Deal appears in tenant dashboard and relevant public surfaces."] },
      { id: "TD-MKT-002", title: "Push notification campaign", steps: ["Send campaign notification."], expected: ["Campaign stored, dispatch result visible, notification count updates."] },
      { id: "TD-REV-001", title: "Reviews listing", steps: ["Open reviews page with existing reviews."], expected: ["Ratings/comments list loads with correct sorting/filter behavior."] }
    ]
  },
  {
    key: "page-setup",
    title: "Page Setup And Branding",
    cases: [
      { id: "TD-PAGE-001", title: "Update public page hero/banner", steps: ["Upload/update banner/logo and save."], expected: ["Changes persist and display on public page."] },
      { id: "TD-PAGE-002", title: "Localization content save", steps: ["Update EN/AR fields and save."], expected: ["Correct locale content appears by selected language."] }
    ]
  },
  {
    key: "gift-cards",
    title: "Gift Cards (Tenant Scoped)",
    cases: [
      { id: "TD-GFT-001", title: "Create tenant gift package", steps: ["Create package with amount, credit, status, optional image."], expected: ["Package appears in tenant list and customer tenant gift tab."] },
      { id: "TD-GFT-002", title: "Activate/deactivate package", steps: ["Toggle package status."], expected: ["Inactive package hidden from purchase flow; active package visible."] },
      { id: "TD-GFT-003", title: "Tenant gift transaction visibility", steps: ["Complete purchase in customer app; check tenant side."], expected: ["Transaction/report rows visible with purchaser/value context."] }
    ]
  },
  {
    key: "billing-finance",
    title: "Billing, Subscription, Finance, Payroll",
    cases: [
      { id: "TD-BIL-001", title: "Subscription page access and state", steps: ["Open subscription page and upgrade page."], expected: ["Current plan, limits, and upgrade actions render correctly."] },
      { id: "TD-FIN-001", title: "Financial records list", steps: ["Open financial page."], expected: ["Transaction rows and totals load without mismatch."] },
      { id: "TD-PAY-001", title: "Payroll entitlement guard", steps: ["Access payroll with and without entitlement."], expected: ["Visible only when entitled; denied state handled gracefully."] }
    ]
  },
  {
    key: "reports",
    title: "Reports",
    cases: [
      { id: "TD-RPT-001", title: "Generate report", steps: ["Open reports generate, set filters, generate."], expected: ["Preview page shows correct filtered data."] },
      { id: "TD-RPT-002", title: "Export/report consistency", steps: ["Export/print from preview."], expected: ["Values match on-screen preview totals and date range."] }
    ]
  },
  {
    key: "settings",
    title: "Settings",
    cases: [
      { id: "TD-SET-001", title: "Working hours save", steps: ["Change working hours and save."], expected: ["Settings persist and affect appointment slot boundaries."] },
      { id: "TD-SET-002", title: "Booking settings save", steps: ["Modify booking buffer/behavior settings."], expected: ["New bookings follow updated policy."] },
      { id: "TD-SET-003", title: "Notification settings save", steps: ["Toggle notification settings."], expected: ["Saved values reflected after reload."] },
      { id: "TD-SET-004", title: "Payment settings save", steps: ["Change payment settings and save."], expected: ["Checkout/payment option logic updates accordingly."] },
      { id: "TD-SET-005", title: "Team access settings", steps: ["Modify team/access controls."], expected: ["Permission changes enforced after next auth/session refresh."] }
    ]
  },
  {
    key: "security-reliability",
    title: "Security, Reliability, And Regression",
    cases: [
      { id: "TD-SEC-001", title: "Unauthorized route direct access", steps: ["Open a restricted URL directly as limited account."], expected: ["Access denied/redirect; no sensitive data leakage."] },
      { id: "TD-REL-001", title: "Session expiry handling", steps: ["Let session expire and attempt action."], expected: ["Redirect to login with safe error prompt."] },
      { id: "TD-REGR-001", title: "Cross-module regression sanity", steps: ["Create service -> create appointment -> collect payment -> verify report row."], expected: ["End-to-end flow completes with consistent linked data."] }
    ]
  },
  {
    key: "cross-module-scenarios",
    title: "Cross-Section End-To-End Scenarios",
    cases: [
      { id: "TD-XMOD-001", title: "Service launch to live booking path", steps: ["Create a new service.", "Assign at least one provider.", "Ensure provider has active schedule and center working hours.", "Create a new appointment for that service."], expected: ["Service is selectable in booking.", "Provider appears as eligible.", "Appointment lands correctly on board time slot."] },
      { id: "TD-XMOD-002", title: "Marketing campaign conversion tracking", steps: ["Publish a hot deal.", "Send a push campaign for the deal.", "Create a related booking/order as customer.", "Open reports filtered for campaign date range."], expected: ["Campaign exists and is visible.", "Booking/order appears in operational sections.", "Report totals reflect post-campaign activity."] },
      { id: "TD-XMOD-003", title: "Team role security and operational limits", steps: ["Create dashboard account with limited permissions.", "Login with limited account.", "Attempt access to denied sections via sidebar and direct URL.", "Attempt allowed action in permitted section."], expected: ["Denied sections are hidden/blocked.", "Direct URL bypass is prevented.", "Allowed features work normally."] },
      { id: "TD-XMOD-004", title: "Appointment lifecycle to payment and finance", steps: ["Create and complete an appointment.", "Collect payment through POS.", "Verify entry in financial/billing views.", "Verify same transaction in reports."], expected: ["Status transitions are valid.", "Payment record is saved once (no duplicates).", "Finance and reports show consistent values."] },
      { id: "TD-XMOD-005", title: "Tenant gift card lifecycle", steps: ["Create active tenant gift package.", "Complete customer purchase.", "Redeem gift value at POS for appointment/order.", "Validate financial/report impact."], expected: ["Package appears in customer-facing flow.", "Purchase and redemption transactions are linked.", "Remaining balance logic is correct.", "Finance/report totals remain consistent."] },
      { id: "TD-XMOD-006", title: "Public page content governance", steps: ["Update logo/banner/about content in AR/EN.", "Open public page in both locales.", "Add or view a new review and verify dashboard visibility."], expected: ["Public page reflects latest content per locale.", "Brand assets render correctly.", "Reviews appear in dashboard moderation/list."] },
      { id: "TD-XMOD-007", title: "Customer support traceability", steps: ["Open a specific customer profile.", "Navigate to their appointment history and details.", "Send an operational message/notification where available."], expected: ["Customer context is consistent across sections.", "Appointment detail links back to same customer.", "Communication action logs successfully."] },
      { id: "TD-XMOD-008", title: "Subscription entitlement enforcement", steps: ["Move tenant to a package without selected entitlements.", "Reload dashboard.", "Confirm hidden/blocked features.", "Restore entitled package and verify reappearance."], expected: ["Entitlement gates apply immediately/after refresh as designed.", "No hidden-feature data exposure through direct URLs."] },
      { id: "TD-XMOD-009", title: "Localization consistency audit", steps: ["Switch to EN, capture labels, dates/times/currency placement.", "Switch to AR, repeat same paths.", "Validate forms, table headers, buttons, and alerts."], expected: ["Texts are translated and context-correct.", "RTL layout is intact and usable.", "Functional behavior remains identical."] },
      { id: "TD-XMOD-010", title: "Regression smoke across full dashboard", steps: ["Perform one core action in each section/subsection.", "Verify no critical console/API errors and no broken navigation."], expected: ["All core paths execute successfully.", "No blocker defects across modules."] }
    ]
  }
];

export const qaExitCriteria: string[] = [
  "All P0/P1 scenarios pass (Auth, Appointments, Teams, Services, Settings, Billing, Reports).",
  "No permission bypass found for dashboard accounts.",
  "No critical data mismatch between operational pages and reports.",
  "Localization (AR/EN) and RTL/LTR behavior verified on all key modules.",
  "Smoke run completed after latest deployment."
];

