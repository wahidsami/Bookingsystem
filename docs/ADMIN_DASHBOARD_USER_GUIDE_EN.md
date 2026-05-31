# Refah Super Admin Dashboard - Full User Documentation (v1)

Date: 2026-05-17
Audience: Platform Super Admin, Platform Operations, Finance Admin
Scope: `admin` application end-to-end (login, governance, tenant lifecycle, platform operations, finance, configuration)

## 1) Purpose of This Document
This guide explains the Super Admin Dashboard section by section:
1. What each page/section is.
2. What each section contains.
3. What each section can do.
4. How to run each flow correctly.

---

## 2) Super Admin Journey Overview

## 2.1 High-Level Platform Flow
1. Super Admin logs in.
2. Reviews dashboard health and pending approvals.
3. Processes new tenant applications.
4. Monitors active tenants and platform users.
5. Manages packages/pricing model.
6. Monitors financial performance and exports reports.
7. Applies platform settings and operational controls.
8. Audits activity trail and notifications daily.

## 2.2 Daily Ops Sequence (Recommended)
1. `Dashboard` for health and pending counts.
2. `Clients > Pending` for approvals first.
3. `Notifications` for alerts/actions.
4. `Financial` for revenue and anomalies.
5. `Activities` for audit review.

---

## 3) Access and Authentication

## 3.1 Entry Routes
1. `admin/src/app/page.tsx` (redirect entry)
2. `admin/src/app/login/page.tsx`
3. `admin/src/app/dashboard/page.tsx`

## 3.2 Login
What it is:
- Authentication gate for platform-level control.

How to use:
1. Open admin login page.
2. Enter super admin credentials.
3. Submit and verify access.
4. Confirm you land on `/dashboard`.

Operational controls:
1. Keep super admin credentials restricted.
2. Use unique accounts per operator where possible.
3. Enforce strong password policy and rotation.

---

## 4) Main Dashboard (`/dashboard`)

## 4.1 What It Is
Platform command center with KPI cards, pending actions, financial snapshot, and quick navigation.

## 4.2 What It Contains
1. Core platform stats.
2. Pending tenant approvals indicator.
3. Revenue snapshot.
4. Recent activities preview.
5. Quick-action links to high-priority sections.

## 4.3 How to Use
1. Check high-priority KPIs and pending items.
2. If pending approvals > 0, go directly to `Clients > Pending`.
3. Review financial card for abnormal drop/spike.
4. Open activities preview for unusual actions.

---

## 5) Clients (Tenants) Management

Routes:
1. `/dashboard/clients`
2. `/dashboard/clients/pending`
3. `/dashboard/clients/[id]`

## 5.1 Clients List (`/dashboard/clients`)
What it is:
- Full directory of tenant businesses.

What it can do:
1. Search tenants.
2. Filter by status.
3. Open tenant profile details.
4. Move to pending queue quickly.

How to use:
1. Open list.
2. Search by business name/email/owner.
3. Apply status filter.
4. Open tenant detail page for action.

## 5.2 Pending Approvals (`/dashboard/clients/pending`)
What it is:
- Decision queue for new tenant registrations requiring platform acceptance.

What it can do:
1. Review onboarding submission.
2. Approve tenant.
3. Reject tenant with reason.

How to use:
1. Open pending queue.
2. Open each tenant details.
3. Validate submitted data/documents.
4. Approve if valid; reject with clear reason if not.

Approval policy recommendation:
1. Verify legal/business details.
2. Verify contact channels.
3. Confirm package eligibility.
4. Log rationale in notes/comment where available.

## 5.3 Tenant Detail (`/dashboard/clients/[id]`)
What it is:
- Deep profile view for one tenant.

What it can do:
1. Inspect business profile and operational data.
2. Apply lifecycle actions.
3. Investigate issues and performance.

Common actions:
1. Approve/reject (if pending).
2. Suspend/reactivate (if policy violation or dispute).
3. Review tenant activity and summary metrics.

---

## 6) Clients Control (`/dashboard/clients-control`)

## 6.1 What It Is
Platform control panel for baseline commercial controls used by package logic.

## 6.2 What It Contains
1. Global pricing controls for feature costing.
2. Tenant-control policy values.

## 6.3 How to Use
1. Open page.
2. Update baseline values intentionally (change-managed).
3. Save and validate downstream package calculations.

Governance note:
- Treat this page as finance-sensitive; require maker-checker review before major updates.

---

## 7) Platform Users (`/dashboard/users`)

Routes:
1. `/dashboard/users`
2. `/dashboard/users/[id]`

## 7.1 Users List
What it is:
- Platform end-user directory (customer-side users).

What it can do:
1. Search users.
2. Inspect account status.
3. Open profile-level details.

How to use:
1. Search user by email/name/phone.
2. Open user detail.
3. Investigate support issues (auth/history/account-level anomalies).

## 7.2 User Detail
What it is:
- Single user account view.

What it can do:
1. Review profile and account metadata.
2. Review historical traces relevant to support.

How to use:
1. Validate user identity fields.
2. Cross-check related tenant interactions if support case exists.

---

## 8) Packages Management

Routes:
1. `/dashboard/packages`
2. `/dashboard/packages/new`
3. `/dashboard/packages/[id]`

## 8.1 What It Is
Commercial configuration for tenant subscription packages.

## 8.2 What It Can Do
1. Create package plans.
2. Edit limits/features.
3. Set pricing inputs (including platform commission).
4. Maintain active package portfolio.

## 8.3 Create Package Flow (`/new`)
1. Open new package page.
2. Enter package name and description.
3. Configure limits/features.
4. Set commercial fields (base values, commission, VAT-aware totals if shown).
5. Save.
6. Validate package appears in list and is selectable in tenant flows.

## 8.4 Edit Package Flow (`/[id]`)
1. Open package detail.
2. Adjust limits/pricing carefully.
3. Save.
4. Re-verify tenant-facing registration/pricing impact.

Change-control recommendation:
1. Announce pricing changes before activation.
2. Avoid retroactive surprises for existing tenants unless policy allows.

---

## 9) Financial Suite

Routes:
1. `/dashboard/financial`
2. `/dashboard/financial/tenants`
3. `/dashboard/financial/tenants/[id]`
4. `/dashboard/financial/reports`
5. `/dashboard/financial/reports/general`
6. `/dashboard/financial/reports/detailed`

## 9.1 Financial Overview (`/financial`)
What it is:
- Platform revenue and transaction-level analysis center.

What it can do:
1. Show total platform performance in selected range.
2. Show platform fee vs tenant revenue split.
3. Expose transaction-level rows for auditing.

How to use:
1. Set date range.
2. Review top-line totals and variance.
3. Drill by transaction table for anomalies.

## 9.2 Financial by Tenant (`/financial/tenants`)
What it is:
- Tenant-level financial leaderboard/reporting.

What it can do:
1. Compare tenant contributions.
2. Identify top/low performing tenants.
3. Open tenant finance detail.

How to use:
1. Open tenant financial table.
2. Sort by platform earnings/revenue.
3. Open specific tenant for deep dive.

## 9.3 Tenant Financial Detail (`/financial/tenants/[id]`)
What it is:
- Dedicated financial page for one tenant.

What it can do:
1. Inspect tenant transaction history.
2. Review platform commission extracted.
3. Export supporting data where available.

How to use:
1. Set period.
2. Validate totals against expected package/commission model.
3. Export evidence for finance/legal when required.

## 9.4 Financial Reports Hub (`/financial/reports`)
What it is:
- Report launcher for standardized finance outputs.

What it can do:
1. Navigate to general report.
2. Navigate to detailed report.

## 9.5 General Report (`/financial/reports/general`)
What it is:
- Summary-level financial report.

Use when:
1. Executive review.
2. Weekly/monthly snapshot.

## 9.6 Detailed Report (`/financial/reports/detailed`)
What it is:
- Row-level report for reconciliation/audit.

Use when:
1. Investigating mismatch.
2. Preparing accounting evidence.

---

## 10) Activities (`/dashboard/activities`)

## 10.1 What It Is
Platform-wide audit trail of important actions/events.

## 10.2 What It Can Do
1. Show who did what.
2. Track entity-level actions (tenant/user/admin/etc.).
3. Support incident investigations.

## 10.3 How to Use
1. Filter by date/entity/action where available.
2. Trace critical updates (approvals, suspensions, settings changes).
3. Capture evidence for compliance/support.

---

## 11) Notifications (`/dashboard/notifications`)

## 11.1 What It Is
Super admin notification center for operational alerts.

## 11.2 What It Can Do
1. Surface urgent platform events.
2. Mark notifications processed/read.

## 11.3 How to Use
1. Review at start of each shift.
2. Prioritize by risk/business impact.
3. Route tasks to responsible function (Ops/Finance/Support).

---

## 12) Marketing (`/dashboard/marketing`)

## 12.1 What It Is
Platform marketing control area.

## 12.2 What It Contains
- Campaign/promo related controls exposed to super admin scope.

## 12.3 How to Use
1. Open marketing page.
2. Review available campaign blocks/actions.
3. Apply changes with release timing in mind.

Note:
- If a subsection is currently limited/placeholder, treat it as controlled rollout scope.

---

## 13) Settings (`/dashboard/settings`)

## 13.1 What It Is
Global platform settings page.

## 13.2 What It Can Do
1. Configure core platform preferences.
2. Set operational/financial defaults (e.g., commission-related settings shown in UI).
3. Manage super admin profile-related settings.

## 13.3 How to Use
1. Open settings.
2. Edit one setting group at a time.
3. Save and verify impact in dependent modules.
4. Log major changes in operations change-log.

Critical warning:
- Settings changes can affect all tenants; apply controlled change process.

---

## 14) End-to-End Core Flows

## 14.1 New Tenant Acceptance Flow
1. `Clients > Pending`.
2. Open tenant profile.
3. Validate submission.
4. Approve or reject.
5. Confirm state appears correctly in `Clients` list.
6. Monitor first-day activity in `Dashboard` + `Activities`.

## 14.2 Tenant Suspension/Reactivation Flow
1. Open `Clients`.
2. Find tenant.
3. Open details.
4. Suspend with documented reason.
5. Reactivate when issue resolved.
6. Record action trace in incident ticket.

## 14.3 Package Launch Flow
1. Build package in `/packages/new`.
2. QA pricing math and limits.
3. Publish package.
4. Validate availability in tenant registration/onboarding.

## 14.4 Financial Reconciliation Flow
1. Review `/financial` summary by range.
2. Drill into `/financial/tenants` and tenant detail.
3. Export `general` + `detailed` reports.
4. Reconcile with accounting records.

---

## 15) Permissions and Operating Model (Recommended)
1. Super Admin (full control): tenant lifecycle + settings + finance.
2. Finance Admin: financial and reports only.
3. Ops Admin: clients approvals, activities, notifications.
4. Read-only audit role: reports + activities.

---

## 16) Daily/Weekly Checklists

## 16.1 Daily Checklist
1. Dashboard health check.
2. Pending approvals clear.
3. Notifications triage.
4. Critical activity log review.
5. Financial anomaly quick scan.

## 16.2 Weekly Checklist
1. Package/pricing validation.
2. Suspended tenants review.
3. Financial report export and reconciliation.
4. Settings drift review.

---

## 17) Common Mistakes to Avoid
1. Approving incomplete tenant profiles without policy checks.
2. Changing package pricing without impact analysis.
3. Applying global settings directly in peak hours.
4. Ignoring activity log after high-risk actions.
5. Running finance checks without fixed date range discipline.

---

## 18) Versioning and Next Steps
This is Admin Dashboard Documentation v1.

Suggested next iterations:
1. Add screenshot-driven guide for each admin page.
2. Add Arabic counterpart: `ADMIN_DASHBOARD_USER_GUIDE_AR.md`.
3. Add SOP playbook by role (Ops, Finance, Support).
4. Add troubleshooting appendix (auth, API errors, data mismatch, report export issues).
