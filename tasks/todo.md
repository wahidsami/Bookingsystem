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
- [ ] 4. Git Commit & Push <!-- id: git_commit_push -->
  - [ ] 4.1 Commit with message `feat(refah): complete BARSPA admin and PDF rebrand`. <!-- id: git_commit -->
  - [ ] 4.2 Push to `origin/main`. <!-- id: git_push -->
  - [ ] 4.3 Output final handoff report matching exact template. <!-- id: final_handoff -->
