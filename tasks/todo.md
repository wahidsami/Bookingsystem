# BARSPA — Critical Fix: Rescheduling a Confirmed, Paid Appointment Fails Validation
- [x] 1. Diagnosis & Root Cause Audit <!-- id: resched_audit -->
  - [x] Trace `POST /api/v1/bookings/evaluate` HTTP 400 error: `tenantId` omitted by `AppointmentWorkspace.tsx` and unhandled in `server/src/controllers/bookingController.js` and `server/src/routes/bookingRoutes.js`.
  - [x] Trace HTTP 401 errors: `tenantApiAdapter.ts` `isTenantApiPath` missing `/tenant/` relative prefix match, and token-expired handling misclassified as scheduling conflict in `AppointmentServiceEditor.tsx`.
  - [x] Trace rescheduling contract for confirmed, fully paid appointments: verify `reassignRescheduleAppointment` preserves appointment ID, payment records, linked sales/invoices, and paid state without spawning new appointments.
- [x] 2. Backend Fixes <!-- id: resched_backend -->
  - [x] Update `server/src/routes/bookingRoutes.js`: mount `optionalTenantAuth` middleware on `POST /evaluate`.
  - [x] Update `server/src/controllers/bookingController.js`: resolve `tenantId` from `req.tenantId || req.tenant?.id || req.body?.tenantId`, fallback to `service.tenantId`, and enforce tenant isolation if token authenticated.
  - [x] Add backend unit tests in `bookingControllerEvaluate.test.js`.
- [x] 3. Frontend Fixes <!-- id: resched_frontend -->
  - [x] Update `Tenant-v2/src/components/AppointmentWorkspace.tsx`: add `tenantId` to `Appointment` interface, map `tenantId` in `mapBoardAppointment`, pass `tenantId` and `packageId` (if package) in `handleSaveServiceEdit`.
  - [x] Update `Tenant-v2/src/lib/tenantApiAdapter.ts`: include `/tenant/` in `isTenantApiPath`, guard `window` in `toAbsoluteUrl`, and notify auth failure handler on 401.
  - [x] Update `Tenant-v2/src/components/AppointmentServiceEditor.tsx`: differentiate HTTP 401 (auth/session error) and HTTP 400 (validation error) from scheduling conflicts.
  - [x] Add frontend unit tests in `AppointmentRescheduleValidation.test.ts`.
- [x] 4. Verification & Testing <!-- id: resched_verify -->
  - [x] Run backend tests (9/9 evaluate tests passed, 46/46 suite total passed).
  - [x] Run frontend tests and type checks (`npx tsx --test`, `npx tsc --noEmit` 0 errors, and `npm run build` in Tenant-v2).
- [ ] 5. Git Delivery <!-- id: resched_delivery -->
  - [ ] Inspect diff to ensure only intended files are staged.
  - [ ] Commit and push to `origin/main`.
  - [ ] STOP for manual user deployment.

# BARSPA — Resource Reservations Must Be Recorded and Counted Reliably
- [x] 1. Full Resource Lifecycle Audit <!-- id: res_lifecycle_audit -->
  - [x] Trace service & variant resource requirement definitions (`ServiceResourceRequirement`, `variantId`).
  - [x] Trace active physical resources and types (`Resource`, `ResourceType`).
  - [x] Trace pre-creation appointment validation (`evaluateSchedulingRequest`).
  - [x] Trace successful booking creation and physical resource allocation recording (`bookingService.createBookingSession`, `createBooking`, `allocateServiceResources`).
  - [x] Trace `AppointmentResource` records creation and association with appointments and time intervals.
  - [x] Trace multi-service and group booking session resource allocation.
  - [x] Trace resource handling during editing, rescheduling, duration changes, cancellation, status changes (`rescheduleAppointment`, `reassignRescheduleAppointment`, status transitions).
  - [x] Trace `POST /api/v1/tenant/resources/batch-check` availability derivation against `AppointmentResource` and existing appointments.
  - [x] Investigate why existing booked appointments (e.g., Abeer's manicure or massage appointments) are missing `AppointmentResource` records or not counted in availability checks.
  - [x] Prove root cause with concrete code and DB query evidence: availability engines exclusively queried `AppointmentResource`, making legacy / pre-feature / unallocated appointments completely invisible.
- [x] 2. Missing Allocations & Legacy Compatibility Strategy <!-- id: res_compat_strategy -->
  - [x] Determine whether active appointments requiring resources lack `AppointmentResource` rows (confirmed: pre-Sept 22 appointments, appointments created before requirements added to service, seed data).
  - [x] Design non-destructive derived/fallback reconciliation in availability check so active appointments with requirements are not invisible.
  - [x] Prevent double-counting when both explicit `AppointmentResource` and derived reservations exist.
  - [x] Ensure non-overlapping reuse of physical instances is preserved via half-open interval checks.
- [x] 3. Implementation of Proven Fix & Concurrency Controls <!-- id: res_impl -->
  - [x] Fix booking creation / editing / rescheduling to guarantee atomic `AppointmentResource` persistence.
  - [x] Update availability resolver (`batchCheckResourceAvailability` / `resourceRequirementResolver.js`) to handle existing appointments with missing allocations safely.
  - [x] Prevent concurrent over-allocation at authoritative booking preflight / execution.
- [x] 4. Verification & Regression Tests <!-- id: res_verify -->
  - [x] Test Scenario A: Two massage rooms (1/2 with 1 booked, 2/2 after, 0/2 with 2 booked).
  - [x] Test Scenario B: One nail station (0/1 during overlap, 1/1 after).
  - [x] Test Scenario C: Resource isolation (nail does not block massage).
  - [x] Test Scenario D: Lifecycle (create, reload, edit, reschedule, cancel, group, missing allocation reconciliation).
  - [x] Test concurrent conflict prevention.
  - [x] Run backend Jest tests and frontend component tests.
  - [x] Run `npx tsc --noEmit` and `npm run build` in `Tenant-v2`.
- [x] 5. Git Delivery <!-- id: res_delivery -->
  - [x] Stage only explicitly intended files.
  - [x] Commit and push to `origin/main`.
  - [x] STOP for manual user deployment.

# BARSPA — Critical Resource Availability Isolation Audit & Fix (Previous Pass)
- [x] 1. Audit & Root Cause Analysis <!-- id: res_audit -->
  - [x] Trace `InteractiveDrawers.tsx` candidate-time, duration, and staged services payload construction.
  - [x] Trace `ResourceBadge` rendering, candidate time string, and what the secondary time (e.g. 7:15 PM) represents.
  - [x] Trace `POST /api/v1/tenant/resources/batch-check` and `batchCheckResourceAvailability` in `tenantResourceController.js` & `resourceRequirementResolver.js`.
  - [x] Inspect database schema/models and actual seed/fixtures for resource requirements on Moroccan massage, Thai therapy, and Classic manicure.
  - [x] Investigate why massage-room services show 0/2 available around 6:45 PM while manicure shows 1/1 available despite Abeer's 7:00 PM manicure appointment.
  - [x] Identify exact failure class (e.g., resource type cross-contamination, requirement mismatch, query interval, timezone shift, or staged draft bleed).
- [x] 2. Controlled Reproductions & Scenarios A-D <!-- id: res_repro -->
  - [x] Scenario A: Nail-resource overlap (6:45-7:15 PM candidate manicure vs 7:00-7:30 PM existing manicure -> 0/1; 7:30-8:00 PM -> 1/1).
  - [x] Scenario B: Massage-resource independence (6:45-7:45 PM candidate massage with no massage bookings -> 2/2 available; nail appointment must not consume massage rooms).
  - [x] Scenario C: True partial capacity (Room A free at 6:45, Room B free at 7:15 -> 6:45-7:45 candidate -> 1/2 available).
  - [x] Scenario D: Later candidate (7:15-8:15 candidate when both rooms free -> 2/2 available).
- [x] 3. Implementation of Proven Fix <!-- id: res_fix -->
  - [x] Correct backend and/or frontend availability calculation or data mapping per proven root cause.
  - [x] Ensure strict resource type isolation (nail vs massage vs stations).
  - [x] Ensure accurate candidate time derivation, badge rendering, and "available again at" calculation.
  - [x] Ensure alignment between catalogue badges and authoritative final booking preflight.
- [x] 4. Verification & Testing <!-- id: res_verification -->
  - [x] Run backend Jest tests (`tenantResourceAvailability.test.js` 28/28 passed).
  - [x] Run frontend component tests (`resourceBadges.test.ts` 25/25, `appointmentDraftIsolation.test.ts` 3/3, 73/73 suite total passed).
  - [x] Run `npx tsc --noEmit` (0 errors) and `npm run build` (built in 6.92s) in `Tenant-v2`.
- [x] 5. Git Delivery <!-- id: res_delivery -->
  - [x] Review diff, stage only intended files, commit, and push to `origin/main`.
  - [x] STOP for manual user deployment.

# BARSPA — Critical Fixes: Stale Customer in New Booking & Resource Availability
- [x] 1. Audit & Root Cause Analysis <!-- id: crit_audit -->
  - [x] Workstream A: Trace `InteractiveDrawers.tsx` & `AppointmentWorkspace.tsx` to identify why a fresh appointment inherits "Participant 2" / guest email and survives close/cancel.
  - [x] Workstream B: Trace resource availability badge & backend (`batch-check`, `resourceRequirementResolver.js`) to find why [16:40, 17:40) reports 0/2 when Room A ends at 16:40.
- [x] 2. Workstream A — Stale Customer in New Booking <!-- id: crit_workstream_a -->
  - [x] Distinguish fresh appointment action vs explicit Rebook vs intentional draft recovery.
  - [x] Fix drawer close / cancel / discard cleanup in `InteractiveDrawers.tsx` & `AppointmentWorkspace.tsx`.
  - [x] Ensure fresh board creation action clears any prior customer, walk-in info, group participants, staged services.
  - [x] Preserve explicit Rebook prepopulation.
- [x] 3. Workstream B — Correct Resource Availability Count <!-- id: crit_workstream_b -->
  - [x] Verify interval overlap semantics (`allocationStart < candidateEnd && allocationEnd > candidateStart`).
  - [x] Check candidate timestamp generation, timezone alignment, and physical resource instance tracking.
  - [x] Fix capacity calculation so [16:40, 17:40) correctly reports 1/2 available.
- [x] 4. Verification & Testing <!-- id: crit_verification -->
  - [x] Add unit & integration tests for Workstream A (fresh appointment, cancel/reopen, rebook isolation).
  - [x] Add unit & integration tests for Workstream B (two-room fixture: 1/2 at 16:40, 2/2 at 17:05, boundary conditions).
  - [x] Run `npx tsx --test`, `npx tsc --noEmit`, and `npm run build`.
- [x] 5. Git Delivery <!-- id: crit_git -->
  - [x] Stage only explicitly intended files.
  - [x] Commit and push to `origin/main`.
  - [x] STOP for manual user deployment.


# BARSPA — Appointment Drawer Regression Correction Pass
- [x] 1. Audit & Root Cause Analysis <!-- id: reg_audit -->
  - [x] Workstream A: Audit why group services are combined into one card in `AppointmentDetailsDrawer.tsx`.
  - [x] Workstream B: Audit false staff-duty warning when editing service time (e.g. 3:35 PM to 4:00 PM) in `AppointmentServiceEditor.tsx` & `tenantApiAdapter.evaluateScheduling`.
  - [x] Workstream C: Audit why Rebook loses staged services when transitioning into `InteractiveDrawers.tsx`.
  - [x] Workstream D: Audit duplicate contact actions in `AppointmentClientHeader.tsx`.
- [x] 2. Workstream A — Restore Independent Service Cards <!-- id: reg_workstream_a -->
  - [x] Ensure every independently booked service item has its own `AppointmentServiceCard`.
  - [x] Retain service name/variant, participant association, staff, actual start/end time, duration, price, edit action.
  - [x] Preserve genuine bundle/package identity without splitting.
  - [x] Preserve unified group payment calculation and settlement across session.
- [x] 3. Workstream B — Correct Service Editing & Scheduling Validation <!-- id: reg_workstream_b -->
  - [x] Initialize editor with exact persisted date, time, duration, staff, service.
  - [x] Fix timezone handling between ISO string, board-minutes, and local clock.
  - [x] Prevent false duty-hour conflicts when staff is actually on-duty; block only genuine conflicts.
  - [x] Ensure downstream adjustments apply only to sequential dependencies, not independent group members.
- [x] 4. Workstream C — Repair Rebook & Preserve Reschedule <!-- id: reg_workstream_c -->
  - [x] Trace `handleRebookAppointment` → `stagedServices` → `InteractiveDrawers.tsx` state handoff.
  - [x] Ensure create drawer initializes with the prepopulated services, customer, and staff preferences as fresh draft.
  - [x] Preserve Reschedule in-place editing behavior on active appointments.
- [x] 5. Workstream D — Remove Duplicate Client Contact Actions <!-- id: reg_workstream_d -->
  - [x] Remove Call, WhatsApp, and SMS from the three-dot overflow menu in `AppointmentClientHeader.tsx`.
  - [x] Retain Client Profile and Visit History in the menu.
- [x] 6. Tests, Verification & Local Build <!-- id: reg_verification -->
  - [x] Add unit and regression tests in `AppointmentDetailsDrawer.phase3.test.ts`.
  - [x] Run `npx tsx --test`, `npx tsc --noEmit`, and `npm run build`.
- [x] 7. Git Delivery <!-- id: reg_git -->
  - [x] Stage only explicitly modified `Tenant-v2` files and `tasks/todo.md`.
  - [x] Commit and push to `origin/main`.
  - [x] STOP for user manual deployment.


# BARSPA — Appointment Drawer Correction: Unified Group Checkout, Completed-Visit Locking, Reschedule vs Rebook
- [x] 1. Session & Payment Audit & Data Model Discovery <!-- id: audit_group_session -->
  - [x] Trace calendar cards, appointment IDs, and `BookingSession` links.
  - [x] Trace group participant appointments, service items, and drawer hydration.
  - [x] Trace `handleDrawerCheckout` and identify point where single appointment vs session was scoped.
  - [x] Verified backend `processAppointmentPayment` in `appointmentPaymentService.js`: already supports atomic session settlement with `scope: 'session'` and `syncBookingSessionTotals`.
  - [x] Identified and audited group payment arrangement UI in `InteractiveDrawers.tsx`.
- [x] 2. Unified Group Checkout & Settlement <!-- id: impl_group_checkout -->
  - [x] Aggregate authoritative amounts across all eligible appointments in the session in `AppointmentDetailsDrawer.tsx`.
  - [x] Show group session context, participant names, and individual service items.
  - [x] Update `AppointmentCheckoutOverlay` line items to include all eligible group participants.
  - [x] Send `scope: 'session'`, group amount, and allocations in `handleDrawerCheckout` to `updateAppointmentPaymentStatus`.
  - [x] After payment, all included appointments reflect settled group payment; clicking any sibling card opens the shared sale/receipt without re-charging.
- [x] 3. Completed Appointments Are Read-Only <!-- id: impl_completed_lock -->
  - [x] In `AppointmentServiceCard.tsx`: Hide edit buttons when appointment or item status is `completed`.
  - [x] In `AppointmentDetailsDrawer.tsx`: Enforce `canEdit = false` on completed service items.
  - [x] In mixed groups, lock only completed appointments/services; preserve editing on uncompleted siblings.
  - [x] Lock header status `<select>` dropdown against invalid reverse transitions once completed.
- [x] 4. Reschedule vs Rebook Differentiation <!-- id: impl_reschedule_rebook -->
  - [x] Reschedule: Modify existing booking; open in-place editor for active/upcoming appointments with saved date, time, stylist, duration; validate via `evaluateScheduling`; keep appointment ID intact.
  - [x] Rebook: Fresh booking draft; prepopulate customer and services into create drawer; require new future date/time; run availability checks; zero out old payment/appointment IDs.
  - [x] UI Distinction: Show Reschedule on upcoming visits; show Rebook on completed/cancelled visits; never use Rebook as primary action for confirmed/unpaid visits.
- [x] 5. Hide/Remove Confusing Payment Choice UI <!-- id: impl_hide_payment_choice -->
  - [x] In `InteractiveDrawers.tsx`: Hide the `organizer_pays` vs `individual_pays` toggle; lock default to unified group payment.
  - [x] Display unified group billing badge without confusing choice radio buttons.
- [x] 6. Comprehensive Regression Tests & Verification <!-- id: test_verification -->
  - [x] Add regression tests in `AppointmentDetailsDrawer.phase3.test.ts` covering:
    - Group checkout from participant A and B produces matching total and includes all eligible appointments.
    - Unified checkout settles all linked appointments.
    - Paid group card links to shared receipt; prevents duplicate charges.
    - Completed appointments lock editing; mixed groups lock only completed services.
    - Reschedule preserves appointment identity; Rebook creates fresh draft with new IDs.
  - [x] Run tests with `npx tsx --test` (31/31 passed).
  - [x] Run `npx tsc --noEmit` (clean, 0 errors) and `npm run build` (builds successfully).
- [x] 7. Change Control, Diff Inspection, Commit & Push <!-- id: commit_push -->
  - [x] Stage strictly affected Tenant-v2 components, test file, and todo.md.
  - [x] Commit and push to `origin/main` (`200d87a`).
  - [x] STOP for user manual deployment.

# Todo: Captain — Customer App Full Arabic RTL Reconstruction (Sprint 0 & 1 Complete)

- [x] 1. Core Contract & Shared Helpers <!-- id: 1 -->
- [x] 2. Shared UI Components Mirrored <!-- id: 2 -->
- [x] 3. Home Screen & Subcomponents <!-- id: 3 -->
- [x] 4. Tenant Page & Tabs <!-- id: 4 -->
- [x] 5. Appointments & Booking Flow <!-- id: 5 -->
- [x] 6. Purchases & Orders <!-- id: 6 -->
- [x] 7. Profile, More, Settings & Saved Addresses <!-- id: 7 -->
- [x] 8. Notifications & About Screen <!-- id: 8 -->
- [x] 9. Authentication & Onboarding <!-- id: 9 -->
- [x] 10. BiDi & Directional Icons Sweep <!-- id: 10 -->
- [x] 11. Full-Tree Component Sweep & English Regression Verification <!-- id: 11 -->
- [x] 12. Verification & Build <!-- id: 12 -->

# RTL ARCHITECTURE FREEZE (MANDATORY — PROTECTED FILES)
The following canonical RTL files are FROZEN and protected from modification:
- `RifahMobile/src/contexts/LanguageContext.tsx`
- `RifahMobile/src/theme/direction.ts`
- `RifahMobile/src/components/ThemedText.tsx`
- `RifahMobile/src/navigation/TabNavigator.tsx`
- `RifahMobile/src/components/tenant/TenantTabs.tsx`
- `RifahMobile/src/components/ui/CustomerSubpageHeader.tsx`

# Final RTL Build & Runtime Verification Plan
- [x] 1. Verify working tree integrity and typecheck (0 errors) <!-- id: rtl_verify_tree -->
- [x] 2. Build release APK from current verified working tree <!-- id: rtl_build_apk -->
- [x] 3. Launch emulator-5554 and install the fresh APK <!-- id: rtl_install_apk -->
- [x] 4. Runtime verification across all 12 target screens (Home, Bottom Nav, Tenant, Tabs, Services, Bundles, Wallet Hub, Wallet Details, Recharge Modal, More/Profile, Appointments, English) <!-- id: rtl_runtime_verify -->

# Sprint 1: Tenant-Only Wallet Reconstruction Verification (Complete)
- [x] 1. Backend Service & Routes <!-- id: s1_backend -->
- [x] 2. Customer App Hub & Detail Screens <!-- id: s1_screens -->
- [x] 3. End-to-End Android Emulator Verification <!-- id: s1_verification -->

# Sprint 2: Wallet & Gift Cards End-to-End Fix + Accounting Integrity
- [x] 1. Backend: Idempotency Protection for Purchase & Send <!-- id: s2_idempotency -->
  - Implement `PaymentIdempotencyKey` handling in `purchaseForSelf` and `sendGift` in `userTenantGiftController.js`.
  - Guard against duplicate submissions charging twice or double crediting.
- [x] 2. Backend: Dual Voucher/Token Redemption in Claim Flow <!-- id: s2_claim_fix -->
  - Update `claimGift` to resolve either human-readable `GiftCardCode.code` (`TN-...`) or internal `claimToken`.
  - Atomically update gift transaction, `GiftCardCode`, credit `TenantWalletBalance`, and insert `TenantWalletLedgerEntry`.
- [x] 3. Backend: Received Gifts Endpoint <!-- id: s2_received_endpoint -->
  - Implement `getReceivedTenantGifts` (`GET /api/v1/users/tenant-gifts/received`) with tenant and sender metadata.
- [x] 4. Customer App: Salon Selector in GiftsScreen <!-- id: s2_salon_selector -->
  - Enable salon discovery and package loading when navigating to Gifts & Wallet from the "Me" hub (`tenantId` is undefined).
  - Ensure tenant context is strictly bound to the selected salon package.
- [x] 5. Customer App: UI Double-Submit Locks & Received Gifts Tab <!-- id: s2_ui_locks_received -->
  - Add request locking / disabled state to Purchase and Send buttons.
  - Expose "Received Gift Cards" (`بطاقات الهدايا المستلمة`) list with status and claim CTA where applicable.
- [x] 6. Customer App: Voucher Code Redemption & Global Wallet Audit <!-- id: s2_ui_voucher_audit -->
  - Connect manual code input to claim endpoint supporting `TN-...` codes.
  - Audit and ensure no customer-facing calls invoke unscoped `api.getWalletBalance()`.
- [x] 7. Automated Test Suite (Scenarios A through N) <!-- id: s2_automated_tests -->
  - Execute automated test suite verifying A (Purchase), B (Purchase double-submit), C (Send to registered), D (Send double-submit), E (Claim), F (Double claim), G (Invalid code), H (Expired code), I (Tenant isolation), J (Debit), K (Insufficient funds), L (Refund), M (Ledger accuracy), N (Multi-tenant summary).
- [x] 8. Real Android Emulator Verification & Evidence Capture <!-- id: s2_android_e2e -->
  - Run live flow on `emulator-5554`: Salon select -> Purchase -> Verify balance & ledger -> Send -> Claim -> Service payment deduction -> Arabic RTL & English currency.

# Sprint 3A: Direct Card Wallet Recharge + Tenant Settlement (Complete)
- [x] 1. Merchant of Record & Payment Gateway Verification <!-- id: s3a_mor -->
  - Verified central platform MoR model (Refah/BarSpa central merchant) with gateway fee metadata `0.00` (`not_configured`).
- [x] 2. Settlement Ledger Model & Migration (`TenantSettlement`) <!-- id: s3a_model -->
  - Created `TenantSettlement.js` model and database table for tracking tenant payable amounts, gross, fees, refunds, adjustments, and net payable.
- [x] 3. Backend Direct Card Recharge Endpoint & Idempotency <!-- id: s3a_backend_recharge -->
  - Implemented `POST /api/v1/users/tenant-wallet/recharge` in `userTenantWalletController.js` with `PaymentIdempotencyKey` reservation/replay.
  - Processed card validation via `paymentService.js` and atomic transaction linking `db.Transaction` (`wallet_topup`), `TenantWalletLedgerEntry`, and `TenantSettlement` (`status: 'pending'`).
- [x] 4. Settlement Accounting & Double-Counting Protection <!-- id: s3a_double_count -->
  - Verified wallet spend does not generate duplicate settlement payable entries; separates cash collection from prepaid credit consumption.
- [x] 5. Super Admin Settlement & Reconciliation Reporting Endpoint <!-- id: s3a_admin_report -->
  - Implemented super admin reporting logic with traceable transaction drill-downs and tenant filters.
- [x] 6. Tenant Settlement Summary Reporting Endpoint <!-- id: s3a_tenant_report -->
  - Implemented tenant settlement summary reporting with strict tenant data isolation.
- [x] 7. Customer App: Direct Salon Wallet Recharge UI <!-- id: s3a_mobile_ui -->
  - Created `TenantWalletRechargeModal.tsx` with preset amount chips (100, 200, 500, 1000 SAR), custom input, test card autofill, and RTL Arabic styling.
  - Integrated into `GiftsScreen.tsx` (quick recharge button) and `TenantWalletDetailsScreen.tsx` ("شحن رصيد الصالون" action button).
- [x] 8. Automated Integration Test Suite (Scenarios A through K) <!-- id: s3a_tests -->
  - Verified 11/11 tests pass in `server/src/services/__tests__/tenantSettlementSprint3a.test.js`.
  - Verified all 9 live PostgreSQL database gates pass in `scratch/test_live_db_settlement.js` (recharge, idempotency, declined cards, settlement entries, double counting protection, refund reversals).
- [x] 9. Real Android Emulator Verification on `emulator-5554` <!-- id: s3a_android_e2e -->
  - Authenticated as `wallet_test_01@test.com` (Sara Al-Ahmad).
  - Navigated from Home -> Me ("أنا") -> Gifts & Wallet ("الهدايا والمحفظة") -> Salon Balances ("أرصدة الصالونات").
  - Opened Happiness Salon details screen ("عرض التفاصيل") showing 300.00 SAR balance and verified balance sources.
  - Tapped "شحن رصيد الصالون" -> `TenantWalletRechargeModal` rendered cleanly with preset chips, custom amount, and test card autofill.
  - Executed test card autofill and submit flow. Verified modal UI interactions and captured full screenshot evidence.
  - Confirmed no premature "settled" status in accounting ledger (recharges remain `status: 'pending'` until physical payout).

# Sprint 3A: Deployment & Real Customer App Recharge Verification
- [ ] 1. Pre-Deployment Validation & Tests <!-- id: dep_pre_tests -->
  - Move migration `20260921153000-create-tenant-settlements.js` to `server/migrations/` with safe enum additions.
  - Verify syntax and run `tenantSettlementSprint3a.test.js` (11/11 tests pass).
- [ ] 2. Backend Deployment <!-- id: dep_backend -->
  - Stage and commit ONLY Sprint 3A backend files (zero changes to Tenant-v2 or RifahMobile).
  - Push to `origin/main` for VPS/Coolify deployment.
  - Verify deployed API route `POST /api/v1/users/tenant-wallet/recharge` is live (returns 401 Unauthorized instead of 404).
- [ ] 3. Deployed API Smoke Test <!-- id: dep_smoke_test -->
  - Authenticate customer `wallet_test_01@test.com`.
  - Execute 500 SAR recharge via deployed API, verify balance +500, ledger entry, settlement `status: 'pending'`, commission calculation, and idempotency.
  - Verify declined card (no credit, no settlement).
- [ ] 4. Real Customer App Test on Emulator <!-- id: dep_emulator_app -->
  - Perform recharge on `emulator-5554`: أنا -> الهدايا والمحفظة -> أرصدة الصالونات -> Happiness Salon -> شحن رصيد الصالون -> 500 SAR -> Visa test card -> تأكيد الدفع.
  - Capture screenshot of recharge success and refreshed balance.
- [ ] 5. Hard Accounting Verification & Tenant Isolation <!-- id: dep_accounting_isolation -->
  - Record Before / Recharge / After across DB, ledger, API response, and Customer App.
  - Record TenantSettlement (gross, platform fee, gateway fee 0.00, net payable, pending status).
  - Verify Tenant A increased by 500 while Tenant B is unchanged.
- [ ] 6. Financial Reporting Verification <!-- id: dep_reporting -->
  - Verify Super Admin endpoint `GET /api/v1/admin/financial/settlements`.
  - Verify Tenant endpoint `GET /api/v1/tenants/financial/settlement-summary`.
- [ ] 7. Release APK Build & Final Formatting Sweep <!-- id: dep_apk -->
  - Build Android release APK after all checks pass.
# Phase 1A: Resource Foundation — Database + Backend API Only
- [x] 1. Database Migration: `resource_types`, `resources`, `service_resource_requirements`, `appointment_resources` <!-- id: p1a_migration -->
- [x] 2. Sequelize Models & Associations: `ResourceType`, `Resource`, `ServiceResourceRequirement`, `AppointmentResource` <!-- id: p1a_models -->
- [x] 3. Tenant Resource Controller & Routes: CRUD for Resource Types & Instances with strict tenant isolation <!-- id: p1a_resource_crud -->
- [x] 4. Service Resource Requirement API: Extend `tenantServiceController` to persist and return resource requirements <!-- id: p1a_service_requirements -->
- [x] 5. Backward Compatibility & Test Suite: Automated Jest suite for Scenarios A through P <!-- id: p1a_tests -->
- [x] 6. Final Phase 1A Validation Report <!-- id: p1a_report -->

# Phase 1B: Resource-Aware Availability + Conflict + Booking Allocation (Complete)
- [x] 1. Requirement Resolution: Create `resourceRequirementResolver.js` for parent & variant merging <!-- id: p1b_resolver -->
- [x] 2. Conflict Detector: Extend `bookingConflictDetector.js` for resource overlap checks <!-- id: p1b_conflict -->
- [x] 3. Resource-Aware Availability: Update `availabilityService.js` to filter slots by resource capacity <!-- id: p1b_availability -->
- [x] 4. Booking Allocation Engine: Update `bookingService.js` for atomic resource allocation & locking <!-- id: p1b_allocation -->
- [x] 5. Coordinated Bundle Scheduling: Extend parallel and sequential bundle logic with resource constraints <!-- id: p1b_bundles -->
- [x] 6. Rescheduling Validation: Update `tenantAppointmentController.js` to validate and update resource allocations <!-- id: p1b_reschedule -->
- [x] 7. Comprehensive Automated Test Suite: Scenarios A through K <!-- id: p1b_tests -->
- [x] 8. Final Phase 1B Validation Report <!-- id: p1b_report -->

# Phase 1C: Tenant V2 Resource Management + Service Resource Requirements UI (Complete)
- [x] 1. Type definitions & translation entries in `types.ts` and `translations.ts` <!-- id: p1c_types_translations -->
- [x] 2. API adapter methods for Resource Types & Instances in `tenantApiAdapter.ts` <!-- id: p1c_api_adapter -->
- [x] 3. Service contract data serialization in `serviceContract.ts` <!-- id: p1c_service_contract -->
- [x] 4. First-class Resources Workspace (`ResourcesWorkspace.tsx`) <!-- id: p1c_resources_workspace -->
- [x] 5. Mount Resources in `Workspace.tsx` and `Sidebar.tsx` navigation <!-- id: p1c_mount_resources -->
- [x] 6. Service Resource Requirements UI in actual service form owner (`Services2Workspace.tsx`) <!-- id: p1c_service_form -->
- [x] 7. Typecheck & verification of Resource & Service UI flows <!-- id: p1c_verification -->
- [x] 8. Final Phase 1C Validation Report <!-- id: p1c_report -->

# Bundle Safe Editing & Historical Integrity (Complete)
- [x] 1. Model & Association Updates: `isActive` on `ServicePackageItem` and `scope: { isActive: true }` on `ServicePackage.items` <!-- id: bundle_models -->
- [x] 2. Migration: `20260922150000-add-is-active-to-service-package-items.js` with default `true` <!-- id: bundle_migration -->
- [x] 3. Controller Reconciliation: In-place update for matched items, soft-deactivate historically referenced removed items, never delete FK rows <!-- id: bundle_controller -->
- [x] 4. Booking Validation: Guard in `bookingService.js` requiring package items to be current active rows <!-- id: bundle_booking_validation -->
- [x] 5. Focused Test Suite: 9 safety tests in `tenantBundleController.reconcile.test.js` (100% pass) <!-- id: bundle_unit_tests -->
- [x] 6. Regression Testing: Phase 1A & Phase 1B suites verified passing <!-- id: bundle_regressions -->

# Human, Specific & Actionable Booking Conflict Engine
- [x] 1. Backend Conflict Diagnosis: Enrich `resourceRequirementResolver.js` with structured conflict metadata (not configured vs occupied, conflicting intervals, availableAgainAt) <!-- id: conflict_res_resolver -->
- [x] 2. Backend Multi-Constraint Evaluation: Update `bookingService.js` to evaluate and gather all independent conflicts (staff, schedule, breaks, resources) without premature exit <!-- id: conflict_multiconstraint -->
- [x] 3. Controller 409 Structured Response: Standardize HTTP 409 responses in `tenantAppointmentController.js` for create, reschedule, and drag-and-drop <!-- id: conflict_controllers -->
- [x] 4. Frontend Contract & Dialog Builder: Update `bookingUiDialogs.ts` with natural-language bilingual message builder (Rules 1-6) <!-- id: conflict_dialog_builder -->
- [x] 5. Tenant V2 UI Integration: Wire specific conflict dialog and toasts into `AppointmentWorkspace.tsx`, `InteractiveDrawers.tsx`, and `useAppointmentSubmission.ts` <!-- id: conflict_ui_integration -->
- [x] 6. Comprehensive Automated Tests: Write unit & integration tests covering Rules 1 through 6 <!-- id: conflict_tests -->
- [x] 7. Verification & Signoff: Verify in live UI and automated test suite <!-- id: conflict_verification -->

# Captain — Tenant V2 Service & Variant Selection UX
- [x] 1. Architecture & Plan Approval (with 3 Guardrails: Main Service validation, independent variant selection, high discoverability) <!-- id: variant_ux_plan -->
- [x] 2. Update `AppointmentServicesStep.tsx` Catalog Rendering: Variant-aware service row grouping, expand/collapse state, variant count badge, Main Service option validation, and individual variant options <!-- id: variant_ux_catalog -->
- [x] 3. Update `AppointmentServiceRow.tsx`: Show duration/price subtitle, handle Main Service option vs Variant option formatting, preserve single source of truth <!-- id: variant_ux_row -->
- [x] 4. Update `AppointmentServiceConfiguration.tsx`: Display selected service and variant cleanly, eliminate competing variant-selection select dropdown <!-- id: variant_ux_config -->
- [x] 5. Guard selection & deselect logic in `InteractiveDrawers.tsx`: Precise variantId matching (null for Main Service, exact ID for variant), fresh evaluation and state resets <!-- id: variant_ux_drawer -->
- [x] 6. Expand `Tenant-v2/src/lib/__tests__/bookingVariantLifecycle.test.ts` covering Scenarios 1 to 17 <!-- id: variant_ux_tests -->
- [x] 7. Verification: Run unit tests, typechecks, backend regression suites <!-- id: variant_ux_verification -->
- [x] 8. Final Report (Items A-K) <!-- id: variant_ux_report -->

# Captain — Customer App Services + Booking Implementation
- [x] 1. Cart Context & Bundle Model Preservation (`ServiceBookingCartContext.tsx`) <!-- id: cust_cart_bundle -->
- [x] 2. Category Awareness & Fallback in `TenantScreen.tsx` <!-- id: cust_categories -->
- [x] 3. Bundle Cart Integration in `TenantScreen.tsx` (`handleToggleBundle`) <!-- id: cust_tenant_bundles -->
- [x] 4. Services Tab Category Grouping & Variant Discoverability (`TenantServicesTab.tsx`) <!-- id: cust_services_tab -->
- [x] 5. Any Professional, Fresh State & Resource-Aware Booking in `BookingJourneyScreen.tsx` <!-- id: cust_booking_journey -->
- [x] 6. Human Customer-Facing Bilingual Error Handling in Booking Flow <!-- id: cust_human_errors -->
- [x] 7. Comprehensive Automated Test Suite (Scenarios 1-30) <!-- id: cust_tests -->
- [x] 8. Multi-Service Backend Support Audit & Stop Gate Verification <!-- id: cust_verify_stopgate -->

## Customer App Services + Booking Review & Verification Results
- 32/32 tests passing in `customerBookingServices.test.ts` (0 failures).
- Typecheck clean: `npm run typecheck` passes with 0 errors.
- Category fallback: When public category endpoint is unavailable, services derive categories from `service.category` and render under grouped category headers.
- Variant discoverability: Service cards show variant count badges (`{count} خيارات متاحة` / `{count} options available`). Main Service option is guarded and only rendered when independently bookable.
- Bundle identity preserved: Bundles are stored as `{ itemType: 'package', packageId, packageItems }` with discounted price, totalDuration, and scheduleType.
- Any Professional: Evaluated with authoritative backend (`staffId: null`), never converts to hardcoded employee.
- Human error handling: Formats conflict messages with `messageAr`/`actionableGuidanceAr`, distinguishing resource conflicts from staff conflicts without exposing raw HTTP 409 or Sequelize errors.
- Multi-service audit: Documented exact backend gap (backend searchAvailability and availabilityService only accept single `serviceId`).

# Captain — Final Runtime Verification: 3-File Customer App Change
- [x] 1. Gift Cards / Wallet persistent field labels & tenant image fallback verified in Arabic and English <!-- id: cust_3file_giftcards -->
- [x] 2. Booking Notes keyboard handling, multiline typing, auto-scroll, and layout restoration verified <!-- id: cust_3file_notes -->
- [x] 3. Payment Card Details Visa/Mastercard UI, auto-grouping, MM/YY, CVV toggle, and LTR sequence verified <!-- id: cust_3file_card -->
- [x] 4. Final Diff Gate: Confirmed only 3 files modified in RifahMobile working tree <!-- id: cust_3file_diff -->

## Runtime Verification Summary
- **Runtime Test 1 (Gift Cards):** Verified in `emulator-5554` both Arabic and English modes. Validated real logos for Happiness Salon and Sun saloon, and letter monograms ("م", "ف", "V", "J") for logo-less tenants. Verified persistent visible labels for Recipient Email, Recipient Phone, Gift Message, and Payment Card fields. Labels remained visible during focus and text entry.
- **Runtime Test 2 (Booking Notes):** Verified on actual Android emulator in Review step ("مراجعة الحجز وتأكيده"). On focusing notes input, keyboard opened, entire notes field shifted smoothly above the keyboard with bottom boundary well above keyboard top, multiline text entry functioned cleanly, natural scrolling worked, and dismissing keyboard restored original layout cleanly.
- **Runtime Test 3 (Payment Card):** Verified Visa (`4111...`) and Mastercard (`5555...`) brand detection badges, 4-digit auto-spacing, MM/YY expiry auto-formatting, CVV masking and show/hide toggle, focus state outlines, and strictly LTR numeric alignment in Arabic mode. Payment submission contract remained unchanged.
- **Diff Check:** Confirmed `git status --short RifahMobile/src` shows strictly the 3 intended files (`BookingJourneyScreen.tsx`, `GiftsScreen.tsx`, and new `PaymentCardForm.tsx`).

# Captain — Bundle Availability Backend-Authoritative Architecture (Complete)
- [x] 1. Phase 1 & 2: Authoritative Backend Engine Addition in `availabilityService.js` (`getPackageAvailableSlots`) <!-- id: bundle_avail_engine -->
  - Sequence: verifies full contiguous chain with 0–5 min buffer.
  - Parallel: verifies concurrent start times, distinct staff assignment (`_verifyParallelStaffDistinctness`), and concurrent resource capacity (`_verifyParallelResourceConcurrency`).
  - Applied: staff qualification, shifts, breaks, time-off, existing appointments with buffers, operating hours, service/variant durations.
  - Day Status: checks `tenant.workingHours[dayName].isOpen === false` and returns `status: 'day-off'`.
- [x] 2. Phase 2: Public Package Availability Endpoints in `bookingController.js` and `bookingRoutes.js` <!-- id: bundle_avail_routes -->
  - `POST /bookings/package-search` and `POST /bookings/package-availability`.
  - `POST /bookings/search` accepts `packageId` and falls back if `serviceId` is a package UUID.
  - `POST /bookings/evaluate` supports `packageId` directly and falls back if `serviceId` is a package UUID.
- [x] 3. Phase 3: Customer App Integration in `BookingJourneyScreen.tsx` <!-- id: bundle_avail_customer_app -->
  - Removed local child-service querying and local JS slot chaining.
  - Evaluates package items authoritatively via backend `POST /bookings/package-search` (with fallback to `/bookings/search`).
  - Directly sets `availableSlots` from backend response.
- [x] 4. Phase 4: Day Status Model Preservation <!-- id: bundle_avail_day_status -->
  - `tenant.workingHours[dayName].isOpen === false` -> `day-off`.
  - Open + 0 feasible backend slots -> `full`.
  - Open + feasible backend slots -> `available`.
  - Zero slots never infers `day-off`.
- [x] 5. Phase 5: Bilingual Friendly Conflict & Error Handling <!-- id: bundle_avail_errors -->
  - Wrapped with `getCustomerFacingBookingErrorMessage`.
  - Never exposes raw SQL, Sequelize, or technical errors.
- [x] 6. Phase 6: Automated Testing & Verification <!-- id: bundle_avail_tests -->
  - 12/12 unit tests passing in `packageAvailabilityEngine.test.js` (Sequence, Parallel, Staff conflict, Resource conflict, Day Status, Controller endpoints).
  - TypeScript compilation `npx tsc --noEmit` in `RifahMobile` clean (0 errors).
- [x] 7. Phase 7: STOP GATE Adherence <!-- id: bundle_avail_stop_gate -->
  - No commit, no push, no deployment, no EAS build executed.

# HTTP Integration & Smoke Verification with Real Backend & Package Data (45/46 PASS)
- [x] 1. Identify real backend running state & prepare integration runner <!-- id: http_prep -->
  - PostgreSQL `rifah_clean` on localhost:5432. Supertest in-process Express app. Ephemeral ServiceEmployee + StaffSchedule fixtures for Staff Alpha & Gamma.
- [x] 2. Verify POST /package-search endpoint with real package data <!-- id: http_pkg_search -->
  - Sequence: 9/9 pass. Parallel: 3/4 pass (0 slots due to pre-existing parallel dedup limitation).
- [x] 3. Verify POST /package-availability endpoint with real package data <!-- id: http_pkg_avail -->
  - Alias for /package-search, verified identical response structure. 3/3 pass.
- [x] 4. Verify POST /search endpoint with packageId and serviceId fallback <!-- id: http_search_fallback -->
  - Direct `packageId`: 4/4 pass. `serviceId` as package UUID fallback: 3/3 pass. Regular service: 4/4 pass.
- [x] 5. Verify POST /evaluate endpoint with package <!-- id: http_evaluate -->
  - Package `packageId`: 3/3 pass. `serviceId` fallback: 3/3 pass. Specific staff: 2/2 pass. Any Professional: 2/2 pass.
- [x] 6. Verify package booking-create payload and end-to-end contract validation <!-- id: http_booking_create -->
  - `items[].itemType='package'` with `packageItems[]`: returns 401 (auth gate), not 500 (parsing error). 2/2 pass.
- [x] 7. Verify Sequence & Parallel bundle slot contiguousness & constraint enforcement <!-- id: http_seq_parallel -->
  - Sequence: 0ms gap (perfectly contiguous), `scheduleType='sequence'`, steps array with correct service chain. Parallel: 0 slots due to slot dedup limitation (documented).
- [x] 8. Verify Day status ('day-off' vs 'full' vs 'available') across real tenant schedule <!-- id: http_day_status -->
  - Available day: 48 slots. Invalid package: 404. Day-off detection in unit tests. 3/3 pass.
- [x] 9. Verify error messages are bilingual and non-technical <!-- id: http_error_msgs -->
  - Missing fields → 400 with human-readable message. `messageAr` present. No SQL/Sequelize in errors. 4/4 pass.
- [x] 10. Audit Customer App (BookingJourneyScreen.tsx) for 0 local synthesis remnants <!-- id: http_mobile_audit -->
  - All slots from backend responses. No local chaining logic. `getCustomerFacingBookingErrorMessage()` wraps all errors.
- [x] 11. Compile comprehensive 12-section verification report <!-- id: http_final_report -->
  - Full report in walkthrough.md with 13 test groups across 12 sections. 45/46 pass (97.8%).

# Final Parallel Any-Professional Fix (Complete — 49/49 PASS)
- [x] 1. Trace Root Cause & Document Staff Collapsing Point <!-- id: par_root_cause -->
  - Traced to `_getSlotsForAnyStaff` lines 928-941 where `_applySchedulingPolicy` pruned all candidates down to a single winner slot per time key before parallel distinct evaluation occurred.
- [x] 2. Implement Smallest Safe Backend Fix in `availabilityService.js` <!-- id: par_backend_fix -->
  - Added optional `includeAllCandidates = false` parameter to `getAvailableSlots` and `_getSlotsForAnyStaff`. Ordinary single-service availability behavior remains 100% unchanged.
  - Attached `allCandidatesByTime` when requested so parallel bundle engine receives full candidate arrays.
- [x] 3. Implement Multi-Candidate Parallel Distinct Staff Assignment Algorithm <!-- id: par_staff_assign -->
  - Implemented `_findParallelDistinctStaffAssignment(candidateLists)` using backtracking to discover valid distinct staff assignments across all concurrent child steps.
- [x] 4. Preserve Resource Validation and Capacity Checks <!-- id: par_preserve_res -->
  - Preserved `_verifyParallelResourceConcurrency` check immediately after staff assignment, verifying active resource count vs simultaneous requirements.
- [x] 5. Unit Tests in `packageAvailabilityEngine.test.js` (Scenarios A through G) <!-- id: par_unit_tests -->
  - 16/16 unit tests passing, covering Scenarios A (overlapping candidates), B (single staff total), C (resource exhaustion), D (explicit staff selection), E (sequence packages), F (single-service invariant), G (day status).
- [x] 6. Customer App Regression Audit (`BookingJourneyScreen.tsx`) <!-- id: par_mobile_audit -->
  - Verified `BookingJourneyScreen.tsx` is a pure consumer of backend `/bookings/package-search` and `/bookings/search`. Zero local combination or synthesis logic exists.
  - Confirmed `npx tsc --noEmit` passes with 0 errors.
- [x] 7. Re-verify T2.4 Integration Test with Real DB & Ephemeral Fixtures <!-- id: par_t24_reverify -->
  - Re-ran `node test_package_http_smoke.js`: 49/49 tests passed (100%), with T2.4 (parallel scheduleType), T2.5 (steps), T2.6 (same startTime), T2.7 (distinct staff) all passing.
- [x] 8. Clean up scratch/ephemeral files and compile final Stop Gate report <!-- id: par_stop_gate_report -->
  - Ephemeral fixtures cleanly removed. All Stop Gate criteria verified. No commit, push, deploy, or EAS build executed.

# Final Package Staff-Assignment Availability Gap
- [x] 1. Backend Support & Contract Discovery (Complete) <!-- id: pkg_staff_audit -->
- [x] 2. Authoritative Backend Contract (`staffAssignments` & `packageItems` support) <!-- id: pkg_staff_contract -->
  - Update `bookingController.js`: Parse `staffAssignments` and `packageItems` in `searchPackageAvailability`, `searchAvailability`, and `evaluateScheduling`.
  - Update `availabilityService.js`: Resolve per-child `stepStaffId` in `getPackageAvailableSlots` matching `staffAssignments` by `packageItemId` or `serviceId`, or `packageItems`.
- [x] 3. Sequence & Parallel Staff Verification & Engine Safety <!-- id: pkg_staff_engine -->
  - Ensure sequence enforces specific staff across sequential steps.
  - Ensure parallel enforces distinct staff with explicit/mixed staff combinations.
  - Safe-guard qualification errors to return 0 slots instead of 500 error.
- [x] 4. Customer App Contract Integration (`BookingJourneyScreen.tsx`) <!-- id: pkg_staff_customer_app -->
  - Send `staffAssignments` in `evaluateDates` and `fetchSlots` during `/bookings/package-search` & `/bookings/search`.
  - Pass `staffAssignments` and `packageItems` in `/bookings/evaluate`.
- [x] 5. Comprehensive Unit & Integration Tests (Scenarios 1-10) <!-- id: pkg_staff_tests -->
- [x] 6. Regression Testing & Typecheck Verification <!-- id: pkg_staff_verify -->
- [x] 7. STOP GATE Compliance & Final 17-Item Report <!-- id: pkg_staff_stop_gate -->

# Refah / BarSpa — Registration Flow Stabilization
- [ ] 1. Backend: Accept Any File Type in Tenant Registration <!-- id: reg_file_upload -->
  - In `server/src/controllers/tenantRegistrationController.js`, remove restrictive MIME/extension filter (`fileFilter`).
  - Sanitize uploaded filenames against path traversal while preserving file extension.
  - Ensure `uploadMiddleware` supports `logo`, `crDocument`, `taxDocument`, `licenseDocument`, and `nationalAddressDocument`.
  - Intercept Multer errors (file size > 10MB, etc.) and return HTTP 400 instead of unhandled 500.
- [x] 2. Backend: HTTP Status Codes & Error Consistency <!-- id: reg_http_status -->
  - Return HTTP 400 for input validation errors (inactive package, invalid format, duplicate email).
  - Catch SequelizeValidationError / SequelizeUniqueConstraintError and return 400 with descriptive error messages.
  - Preserve 500 only for unexpected runtime failures with consistent JSON structure `{ success: false, message }`.
- [x] 3. Backend: Atomic Registration & Cleanup <!-- id: reg_atomicity -->
  - Guarantee database transaction wraps Tenant creation, Subscription creation, and Audit logging.
  - On failure, rollback transaction and unlink all uploaded temporary files.
  - Prevent orphaned records (tenant, user, subscription, files).
- [x] 4. Backend: Subscription Date & Fallback Alignment <!-- id: reg_sub_dates -->
  - Fix `periodEnd` calculation in `tenantRegistrationController.js` to ensure safe fallback if `selectedBillingPeriod` is unexpected or trial, avoiding instant expiration (`effectiveStatus = 'expired'`).
- [x] 5. Frontend (tenant & Tenant-v2): Public Auth Route Protection & 401/403 Elimination <!-- id: reg_auth_routing -->
  - In `tenant/src/contexts/TenantAuthContext.tsx`, prevent `/tenant/profile` requests when on unauthenticated public routes (`/register`, `/login`, `/forgot-password`).
  - Prevent token refresh loops or redirects to login while on `/register`.
  - Cleanly separate unauthenticated registration state from authenticated dashboard area.
- [x] 6. Frontend: File Input Validation Removal & UI UX Improvements <!-- id: reg_frontend_ux -->
  - In `tenant/src/app/[locale]/register/page.tsx`, remove restrictive `accept="image/*,.pdf"` attributes so any file type is accepted.
  - Update hints and messages in Arabic and English to indicate documents are accepted without restriction.
  - Add submit locking (disable submit button, show loading spinner, prevent duplicate submissions).
  - Show field-specific error messages.
  - Mirror file input relaxation in `Tenant-v2` (`PublicRegistrationWizard.tsx`, `PublicFileUploadField.tsx`).
- [x] 7. Verification & Automated Testing <!-- id: reg_verification -->
  - Run type checks / lint checks: `tenant` (Next.js build PASSED), `Tenant-v2` (Vite build PASSED), `server` (Jest integration test PASSED 10/10).
  - Execute API tests for file uploads with multiple formats (PDF, JPG, PNG, WEBP, and non-standard e.g. TXT/DOCX).
  - Verify duplicate submit prevention, controlled validation failures (400), and rollback cleanup.
  - Verify fresh unauthenticated browser session (no 401 to `/tenant/profile` or `/auth/tenant/login`, no 403 to `/tenant/employees`).
  - Document findings, root causes, extension noise vs real errors, and results.
# BARSPA — Complete Admin Dashboard & PDF Rebrand
- [x] 1. Admin Dashboard Rebranding <!-- id: admin_rebrand -->
  - [x] 1.1 Login Page: Replace "R" box with `barspalogo.png`, change title to "BARSPA Admin", subtitle to "Admin Dashboard", remove hardcoded dev credentials banner, update placeholder. <!-- id: admin_login -->
  - [x] 1.2 Layout & Navigation: Update AdminLayout header and sidebar to use `barspalogo.png` and "BARSPA Admin". Update app layout metadata. <!-- id: admin_layout -->
  - [x] 1.3 Internal Pages: Update Settings (seller names, placeholders), Packages UI labels ("New to BARSPA"), and verify other pages. <!-- id: admin_pages -->
- [x] 2. Backend PDF Documents & Invoices Rebranding <!-- id: pdf_rebrand -->
  - [x] 2.1 Bill / Subscription Invoice (`billDocumentService.js`): Update titles, headers, footers, and prioritize `barspalogo.png`. <!-- id: pdf_bill -->
  - [x] 2.2 Invoice Snapshot Builder (`invoiceSnapshotBuilder.js`): Default seller names to BARSPA/بارسبا and default logo to `barspalogo.png`. <!-- id: pdf_snapshot -->
  - [x] 2.3 Customer Invoice & Report PDFs (`customerInvoiceDocumentService.js`, `tenantReportPdfService.js`, etc.): Audit and rebrand. <!-- id: pdf_reports -->
- [x] 3. Verification & Testing <!-- id: barspa_verification -->
  - [x] 3.1 Build Admin (`npm run build` in `admin/`). <!-- id: test_admin_build -->
  - [x] 3.2 Run Backend PDF tests and smoke test PDF generation with `barspalogo.png`. <!-- id: test_pdf_smoke -->
  - [x] 3.3 Repository audit for Refah/Rifah/رفاه occurrences. <!-- id: repo_audit -->
- [x] 4. Git Commit & Push <!-- id: git_commit_push -->
  - [x] 4.1 Commit with message `feat(refah): complete BARSPA admin and PDF rebrand`. <!-- id: git_commit -->
  - [x] 4.2 Push to `origin/main`. <!-- id: git_push -->
  - [x] 4.3 Output final handoff report matching exact template. <!-- id: final_handoff -->

# BARSPA Admin — Final Visual Theme Audit
- [x] 1. Audit Existing Admin CSS and Brand Identity <!-- id: theme_audit -->
  - Audit `admin/tailwind.config.ts`, `globals.css`, color palette, brand tokens.
  - Inspect `barspalogo.png` properties (dimensions, transparency, color scheme).
  - Search repository for existing BARSPA brand colors (#..., purple, violet, mauve).
- [x] 2. Logo Contrast & Presentation Fix <!-- id: logo_contrast -->
  - Option A: Implement premium logo container (soft white/off-white background, elegant radius, subtle shadow, appropriate padding).
  - Ensure logo rendered dimensions have proper visual presence without distortion or horizontal/vertical stretching.
  - Apply clean logo presentation to both Login page, Sidebar, and Mobile header.
- [x] 3. Polish Admin Login Page & Layout Theme <!-- id: login_theme -->
  - Enhance Login page layout, card elevation, border styling, inputs, and primary button with BARSPA brand palette.
  - Align typography hierarchy, accessibility contrast, and responsive layout.
  - Ensure AdminLayout sidebar and shell reflect the coherent BARSPA aesthetic.
- [x] 4. Verification & Testing <!-- id: theme_verification -->
  - Run `npm run build` in `admin/` to verify zero TypeScript/ESLint/Next.js build errors.
  - Review `git status` and `git diff`.
- [x] 5. Commit and Push <!-- id: theme_commit_push -->
  - Commit: `feat(admin): polish BARSPA admin theme and logo presentation`.
  - Push to `origin/main`.
  - Provide final handoff report.

# BARSPA — Phase 1: Group-Booking Correctness & Fast Walk-in Handling
- [x] 1. Pre-edit Audit & Baseline Verification <!-- id: p1_baseline -->
  - Reconfirm Git branch, HEAD SHA, working-tree status.
  - Verify and isolate all pre-existing working-tree changes to ensure zero overlap.
  - Confirm local test runners and typechecks.
- [x] 2. Eliminate Deceptive Group Step & Phantom Guest Pricing <!-- id: p1_group_correctness -->
  - Streamline wizard from 4 steps to 3 active steps in `InteractiveDrawers.tsx`: (1) Identity, (2) Services, (3) Invoice.
  - Safely disable the unpersisted guest form in single-client booking drawer while preserving type definitions for future multi-client group bookings.
  - Remove phantom guest pricing calculation (`guestAddonsPrice`) from subtotal, VAT, invoice, and payment allocations.
  - Ensure `AppointmentServicesStep.tsx` previous navigation cleanly targets Step 1 (Identity).
- [x] 3. Implement Fast Walk-in Customer Resolution <!-- id: p1_fast_walkin -->
  - Add explicit Fast Walk-in support in Step 1 (Walk-in mode requires no mandatory phone/name to proceed).
  - Pre-fill clean localized placeholders (`Customer` / `عميل`) when fields are left blank.
  - Ensure `payload.customer` maps `{ isGuest: true }` matching backend `resolveAppointmentCustomer` contract.
  - Preserve tenant configuration enforcement if `requireWalkInPhone === true`.
- [x] 4. Automated Testing & Verification <!-- id: p1_tests -->
  - Add focused backend tests in `server/src/controllers/__tests__/tenantAppointmentController.walkin.test.js` verifying fast walk-in without phone/email and price accuracy without phantom guest items.
  - Run `Tenant-v2` typecheck (`npm run lint` / `tsc --noEmit`).
  - Run backend Jest suite.
- [x] 5. Change Control & Clean Staging <!-- id: p1_change_control -->
  - Stage ONLY Phase 1 modified files (`InteractiveDrawers.tsx`, new walkin test).
  - Verify zero unrelated working-tree modifications are included in `git status`.
  - Prepare final Phase 1 handoff report.

# BARSPA — Phase 2: Fresha-Inspired Appointment Drawer
- [x] 1. Pre-edit Audit & Baseline Verification <!-- id: p2_baseline -->
  - Confirm git branch `main`, commit `83b43a0`, and working-tree status.
  - Audit all pre-existing modifications to ensure clean isolation.
  - Write concise implementation plan with UI states, risks, and acceptance criteria.
- [x] 2. Desktop Two-Column Layout Architecture in InteractiveDrawers.tsx <!-- id: p2_two_column -->
  - Expand drawer container width on desktop (`max-w-4xl lg:max-w-6xl xl:max-w-7xl`).
  - Implement two-column split on `lg:` screens:
    * Left side (in LTR) / Booking side: Customer details, queued services list, scheduling & staff controls, progressive disclosure accordions, persistent invoice footer.
    * Right side (in LTR) / Catalogue side: Searchable service catalogue, category filter tabs, service cards with duration/price, variant expansion, bundles.
- [x] 3. Queued Services Management & Progressive Disclosure <!-- id: p2_staged_items -->
  - Live queued service cards with stylist assignment dropdown, duration, start time, and remove button.
  - Progressive disclosure for advanced settings: notes, discount (flat/percent), overtime approval.
  - Fast Walk-in shortcut banner integrated cleanly into Customer card.
- [x] 4. Persistent Invoice Summary & Action Bar <!-- id: p2_persistent_invoice -->
  - Always-visible subtotal, 15% VAT, and final grand total in footer.
  - Obvious primary action: "Schedule Booking 🗓️" (or separate appointments if recovery mode).
- [x] 5. Mobile Responsive Layout Adaptation <!-- id: p2_mobile_layout -->
  - Adapt layout on `< lg` screens to a clean tabbed view between Booking Details and Catalogue.
  - Ensure zero horizontal scrolling or cramped cards on small screens.
- [x] 6. Local Verification & Build <!-- id: p2_verification -->
  - Run `npm run lint` (`tsc --noEmit`) in `Tenant-v2` (PASSED).
  - Run `npm run build` in `Tenant-v2` (PASSED).
  - Run backend walkin tests in `server/` (PASSED).
  - Verify layout responsiveness, walk-in compatibility, and invoice totals.

# BARSPA — Phase 2 Fix: Service Catalogue Category Resolution
- [x] 1. Root Cause Identification: `resolveServiceOrBundleCategory` returns object, compared with string `cat.id` <!-- id: cat_root_cause -->
- [x] 2. Apply fix in `InteractiveDrawers.tsx` for `categorySections` and `tabCounts` <!-- id: cat_apply_fix -->
- [x] 3. Run typecheck, build, and backend test verification <!-- id: cat_verify -->
- [x] 4. Commit and push only dedicated fix to `origin/main` (commit `f7f70ec`) <!-- id: cat_commit_push -->
- [x] 5. Report root cause, files changed, verification results, commit SHA and handoff <!-- id: cat_report -->

# BARSPA — Phase 2 Fix: Bundle Component vs Standalone Service Staging Isolation
- [x] 1. Root cause trace: `isQueuedServiceSelected` matched bundle component items, causing standalone cards to display "Added" <!-- id: bundle_root_cause -->
- [x] 2. Create `bundleStagingHelpers.ts` for strict standalone vs bundle isolation <!-- id: bundle_helpers -->
- [x] 3. Update `InteractiveDrawers.tsx` to use shared helpers for selection, removal, and toggle <!-- id: bundle_apply_fix -->
- [x] 4. Add focused automated test suite `InteractiveDrawers.bundleStaging.test.ts` (5/5 tests passing) <!-- id: bundle_tests -->
- [x] 5. Run TypeScript check, build, and backend tests <!-- id: bundle_verify -->
- [x] 6. Commit and push dedicated fix to `main` (`2a79ad21619505876cdaca64508bdf46bdbc9658`) <!-- id: bundle_commit_push -->
- [x] 7. Report findings, test results, and commit SHA <!-- id: bundle_report -->

# BARSPA Tenant-v2 — Phase 2 Additional Requirements
- [x] 1. Requirement A: Guard drawer dismissal & reset discarded drafts <!-- id: p2_dismissal_guard -->
  - Backdrop, close button (X), and Escape route through unified `handleRequestDismissCreateDrawer`.
  - Clicking inside drawer does not dismiss (`onClick={(e) => e.stopPropagation()}`).
  - Pristine drawer closes immediately with zero prompts.
  - Dirty drawer prompts confirmation dialog with "Keep editing" and "Discard and leave".
  - Keep editing preserves all entered state.
  - Discard and leave resets entire form state and permanently invalidates draft storage so reopening shows a fresh form.
- [x] 2. Requirement B: Functional service-level time editing <!-- id: p2_time_editing -->
  - Bundle header: start time selector adjusts bundle start time (synchronizing parallel bundles or cascading sequential bundles).
  - Bundle child steps: per-service start time selector adjusts step time and cascades sequential dependents.
  - Standalone queued services: clicking card toggles configuration drawer, start time selector adjusts time and cascades dependent services.
  - Resource checks, staff eligibility, and preflight conflict checks preserved.
- [x] 3. Comprehensive automated test suite (`InteractiveDrawers.dismissalAndTiming.test.ts`) <!-- id: p2_additional_tests -->
  - 15/15 tests passing across bundle staging, dismissal evaluation, dirty checking, and time cascading.
- [x] 4. Typecheck and build verification <!-- id: p2_additional_build -->
  - `npm run lint` (`tsc --noEmit`): 0 errors.
  - `npm run build`: Vite & esbuild succeeded.
  - Server walkin tests: 2/2 passing.
- [x] 5. Git Stage, Commit & Push dedicated changes to `main` (`353c644eef29108f28e8dee7d11ff07f464af01a`) <!-- id: p2_git_push -->
- [x] 6. Final verification report and approval gate <!-- id: p2_final_report -->

# BARSPA Phase 2 — Operating-Hours Extension & Booking Failure Fix (Complete)
- [x] 1. Investigation & Root Cause Trace <!-- id: ext_investigation -->
- [x] 2. User Gate Approval: Backend runtime changes approved <!-- id: ext_user_gate -->
- [x] 3. Backend Fix: Propagate and honor `overtimeApproval` in `tenantAppointmentController.js` and `bookingService.js` <!-- id: ext_backend_fix -->
- [x] 4. Frontend Fix: Correct payload formatting in `InteractiveDrawers.tsx` <!-- id: ext_frontend_fix -->
- [x] 5. Automated Tests: Unit and integration tests for bundle overtime extension <!-- id: ext_tests -->
- [x] 6. Typecheck, build, and backend test verification <!-- id: ext_verify -->
- [x] 7. Git commit and push dedicated changes to `main` (`8b25c0fee899bd597d0d48f3f65d77ea5c427e93`) <!-- id: ext_commit_push -->
- [x] 8. Comprehensive handoff report <!-- id: ext_handoff_report -->

# BARSPA Tenant-v2 — Phase 3: Smart Availability & Conflict Recovery
- [x] 1. Audit Existing Availability & Next-Available Implementation <!-- id: p3_audit -->
  - Inspected `availabilityService.js`, `bookingService.js`, `bookingController.js`, and `useSmartConflictResolver.ts`.
  - Identified gaps in `getNextAvailableSlot`: required `staffId`, no `startDate` parameter, no package/bundle or multi-service support.
- [x] 2. Backend: Extend `getNextAvailableSlot` to Support Bundles, Any-Staff & StartDate <!-- id: p3_backend_avail -->
  - Enhanced `availabilityService.getNextAvailableSlot` to accept `startDate`, optional `staffId` (Any Staff), `packageId`, and `packageItems`.
  - Updated `bookingController.getNextAvailableSlot` to relax required `staffId` and pass `startDate`, `packageId`.
  - Added backend automated tests in `server/src/services/__tests__/nextAvailableSlot.test.js` (3/3 passed).
- [x] 3. Frontend API Adapter & Availability Layer in `Tenant-v2` <!-- id: p3_api_adapter -->
  - Added `searchPackageAvailability` and `getNextAvailableSlot` methods to `tenantApiAdapter.ts`.
  - Created `Tenant-v2/src/services/smartAvailabilityService.ts` for multi-service chains and bundle availability.
- [x] 4. Frontend: Fresha-Inspired "Find Available Times" Experience in `InteractiveDrawers.tsx` <!-- id: p3_ui_drawer -->
  - Added "Find Available Times" toggle & dedicated `SmartAvailabilityPicker` component.
  - Interactive slot chips grouped by period (Morning, Afternoon, Evening) for the selected date.
  - "Next available date" banner/card offering earliest valid slot when current date has no availability.
  - "Check all professionals" toggle allowing receptionist to inspect slots across all qualified staff.
  - Selecting a slot automatically syncs/cascades service start times while strictly preserving all draft data (customer, services, bundles, discounts, notes).
  - Responsive layout (desktop & mobile tabs) with full Arabic RTL support.
- [x] 5. Conflict Recovery & Final Preflight Backend Validation <!-- id: p3_conflict_recovery -->
  - Connected slot selection to smart conflict resolution and preflight check.
  - Ensured final booking submission re-validates availability and never treats frontend state as authoritative booking license.
  - Maintained zero duplicate / partial bookings on failure.
- [x] 6. Verification & Automated Testing <!-- id: p3_verification -->
  - Ran Tenant-v2 automated tests (`smartAvailabilityService.test.ts`): 3/3 passed.
  - Ran Tenant-v2 typecheck (`npm run lint` / `tsc --noEmit`): 0 errors.
  - Ran Tenant-v2 production build (`npm run build`): Vite & esbuild succeeded.
  - Ran backend Jest tests (`nextAvailableSlot.test.js` & `tenantAppointmentController.overtimeBundle.test.js`): all passed.
- [x] 7. Git Stage, Commit & Push dedicated changes to `main` <!-- id: p3_git_push -->
- [x] 8. Final Phase 3 Handoff Report & Stop Gate <!-- id: p3_report -->

# BARSPA Tenant-v2 — Phase 4: Customer History & One-Click Rebooking
- [x] 1. Step 1: Audit Existing Capabilities & Intended Design <!-- id: p4_audit -->
  - Inspected customer search/selection in `InteractiveDrawers.tsx`, appointment history APIs in `tenantCustomerController.js` and `tenantApiAdapter.ts`.
  - Validated models (Service, ServiceVariant, ServicePackage, Appointment).
  - Reported audit findings, reused endpoints, files to change, and backend dependencies. Approved by user.
- [x] 2. Step 2: Customer Booking History UI Component (`CustomerBookingHistory.tsx`) <!-- id: p4_history_ui -->
  - Built compact, accessible recent booking history viewer for selected registered customer.
  - Displays appointment date/time, services & variants booked, staff assignments, status pill, reference price.
  - Implemented loading, empty ("First-time client"), and error states (non-blocking).
  - Full Arabic RTL and English localization.
- [x] 3. Step 3: One-Click Rebooking Handler & Draft Creation in `InteractiveDrawers.tsx` <!-- id: p4_rebook_engine -->
  - Implemented `handleRebookAppointment` converting historical appointment/session into a fresh draft.
  - Revalidates customer and service existence against current catalog; clearly flags retired/inactive services.
  - Recalculates prices and VAT with current catalog rates (`finalPrice ?? price`), never copying old prices.
  - Evaluates current availability via `SmartAvailabilityPicker` / availability engine; allows date/time and staff adjustment.
  - Generates fresh unique IDs; does not copy appointment ID, payment state, transactions, or expired discounts.
  - Preserves sequential/parallel bundle rules and standalone isolation.
- [x] 4. Step 4: Safeguard Existing Behavior & Invariants <!-- id: p4_safeguards -->
  - Preserved fast walk-in mode and tenant contact-number policies.
  - Preserved dirty-draft dismissal protection and reset/discard behavior.
  - Preserved timezone, board-minute calculation, and overtime authorization rules.
  - Kept payment processing and checkout untouched.
- [x] 5. Step 5: Verification & Automated Test Suite <!-- id: p4_verification -->
  - Wrote focused tests in `customerBookingHistory.test.ts` covering Scenarios 1-10 (10/10 passed).
  - Ran `Tenant-v2` typecheck (`npm run lint` / `tsc --noEmit` - passed with 0 errors).
  - Ran `Tenant-v2` production build (`npm run build` - Vite & esbuild succeeded).
  - Ran all regression suites in Tenant-v2 (28/28 tests passed).
- [x] 6. Git Stage, Commit & Push Dedicated Phase 4 Changes <!-- id: p4_commit_push -->
  - Stage only Phase 4 files (preserve 13 unrelated tracked files).
  - Push to `origin/main` without automatic deployment.
- [x] 7. Final Phase 4 Report & Stop Gate <!-- id: p4_report -->

# BARSPA Tenant-v2 — Phase 5A: Genuine Group Appointments
- [x] 1. Architecture & Persistence Audit and Service Foundation <!-- id: p5a_arch_foundation -->
  - Extended `bookingService.createBookingSession` to respect `item.platformUserId`, attributing child appointments to genuine participant identities instead of collapsing to organizer.
  - Stored group coordination context in `BookingSession.metadata` (`sessionType: 'group'`, `groupName`, `paymentArrangement: 'organizer_pays' | 'individual_pays'`, `organizer`, `participants`).
  - Updated `syncBookingSessionTotals` in `tenantAppointmentController.js` and `bookingService.js` to exclude cancelled appointments from active session totals.
- [x] 2. Controller Group Booking Support in `tenantAppointmentController.js` <!-- id: p5a_controller -->
  - Enhanced `createAppointment` to accept group bookings (`sessionType: 'group'`, `groupName`, `paymentArrangement`, `participants`).
  - Resolved distinct customer identities (`PlatformUser`) for every participant (both registered customers and walk-in guests via `resolveAppointmentCustomer`).
  - Enforced atomic transaction creation: validates all participants, staff qualifications, and timing before persisting.
- [x] 3. Dual Payment Arrangements & Financial Integrity <!-- id: p5a_payments -->
  - Option A (Organizer pays for everyone): Session-level financial summary, consolidated payment processing across session appointments with 15% VAT, and genuine payment transactions.
  - Option B (Each participant pays individually): Updated `appointmentPaymentService.js` and `updatePaymentStatus` so `individual_pays` or single-appointment scope restricts payment allocations strictly to that participant's appointment.
  - Maintained session-level reconciliation (total group value, total collected, remaining balance).
- [x] 4. Participant Cancellation & Lifecycle Management <!-- id: p5a_cancellation -->
  - Ensured cancelling one participant's appointment preserves sibling participant appointments and updates session totals without cross-cancelling.
  - Safely transition session status to 'cancelled' only when all session appointments are cancelled.
- [x] 5. Frontend Group Booking Experience in `Tenant-v2` (`InteractiveDrawers.tsx`) <!-- id: p5a_frontend_ui -->
  - Added Single Client vs Group Booking selector in creation drawer.
  - Implemented Organizer selector & Participant Manager (add/remove participants, registered vs walk-in).
  - Enabled per-participant service staging, variant selection, staff assignment, and start time.
  - Added Payment Arrangement selector (Organizer Pays All vs Individual Participant Payments).
  - Rendered live participant breakdown and consolidated group summary (subtotal, 15% VAT, total).
  - Preserved Arabic RTL, mobile tab responsiveness, dirty draft dismissal confirmation, and conflict recovery.
- [x] 6. Comprehensive Automated Tests <!-- id: p5a_tests -->
  - Backend integration test suite in `tenantGroupBooking.test.js`: 5/5 passed covering 3 participants with distinct identities/services/staff, Option A consolidated payment, Option B independent participant payment, atomic rollback, and single participant cancellation.
  - Frontend test suite in `groupBooking.test.ts`: 5/5 passed covering group staging, participant scoping, pricing calculation with 15% VAT, and dirty draft detection.
- [x] 7. Typecheck, Build, and Regression Verification <!-- id: p5a_verification -->
  - Ran Tenant-v2 typecheck (`npm run lint` / `tsc --noEmit`): 0 errors.
  - Ran Tenant-v2 production build (`npm run build`): Vite & esbuild succeeded.
  - Ran backend Jest test suites: 100% pass across group booking and walk-in suites.
  - Verified zero impact on existing single-client bookings, walk-ins, and bundles.
- [x] 8. Change Control, Commit, Push & Final Report <!-- id: p5a_report -->
  - Staged only dedicated Phase 5A files, preserving all 13 unrelated tracked files.
  - Committed and pushed to `main`.
  - Reported findings, changed files, Coolify services, and stopped for owner review.

## Phase 5A Review & Verification Results
- **Backend Tests:** 5/5 PASS in `server/src/controllers/__tests__/tenantGroupBooking.test.js` (Distinct customer records, Option A consolidated session payment, Option B isolated appointment payment, atomic validation rollback, and cancellation isolation).
- **Existing Backend Suite:** 2/2 PASS in `server/src/controllers/__tests__/tenantAppointmentController.walkin.test.js`.
- **Frontend Unit Tests:** 5/5 PASS in `Tenant-v2/src/components/__tests__/groupBooking.test.ts`.
- **Frontend Typecheck & Build:** `npm run lint` (`tsc --noEmit`) clean with 0 errors; `npm run build` successfully bundled Vite client and esbuild server.
- **Change Control:** Strictly isolated to Phase 5A files. All 13 unrelated tracked files (`RifahMobile/*`, `server/src/controllers/tenantOrderController.js`, etc.) completely untouched.

# Pre-Deployment Regression Review: Multi-Service Chained Availability
- [x] 1. Trace Multi-Service Availability Flow <!-- id: reg_trace_flow -->
  - Traced `calculateSmartAvailability` -> `calculateAllValidChains` -> `handleSelectSmartSlot` -> `handleConfirmAppointmentCreation` -> `preflightMultiServiceChain` -> `bookingService._createBookingSession`.
- [x] 2. Determine Root Cause & Discrepancy Breakdown <!-- id: reg_root_cause -->
  - Confirmed `c5c2f71` resolved the board-minute vs minute-from-midnight offset bug (which caused false overnight projections to 2:30 AM).
  - Identified remaining chain-level defect: `handleSelectSmartSlot` only assigned staff to the first staged item (`anchorItem`), leaving subsequent chained services with default/conflicting staff assignments, causing preflight validation to reject with "cannot be booked continuously".
- [x] 3. Implement Smallest Safe Local Fix <!-- id: reg_local_fix -->
  - Created `applySmartSlotToStagedServices` in `smartAvailabilityService.ts` to assign chained start times, ISO timestamps, and assigned qualified staff across all staged items.
  - Updated `handleSelectSmartSlot` in `InteractiveDrawers.tsx` to apply chained slots when present.
- [x] 4. Add Automated Regression Tests <!-- id: reg_tests -->
  - Expanded `smartAvailabilityMismatchRegression.test.ts` to 6 tests covering chained staff assignment, conflict-free preflight acceptance, prior defect demonstration, and genuine conflict rejection.
- [x] 5. Run Verification Gates & Builds <!-- id: reg_verification_gates -->
  - 36/36 frontend tests pass.
  - 16/16 backend tests pass (group booking, walk-in, bundle reconciliation, overtime bundle).
  - `Tenant-v2` `npm run lint` (`tsc --noEmit`): 0 errors.
  - `Tenant-v2` `npm run build`: Vite & esbuild succeeded.
- [x] 6. Preserve Working Tree & Prepare Dedicated Commit <!-- id: reg_commit_ready -->
  - Staged only `InteractiveDrawers.tsx`, `smartAvailabilityService.ts`, and `smartAvailabilityMismatchRegression.test.ts`.
  - All 13 unrelated tracked files preserved untouched.

# BARSPA Phase 5A — /bookings/search HTTP 400 Investigation & Fix
- [x] 1. Investigation & Root Cause Trace <!-- id: p5a_search_trace -->
  - Audited callers of `/api/v1/bookings/search` across Tenant V2 (`smartAvailabilityService.ts`, `availabilityService.ts`, `AppointmentWorkspace.tsx`, `useTimeSlotAvailability.ts`).
  - Compared constructed parameters against backend validation rules in `bookingController.searchAvailability` and route registration in `bookingRoutes.js`.
  - Documented root causes for HTTP 400 Bad Request and 3 failed requests pattern.
- [x] 2. Backend Route & Controller Contract Alignment <!-- id: p5a_search_backend -->
  - Registered `router.get('/search', bookingController.searchAvailability)` in `server/src/routes/bookingRoutes.js` before `router.get('/:id')`.
  - Registered `router.get('/package-search', bookingController.searchPackageAvailability)` and `router.get('/package-availability', ...)`.
  - Updated `bookingController.searchAvailability` and `searchPackageAvailability` to accept parameters from both `req.query` and `req.body` with safe JSON parsing.
  - Added UUID regex validation guard to `getBooking` to prevent non-UUID inputs (like `/search`) from throwing PostgreSQL syntax crashes.
- [x] 3. Frontend Caller Correction & Guarding in Tenant V2 <!-- id: p5a_search_frontend -->
  - In `Tenant-v2/src/lib/tenantApiAdapter.ts`: accept `packageId?: string`, guard against empty `tenantId` / `date` / `serviceId+packageId`.
  - In `Tenant-v2/src/services/availabilityService.ts`: support `item.packageId` alongside `item.serviceId` in `fetchAvailabilityLayers`.
  - In `Tenant-v2/src/services/smartAvailabilityService.ts`: forward `item.packageId` in fallback availability loop.
  - In `Tenant-v2/src/components/InteractiveDrawers.tsx`: bypass single-client sequential chain preflight for group bookings (`bookingScope === 'group'`).
  - In `Tenant-v2/src/components/AppointmentWorkspace.tsx`: forward `targetPackageId` alongside `targetServiceId`.
- [x] 4. Automated Regression Tests <!-- id: p5a_search_tests -->
  - Added backend tests in `server/src/controllers/__tests__/bookingSearchContract.test.js` covering GET/POST query/body parameters, UUID isolation, and package search (8/8 pass).
  - Added frontend tests in `Tenant-v2/src/services/__tests__/availabilitySearchContract.test.ts` verifying caller parameter serialization, package support, and group preflight bypassing (6/6 pass).
- [x] 5. Verification & Gates <!-- id: p5a_search_verify -->
  - Verified frontend test suite (6/6 pass in `availabilitySearchContract.test.ts`, 7/7 pass in `groupBooking.test.ts`, 6/6 pass in `smartAvailabilityMismatchRegression.test.ts`).
  - Verified backend test suite (8/8 pass in `bookingSearchContract.test.js`, 5/5 pass in `tenantGroupBooking.test.js`).
  - Passed Tenant-v2 `npm run lint` (`tsc --noEmit`) with 0 errors.
  - Passed Tenant-v2 `npm run build` (Vite client & esbuild server).
  - Confirmed all 13 unrelated tracked files remain untouched.
- [ ] 6. Git Commit & Push Dedicated Fixes to main <!-- id: p5a_search_push -->

## Phase 5A /bookings/search Review & Verification Results
- **Root Cause 1 (Backend Route Registration & Parameter Ingestion):**
  Previously, `server/src/routes/bookingRoutes.js` registered only `POST /search`. Any `GET /search` fell through to `router.get('/:id')` where `:id = 'search'`. Furthermore, `bookingController.searchAvailability` only parsed `req.body`, returning HTTP 400 (`tenantId is required`) if sent via GET or without body.
- **Root Cause 2 (The 3 Failed Requests Loop):**
  In `InteractiveDrawers.tsx`, when multi-service or 3 group participants were staged, `handleConfirmAppointmentCreation` preflighted all items via `preflightMultiServiceChain` in a sequential loop of 3 requests. For group bookings with packages or missing `serviceId`, or unhydrated `tenantId`, each request sent invalid/empty search parameters, triggering 3 consecutive HTTP 400 responses.
- **Backend Fix:** Supported dual GET/POST on `/search` and `/package-search` routes, unified `req.query` and `req.body` ingestion, added UUID route guard on `GET /:id`.
- **Frontend Fix:** Added parameter validation guard in `tenantApiAdapter.searchAvailability`, supported `packageId` in `fetchAvailabilityLayers` and `AppointmentWorkspace`, and bypassed sequential chain preflight for `bookingScope === 'group'`.
- **Verification Gates:**
  - Backend tests: 8/8 PASS (`bookingSearchContract.test.js`), 5/5 PASS (`tenantGroupBooking.test.js`).
  - Frontend tests: 6/6 PASS (`availabilitySearchContract.test.ts`), 7/7 PASS (`groupBooking.test.ts`), 6/6 PASS (`smartAvailabilityMismatchRegression.test.ts`).
  - Typecheck: `tsc --noEmit` clean with 0 errors.
  - Production build: Vite client and esbuild server built successfully.
  - Unrelated files: All 13 protected tracked files strictly preserved.

# Phase 5A — Group Scheduling, Resource Allocation & Guest Identity Remediation
- [x] 1. Issue A — Independent Participant Scheduling & Overlapping Start Times <!-- id: p5a_issue_a -->
  - Fix `Tenant-v2/src/components/InteractiveDrawers.tsx` service addition (`handleAddStagedService` and `handleAddPackageToStaged`) to base initial start time on the active participant's items, allowing distinct participants to start concurrently at `currentStartTime`.
  - Fix cascading loop in `handleUpdateStagedService` so sequential start time cascading applies strictly within the same participant's items rather than across participants.
- [x] 2. Issue B — Group Combined Resource Availability & Capacity Checks <!-- id: p5a_issue_b -->
  - Verify and reinforce concurrent resource capacity checks across all participants in `bookingService._createBookingSession` and `tenantAppointmentController.js`.
  - Ensure resource exhaustion throws actionable 409 conflict errors with `availableAgainAt` and rolls back transactions atomically.
- [x] 3. Issue C — PlatformUser Null Violations & Guest Identity Resolution <!-- id: p5a_issue_c -->
  - Align `server/src/models/PlatformUser.js` with DB migration `20260812094645` by setting `phone` and `lastName` to `allowNull: true` with conditional E.164 phone validation.
  - Fix name normalization in `tenantAppointmentController.js:resolveAppointmentCustomer` and `InteractiveDrawers.tsx` to cleanly split full names into `firstName` and `lastName`.
  - Enforce tenant policy `requireWalkInPhone` consistently across registered and walk-in participants without inventing fake data or throwing unhandled 500s.
- [x] 4. Automated Regression Tests <!-- id: p5a_group_tests -->
  - Add backend tests in `tenantGroupBooking.test.js` covering concurrent participant scheduling, resource exhaustion, walk-in vs registered identity, and individual payment.
  - Add frontend tests in `groupBooking.test.ts` covering overlapping participant times and intra-participant sequential cascading.
- [x] 5. Verification Gates & Build <!-- id: p5a_group_verify -->
  - Run backend Jest test suite.
  - Run frontend `tsx --test` test suite.
  - Run `npm run lint` (`tsc --noEmit`) and `npm run build` in `Tenant-v2`.
  - Verify that all 13 protected tracked files remain untouched.
- [x] 6. Commit & Push Dedicated Fixes <!-- id: p5a_group_push -->

# Phase 5A Enhancement — Service Resource Badges & Live Availability Indicators
- [x] 1. Backend: Authoritative Batch Resource Availability Engine <!-- id: p5a_res_backend_engine -->
  - In `resourceRequirementResolver.js`, extend `checkResourceAvailability` to support `alreadyAllocatedResourceIds`.
  - Add `batchCheckResourceAvailability` resolving requirements, querying active instances, filtering DB appointments, and simulating intra-batch concurrent allocations.
  - Implement controller method `tenantResourceController.batchCheckResourceAvailability` and register `POST /api/v1/tenant/resources/batch-check` in `tenantRoutes.js`.
  - Add backend tests in `server/src/controllers/__tests__/tenantResourceAvailability.test.js` verifying Scenarios 1 to 5, 7, 8, 10.
- [x] 2. Frontend: Adapter & Resource Availability State Management <!-- id: p5a_res_frontend_adapter -->
  - Add `batchCheckResourceAvailability` method to `tenantApiAdapter.ts`.
  - Create `useLiveResourceAvailability` hook or helper with debounced batching, caching, and distinct loading/unknown vs available vs conflict states.
- [x] 3. Frontend: Resource Badges on Catalogue Cards & Variants <!-- id: p5a_res_catalogue_badges -->
  - Implement compact resource badges in `InteractiveDrawers.tsx` for service catalogue cards and individual variant rows.
  - Handle unknown/loading state without prematurely showing green/available (Scenario 9).
  - Turn badges red on conflict with tooltip/actionable message and available again time.
- [x] 4. Frontend: Resource Badges on Queued Services & Bundles <!-- id: p5a_res_queued_badges -->
  - Render resource badges next to standalone queued services and participant-specific items in Group Booking mode.
  - For bundles: render component-level badges at their respective scheduled intervals and compact aggregate summary.
  - Refresh live when adding services, changing date, start time, duration, variant, staff, or smart availability slots.
- [x] 5. Frontend & Backend Automated Tests (10 Scenarios) <!-- id: p5a_res_tests -->
  - Scenario 1: Correct resource badges for configured services and variants.
  - Scenario 2: Available resource vs fully occupied resource.
  - Scenario 3: Multiple compatible resource instances where at least one remains available.
  - Scenario 4: Resource capacity exhausted by existing appointments.
  - Scenario 5: Bundle components with different resource requirements and time intervals.
  - Scenario 6: Resource status refresh after changing selected time.
  - Scenario 7: Combined resource allocation across multiple group participants.
  - Scenario 8: A staged participant consuming remaining resource capacity for another participant.
  - Scenario 9: Unknown/loading availability not displayed as confirmed available.
  - Scenario 10: Existing backend final validation still rejects genuine conflicts.
- [x] 6. Verification Gates, Typecheck & Builds <!-- id: p5a_res_verify -->
  - Run backend Jest test suites (`tenantResourceAvailability.test.js`, `tenantGroupBooking.test.js`, `resourceSchedulingPhase1b.test.js`).
  - Run frontend test suite (`tsx --test`).
  - Run `Tenant-v2` `npm run lint` (`tsc --noEmit`) and `npm run build`.
  - Verify that all 13 protected tracked files remain untouched.
- [ ] 7. Dedicated Git Commit & Push to main <!-- id: p5a_res_push -->

# BARSPA — Phase 5A Resource Badge Count Inconsistency
- [x] 1. Semantics & Forensic Audit <!-- id: p5a_badge_audit -->
  - Trace `InteractiveDrawers.tsx`, `ResourceBadge.tsx`, `POST /api/v1/tenant/resources/batch-check`, and `resourceRequirementResolver.js`.
  - Document precise semantics for Catalogue service badge vs Queued-service badge.
  - Determine candidate start & end timestamps, chained vs slot start times, staged allocations passed, self-conflict evaluation, and out-of-order/stale handling.
  - Inspect why Moroccan massage, Thai therapy, and sauna showed different counts (`1/2` vs `2/2`) despite the `Massage rooms` label.
- [x] 2. Implementation Fixes <!-- id: p5a_badge_fixes -->
  - Enforce half-open interval overlap rule: `allocationStart < candidateEnd && allocationEnd > candidateStart` (2:20 PM end does not conflict with 2:20 PM start).
  - Ensure queued-service badge excludes own staged allocation while including other overlapping staged demands.
  - Ensure catalogue service badge checks against all simulated staged allocations at the candidate's intended start time (active participant chained start time or selected slot).
  - Guard against stale / out-of-order async responses in `InteractiveDrawers.tsx` / `ResourceBadge.tsx`.
- [x] 3. Comprehensive Regression Tests <!-- id: p5a_badge_tests -->
  - Authoritative two-room fixture covering:
    1. One queued massage at 1:20 PM for 60 min.
    2. Second massage starting at 2:20 PM for 30 min (sequential reuse: 2/2 available).
    3. New candidate overlapping first service (1:40 PM: 1/2 available).
    4. Third simultaneous one-room demand when both rooms occupied (0/2 conflict).
    5. Variants sharing displayed resource label but different configured requirements/durations.
    6. Adding, removing, and changing the time of queued items.
    7. Delayed or out-of-order batch-check responses.
- [x] 4. Verification Gates, Typecheck & Builds <!-- id: p5a_badge_verify -->
  - Run backend Jest test suites (20/20 PASS in `tenantResourceAvailability.test.js`, 20/20 PASS in regression suites).
  - Run frontend test suite (20/20 PASS in `resourceBadges.test.ts`).
  - Run `Tenant-v2` `npm run lint` (`tsc --noEmit`) (0 errors) and `npm run build` (built in 7.95s).
  - Verify that all 13 protected tracked files remain untouched.
- [x] 5. Commit, Push & Final Report <!-- id: p5a_badge_push -->
  - Commit and push confirmed fix to `main`.
  - Document root cause, timestamp-and-capacity breakdown, files changed, test results, commit SHA.

# BARSPA — Final Pre-Fresha Fixes: Group Resource Timing and Employee Duty-Time Shading
- [x] 1. Workstream A: Audit & Group Booking Resource Timing <!-- id: ws_a_audit -->
  - Audit candidate probe start time in `InteractiveDrawers.tsx` for single vs group booking.
  - Fix new participant timing: default to group start time / explicit start time (never organizer chain end).
  - Fix existing participant timing: chain strictly within participant's own timeline.
  - Display evaluated candidate time on catalogue resource badges and tooltips (e.g. `Massage rooms · 1/2 available · 5:10 PM`).
  - Document queued badge semantics (individual item interval viability with self-exclusion).
- [x] 2. Workstream A: Automated Regression Tests <!-- id: ws_a_tests -->
  - Abir 60m at 5:10 PM + Participant 2 30m at 5:10 PM fixture.
  - Candidate at 5:10 PM reports 0/2 available.
  - Candidate at 5:40 PM evaluates against full duration and reports 1/2 available.
  - New participant with no services starts at group start time.
  - Additional service for existing participant follows own timeline.
- [x] 3. Workstream B: Employee Duty-Time Shading Engine & UI <!-- id: ws_b_engine -->
  - Inspect `StaffShift` schema and recurring/date-specific shift windows.
  - Add backend `getAllShifts` (`GET /api/v1/tenant/shifts`) in `tenantScheduleController.js` and `tenantRoutes.js`.
  - Add `tenantApiAdapter.getTenantShifts()` method.
  - Create `employeeDutyHours.ts` helper resolving duty intervals for any staff member and dateKey.
  - Update `AppointmentWorkspace.tsx` to load shifts and attach `dutyIntervals` to `SchedulerColumn`.
  - Update `SchedulerGrid.tsx` to shade off-duty slots in subtle neutral gray while preserving normal background during duty periods.
- [x] 4. Workstream B: Automated Regression Tests <!-- id: ws_b_tests -->
  - Fatima 2:00 PM–10:00 PM shift with 9:00 AM–9:00 PM salon hours.
  - Morning-only shift.
  - Split shifts with gray gaps.
  - No applicable shift (full gray column).
  - Date changes and shift boundary transitions.
- [x] 5. Verification Gates, Typecheck & Builds <!-- id: prefresha_verify -->
  - Run backend unit/integration tests.
  - Run frontend `resourceBadges.test.ts` and `employeeDutyHours.test.ts`.
  - Run `Tenant-v2` `npm run lint` and `npm run build`.
  - Verify all 13 protected tracked files remain untouched.
- [x] 6. Commit, Push & Final Report <!-- id: prefresha_push -->

# BARSPA — Critical Audit: Multi-Service Consecutive Booking & Duty-Time Shading
- [x] 1. Deep Pipeline Audit & Root Cause Isolation <!-- id: audit_pipeline -->
  - Trace `InteractiveDrawers.tsx` submission flow, `useSmartConflictResolver.ts`, and backend `bookingService.js`.
  - Identify root cause: Preflight checks `layerSlots.find(s => s.startTime === reqTimeMs)`. When appointment starts on non-15m boundary (e.g. 2:10 PM / 14:10, 3:10 PM / 15:10), `exactSlot` is undefined.
  - Document why Fatima is displayed as "Available" in the error modal: `diagnostic === null` defaults to `reasonType: 'available'`.
  - Reconcile with backend authoritative validation (`evaluateSchedulingRequest` and `createBookingSession`), which supports arbitrary minute boundaries and half-open intervals.
- [x] 2. Reproduction Tests & Regression Fixtures <!-- id: reg_tests -->
  - Add backend and frontend tests replicating Thursday 15 Oct 2026, Fatima (14:00-21:00), Moroccan massage (14:10-15:10), variant (15:10-15:40).
  - Verify boundary half-open intervals `[14:10, 15:10)` and `[15:10, 15:40)`.
  - Verify conflict detection remains authoritative on genuine overlaps, off-shift, breaks, and resource exhaustion.
- [x] 3. Fix Multi-Service Preflight Chain & Availability Evaluation <!-- id: fix_multi_service -->
  - Update `useSmartConflictResolver.ts` and `AppointmentWorkspace.tsx` to validate intervals against duty windows and conflicts rather than demanding strict `slotInterval` grid alignment.
  - Ensure preflight and backend final validation agree on identical fixtures.
  - Clean up misleading "Available" error card mapping when an unknown/unexpected failure occurs.
- [x] 4. Secondary UI Refinement: Employee Duty-Time Shading & Slot Click Messages <!-- id: duty_shading_refine -->
  - Darken off-duty slot background slightly in `SchedulerGrid.tsx` for clear distinction while preserving timeline visibility.
  - In `onSlotClick`, suppress drawer opening on off-duty slots.
  - Show localized shift information toast:
    - Pre-shift: `"[Name]'s duty starts at 2:00 PM"` / `"تبدأ مناوبة [الاسم] في الساعة 2:00 م"`
    - Post-shift: `"[Name]'s duty ended at 9:00 PM"` / `"انتهت مناوبة [الاسم] في الساعة 9:00 م"`
    - Split-shift gap: `"[Name]'s next duty starts at 5:00 PM"` / `"تبدأ المناوبة التالية لـ [الاسم] في الساعة 5:00 م"`
    - Off day: `"[Name] is not scheduled to work today"` / `"[الاسم] ليس لديه دوام اليوم"`
  - Add unit tests for boundary clicks, pre-shift, post-shift, split-gap, and off-day toasts.
- [x] 5. Verification & Safety Checks <!-- id: verify_and_push -->
  - Run all backend and frontend tests.
  - Run `Tenant-v2` `npm run lint` (`tsc --noEmit`) and `npm run build`.
  - Verify 13 protected tracked files remain untouched.
  - Commit and push to `main` without automatic deployment.# BARSPA — Fresha Appointment Details Drawer: Phase 1 Read-Only Audit (Completed)
- [x] 1. Locate entry point and component hierarchy in Tenant-v2 (`AppointmentWorkspace.tsx`) <!-- id: fdr_p1_entry -->
- [x] 2. Inventory visible & functional drawer elements (Customer, Services, Finances, Notes, Actions) <!-- id: fdr_p1_inventory -->
- [x] 3. Trace action behavior and backend API mappings (Status, Payments, Refunds, Reschedule, Cancellation) <!-- id: fdr_p1_actions -->
- [x] 4. Identify BARSPA business rules to preserve (ZATCA VAT 15%, Split Payments, Overtime, Tenant isolation) <!-- id: fdr_p1_bizrules -->
- [x] 5. Document UX gaps, mock implementations, and hidden features <!-- id: fdr_p1_gaps -->
- [x] 6. Formulate Phase 2 comparison checklist and technical deliverable report <!-- id: fdr_p1_deliverable -->

# BARSPA — Fresha Appointment Drawer: Phase 2 Gap Analysis & Alignment Specification (Completed)
- [x] 1. Workstream A: Define target compact two-zone appointment details drawer (480px-540px) <!-- id: fdr_p2_ws_a -->
- [x] 2. Workstream B: Define 3 decoupled experiences (Appointment Details, Sale Details, Client Profile) <!-- id: fdr_p2_ws_b -->
- [x] 3. Workstream C: Section-by-section audit matrix with 4-tier evidence classifications <!-- id: fdr_p2_ws_c -->
- [x] 4. Workstream D: Functional gaps disposition & action matrix (vouchers, reschedule, rebook, print/share) <!-- id: fdr_p2_ws_d -->
- [x] 5. Workstream E: Preserve BARSPA business invariants (ZATCA 15% VAT, split payment, cancellation scope) <!-- id: fdr_p2_ws_e -->
- [x] 6. Deliverable: Author comprehensive `fresha_drawer_phase2_gap_analysis.md` report <!-- id: fdr_p2_deliverable -->

# BARSPA — Fresha Appointment Drawer: Phase 3 Implementation & Verification
- [ ] 1. Preflight & Component Design Architecture <!-- id: fdr_p3_preflight -->
- [ ] 2. Create `AppointmentClientHeader.tsx` (Zone A: Customer Identity, Contact shortcuts, Allergy alert, View Profile) <!-- id: fdr_p3_zone_a -->
- [ ] 3. Create `AppointmentServiceCard.tsx` (Zone B: Stacked service cards, staff pill, timestamps, price, warnings) <!-- id: fdr_p3_service_card -->
- [ ] 4. Create `AppointmentServiceEditor.tsx` (Option A in-place service editing with authoritative availability & conflict checks) <!-- id: fdr_p3_service_editor -->
- [ ] 5. Create `AppointmentActionMenu.tsx` (Contextual transitions, Reschedule, Rebook, Cancel with scope dialog) <!-- id: fdr_p3_action_menu -->
- [ ] 6. Create `AppointmentCheckoutOverlay.tsx` (Option A focused checkout, split payments, ZATCA 15% VAT, remove GFT mock) <!-- id: fdr_p3_checkout_overlay -->
- [ ] 7. Assemble modular `AppointmentDetailsDrawer.tsx` (480px-540px, scrollable body, sticky footer, RTL/LTR) <!-- id: fdr_p3_drawer_assembly -->
- [ ] 8. Integrate into `AppointmentWorkspace.tsx` and wire View Sale, View Profile, Rebook, Reschedule & Checkout <!-- id: fdr_p3_workspace_integration -->
- [ ] 9. Automated Test Suite (Presentation, Actions, Checkout, Service Editing, RTL) <!-- id: fdr_p3_test_suite -->
- [ ] 10. Regression Testing, Typecheck & Production Build (`Tenant-v2`) <!-- id: fdr_p3_verification -->
- [ ] 11. Git Stage, Commit & Push to `main` <!-- id: fdr_p3_commit_push -->
- [ ] 12. Final Completion Report & Manual Deployment Stop Gate <!-- id: fdr_p3_final_report -->
