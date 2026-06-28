# Refah Report Export Pipeline Runbook

Last updated: 2026-06-28

This note captures the current report export stack after the PDF and Excel export hardening pass.

## Current Stack

- PDF generation: `pdfmake` on the server
- Excel generation: `exceljs` in the tenant dashboard
- CSV generation: client-side CSV helper
- Report preview data source: shared report data builder in the tenant API

## Main Flow

1. Tenant opens `Reports`
2. Tenant clicks `Generate report`
3. Tenant fills sections and date range
4. Tenant clicks `Preview`
5. Preview screen can export:
   - PDF
   - Excel (`.xlsx`)
   - CSV
   - Print

## What Was Hardened

- PDF export now uses a server-side `pdfmake` document pipeline.
- Excel export now produces a real `.xlsx` workbook instead of SpreadsheetML HTML.
- Export failures are surfaced in the report pages instead of failing silently.
- PDF generator smoke tests are available on the server.

## Verification Commands

Run the PDF smoke test on the server project:

```bash
cd server
npm run test:report-export
```

## Deploy Order

1. Redeploy `refah_api`
2. Redeploy tenant dashboard
3. Re-test:
   - report preview
   - PDF download
   - Excel download

## If PDF Still Fails

1. Run the smoke test above.
2. Check the API logs for `/tenant/reports/pdf`.
3. Confirm the tenant data payload is valid for the selected section(s).
4. Confirm the VPS is running the latest `main`.

