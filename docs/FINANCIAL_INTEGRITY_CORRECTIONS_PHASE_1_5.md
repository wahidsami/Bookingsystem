# REFAH V2 Financial Integrity Corrections - Phase 1.5

## Summary

This phase restores canonical financial integrity across the backend accounting layer and customer/reporting surfaces.

### What changed

- Added canonical `discountAmount` persistence to customer invoices.
- Recomputed invoice discounts from persisted invoice data instead of frontend assumptions.
- Replaced customer spend calculations with payment-transaction-driven accounting.
- Prevented customer sales report visit inflation from multiple payment rows per booking/session.
- Added canonical revenue breakdown fields for financial overview and BI summary consumption.

### Files modified

- `server/migrations/20260729150000-add-discount-amount-to-customer-invoices.js`
- `server/src/models/CustomerInvoice.js`
- `server/src/services/customerInvoiceService.js`
- `server/src/controllers/tenantFinancialController.js`
- `server/src/controllers/tenantCustomerController.js`
- `server/src/controllers/tenantReportsController.js`
- `server/src/services/tenantBiSalesOverviewService.js`

### Validation

- `node --check` passed for all modified server files.
- Backend test suite passed:
  - `src/services/tenantReportPdfService.test.js`
  - `src/controllers/__tests__/paymentController.contract.test.js`

### Notes

- Root `package.json` does not define a lint script.
- The server package also does not define a build script.
- Validation was therefore performed with syntax checks and the server Jest suite.

