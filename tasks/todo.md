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



