# REFAH Financial Explorer Freeze

Freeze date: 2026-06-28

This document freezes the Finance and Reports explorer module after the Phase 5 final audit passed.

## Frozen Scope

Frozen areas:

1. Finance workspace
2. Reports workspace
3. Report preview workspace
4. Ledger workspace
5. Customer identity display in analytics
6. CSV / Excel / PDF export metadata
7. Drill-down explorer drawers

## Locked Principles

1. No revenue calculation changes.
2. No accounting calculation changes.
3. No commission logic changes.
4. No customer ownership changes.
5. No grouping-key changes for customer sales.
6. No export-contract regressions.
7. No API contract regressions.

## Baseline Commit

1. `0b5e9d4` - customer identity quality improvements
2. `aae8225` - financial ledger workspace

## What Is Considered Stable

1. Long tables use the reusable analytics table system.
2. Long tables expose pagination, search, sorting, row counts, and sticky headers.
3. Summary tables clearly indicate when they are top-N datasets.
4. Exports include metadata rows and consistent labeling.
5. Customer sales identity badges and display lines are stable.
6. Ledger views reuse existing datasets and calculations.

## Allowed Future Changes

Only the following are allowed without reopening the freeze:

1. Critical bug fixes.
2. Security fixes.
3. Production data safety fixes.
4. UI copy fixes that do not affect logic or exports.

Any new exploration features, new ledgers, new analytics engines, or changes to grouping/calculation rules must reopen the freeze and be reviewed separately.

## Verification Status

1. Server syntax checks passed.
2. Tenant production build passed.
3. Finance and Reports routes compile successfully.
4. Ledger workspace compiles successfully.

## Hand-off Note

If you need to extend the module later, start from this frozen baseline and avoid changing the underlying calculation or grouping contracts.

