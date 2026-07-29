# Canonical Financial Sources Q&A

## Canonical Ownership Summary

| Concept | Canonical Controller | Canonical Endpoint | Notes |
| --- | --- | --- | --- |
| Revenue | `server/src/controllers/tenantFinancialController.js` | `GET /api/v1/tenant/financial/overview` and `GET /api/v1/tenant/financial/ledger` | Frontend must render backend totals only. |
| Taxes / VAT | `server/src/controllers/tenantFinancialController.js` | `GET /api/v1/tenant/financial/overview` and `GET /api/v1/tenant/financial/ledger` | Use backend tax values; do not recompute in Tenant-v2. |
| Discounts | `server/src/controllers/tenantFinancialController.js` | `GET /api/v1/tenant/financial/overview` | Discount totals must come from backend aggregation. |
| Payment Methods | `server/src/controllers/tenantReportsController.js` | `GET /api/v1/tenant/reports/payment-methods` | Grouping is handled canonically in backend helpers. |
| Ledger Entries | `server/src/controllers/tenantFinancialController.js` | `GET /api/v1/tenant/financial/ledger` | This is the canonical ledger surface for reports. |

## Q1. What is the canonical source for revenue?
**A.** The canonical source for revenue is the backend financial aggregation, primarily `server/src/controllers/tenantFinancialController.js` through `getFinancialOverview()` and `getFinancialLedger()`. These endpoints aggregate live finance data from the backend accounting model, not from frontend calculations.

## Q2. What is the canonical source for taxes?
**A.** The canonical source for taxes is the backend financial aggregation in `server/src/controllers/tenantFinancialController.js`, mainly `getFinancialOverview()` and `getFinancialLedger()`, which expose tax-aware values such as `taxAmount` / VAT-related fields from the persisted financial records.

## Q3. What is the canonical source for discounts?
**A.** The canonical source for discounts is the backend financial overview returned by `server/src/controllers/tenantFinancialController.js#getFinancialOverview()`. The frontend reads the canonical discount totals from the backend response instead of recalculating them locally.

## Q4. What is the canonical source for payment methods?
**A.** The canonical source for payment methods is `server/src/controllers/tenantReportsController.js#getPaymentMethodsReport()`, which builds its output from the canonical payment transaction dataset via `buildPaymentMethodsReport()`.

## Q5. What is the canonical source for ledger entries?
**A.** The canonical source for ledger entries is `server/src/controllers/tenantFinancialController.js#getFinancialLedger()`. That endpoint is the backend financial ledger surface used by the reports and finance workspace.

## Q6. Which controller owns revenue?
**A.** `server/src/controllers/tenantFinancialController.js`

## Q7. Which endpoint exposes revenue?
**A.** `GET /api/v1/tenant/financial/overview` and `GET /api/v1/tenant/financial/ledger`

## Q8. Which reports consume revenue?
**A.** At minimum, these Tenant-v2 report surfaces consume revenue data:
- Sales Overview
- Sales List
- Sales Log Details
- Finance Overview / Finance Summary
- Cash Flow Summary
- Payment Transactions
- Reports Workspace overview and sales sections

## Q9. Which reports should never calculate revenue locally?
**A.** Any report that shows revenue should not calculate it in the frontend, including:
- Sales Overview
- Sales List
- Sales Log Details
- Finance Overview / Finance Summary
- Cash Flow Summary
- Payment Transactions
- Discount Summary when it derives revenue totals
- Tax Summary when it derives taxable amounts from revenue

## Q10. Which controller owns taxes?
**A.** `server/src/controllers/tenantFinancialController.js`

## Q11. Which endpoint exposes taxes?
**A.** `GET /api/v1/tenant/financial/overview` and `GET /api/v1/tenant/financial/ledger`

## Q12. Which reports consume taxes?
**A.** These report surfaces consume tax data:
- Sales Overview
- Sales List
- Sales Log Details
- Tax Summary
- Finance Overview / Finance Summary
- Cash Flow Summary
- Payment Transactions
- Reports Workspace sales and financial sections

## Q13. Which reports should never calculate taxes locally?
**A.** Any report that shows VAT/tax values should not calculate them in the frontend, including:
- Tax Summary
- Sales Overview
- Sales List
- Sales Log Details
- Finance Overview / Finance Summary
- Cash Flow Summary
- Payment Transactions
- Reports Workspace financial sections

## Q14. Which controller owns discounts?
**A.** `server/src/controllers/tenantFinancialController.js`

## Q15. Which endpoint exposes discounts?
**A.** `GET /api/v1/tenant/financial/overview`

## Q16. Which reports consume discounts?
**A.** These report surfaces consume discount data:
- Discount Summary
- Sales Overview
- Sales List
- Sales Log Details
- Finance Overview / Finance Summary
- Reports Workspace sales and financial sections

## Q17. Which reports should never calculate discounts locally?
**A.** Any report that shows discounts should not calculate them in the frontend, including:
- Discount Summary
- Sales Overview
- Sales List
- Sales Log Details
- Finance Overview / Finance Summary
- Reports Workspace sales and financial sections

## Q18. Which controller owns payment methods?
**A.** `server/src/controllers/tenantReportsController.js`

## Q19. Which endpoint exposes payment methods?
**A.** `GET /api/v1/tenant/reports/payment-methods`

## Q20. Which reports consume payment methods?
**A.** These report surfaces consume payment method data:
- Payment Methods
- Finance Overview / Finance Summary
- Cash Flow Summary
- Sales Overview
- Sales List
- Sales Log Details
- Reports Workspace financial and sales sections

## Q21. Which reports should never calculate payment methods locally?
**A.** Payment method totals or breakdowns should never be invented in the frontend for:
- Payment Methods
- Finance Overview / Finance Summary
- Cash Flow Summary
- Sales Overview
- Sales List
- Sales Log Details
- Reports Workspace financial and sales sections

## Q22. Which controller owns ledger entries?
**A.** `server/src/controllers/tenantFinancialController.js`

## Q23. Which endpoint exposes ledger entries?
**A.** `GET /api/v1/tenant/financial/ledger`

## Q24. Which reports consume ledger entries?
**A.** Ledger entries are consumed by:
- Sales List
- Sales Log Details
- Payment Transactions
- Cash Flow Summary
- Finance Overview / Finance Summary
- Tax Summary
- Sales Overview
- Reports Workspace financial and sales tabs

## Q25. Which reports should never calculate ledger entries locally?
**A.** Any report that depends on the ledger should not reconstruct it in the frontend, including:
- Sales List
- Sales Log Details
- Payment Transactions
- Cash Flow Summary
- Finance Overview / Finance Summary
- Tax Summary
- Sales Overview
- Reports Workspace financial and sales tabs
