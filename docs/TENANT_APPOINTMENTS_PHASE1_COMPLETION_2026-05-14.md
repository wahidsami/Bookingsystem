# Phase 1 Completion Report - Payment Truth Normalization & Wiring

Date: 2026-05-14
Status: Completed

## Objective
Make payment status and outstanding amount consistent between:
- Customer Profile -> Appointments tab
- Customer Profile -> Transactions tab

## Changes Implemented

### 1) Backend: canonical appointment payment normalization
File: `server/src/controllers/tenantCustomerController.js`

Added helper:
- `normalizeAppointmentPaymentState(appointment, evidenceSource)`

Outputs:
- `normalizedPaymentStatus`
- `paidAmount`
- `outstandingAmount`
- `paymentEvidenceSource`

Rules:
- If status is `fully_paid/paid` but outstanding remains -> normalize to `deposit_paid`.
- If status is `deposit_paid` and outstanding + remainder are zero -> normalize to `fully_paid`.
- Uses numeric-safe calculations from price/totalPaid/deposit/remainder with fallback to existing outstanding logic.

### 2) Backend: customer profile appointment rows now include normalized fields
File: `server/src/controllers/tenantCustomerController.js`

Updated payloads in `getCustomer`:
- `allAppointments[]`
- `recentAppointments[]`

Now each appointment contains canonical fields:
- `normalizedPaymentStatus`
- `paidAmount`
- `outstandingAmount`
- `paymentEvidenceSource`

### 3) Backend: transaction rows carry normalized appointment payment context
File: `server/src/controllers/tenantCustomerController.js`

Updated `mapCustomerTransactionRecord(...)` to include:
- `normalizedPaymentStatus`
- `appointmentOutstandingAmount`
- `appointmentPaidAmount`
- `paymentEvidenceSource`

This allows UI reconciliation without guessing from mixed raw fields.

### 4) Backend: unified history endpoint enriched
File: `server/src/controllers/tenantCustomerController.js`

`getCustomerHistory` appointment entries now include:
- `normalizedPaymentStatus`
- `paidAmount`
- `outstandingAmount`
- `paymentEvidenceSource`

### 5) Frontend drawer now prefers backend canonical status
File: `tenant/src/components/AppointmentDetailsDrawer.tsx`

Updated types to accept normalized fields.

Updated resolver:
- `resolveEffectivePaymentStatus(...)` now first uses `normalizedPaymentStatus`.
- Falls back to previous client-side derivation only if normalized field is missing.

Updated pending snapshot logic:
- Pending-appointments detection now uses normalized status instead of raw `paymentStatus`.

## Safety Notes
- No destructive schema change.
- Backward compatible: frontend fallback logic preserved.
- Existing endpoints unchanged in route shape; only enriched payload fields added.

## Expected Result
For the same appointment, drawer tabs now align better because both tabs can rely on canonical normalized payment semantics rather than divergent raw fields.

## Recommended Validation
1. Open appointment -> customer profile -> appointments tab; note payment badge.
2. Switch to transactions tab; confirm normalized status context and outstanding math align.
3. Test cases:
- `pending`
- `deposit_paid`
- `fully_paid/paid`
- `refunded`
- `partially_refunded`

## Limitations
- This phase does not yet add new reconciliation DB jobs; it normalizes and aligns API output.
- Full resync/migration for legacy inconsistent records can be done in next hardening pass if needed.
