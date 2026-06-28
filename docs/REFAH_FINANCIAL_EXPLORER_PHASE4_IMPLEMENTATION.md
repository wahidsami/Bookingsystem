# REFAH Financial Explorer Initiative - Phase 4

## Customer Identity & Data Quality

### Objective

Improve how customer identity is displayed inside analytics without changing grouping, ownership, or totals.

### What Changed

1. Customer sales rows now carry richer display-only identity fields.
2. Reports preview and export views now show a customer badge.
3. PDF exports now include customer type and identity details.
4. A reusable `CustomerIdentityCell` was added for the report UI.

### Identity Resolution Matrix

| Priority | Identity Source | Display Result | Badge |
| --- | --- | --- | --- |
| 1 | Full customer profile (`firstName` + `lastName`) | Full name | Registered Customer |
| 2 | Customer display name (`displayName` / `name` / `fullName`) | Display name | Registered Customer |
| 3 | Email | Email or walk-in label with identity line | Walk-In Customer |
| 4 | Mobile number | Phone number or walk-in label with identity line | Walk-In Customer |
| 5 | Missing / incomplete profile | Guest placeholder | Guest Customer |

### Badge System

1. `Registered Customer`
   - Used when a full profile or explicit display name exists.
2. `Walk-In Customer`
   - Used when only partial identity is available, such as email or phone.
3. `Guest Customer`
   - Used when identity is missing or too incomplete to resolve further.

### Reused Logic

1. Existing customer sales grouping keys remain unchanged.
2. Existing revenue totals remain unchanged.
3. Existing customer analytics remain unchanged.
4. Existing report structures remain unchanged.

### Screens Updated

1. Reports preview workspace
2. PDF report export
3. Customer sales export tables

### Regression Verification

1. Customer sales totals stay unchanged.
2. Customer analytics totals stay unchanged.
3. Revenue totals stay unchanged.
4. Reports continue to render normally.
5. Exports continue to work.

