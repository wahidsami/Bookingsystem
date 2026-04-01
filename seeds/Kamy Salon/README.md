# Kamy Salon Seed Notes

This folder now contains production-oriented starter data for the `Kamy Salon` tenant:

- `employees.json`
- `services.json`
- `products.json`
- `hotDeals.json`
- `shifts.json`

## Notes

- Employee `workingHours` are intentionally not included because the live system now uses `StaffShift` records from the tenant `Schedules` section.
- `shifts.json` is organized by `employeeEmail` with weekly recurring shifts to make the team immediately bookable after employee creation.
- Product data is complete from a catalog perspective, but product creation in the live tenant dashboard still requires at least one image per product.
- Hot deals use `fixed_amount` instead of `fixed`, which matches the current backend contract.

## Category Normalization

The original source categories were normalized to the current tenant dashboard options:

- Services:
  - `Hair` -> `Hair Services`
  - `Skin Care` -> `Facial & Skin Care`
  - `Massage` -> `Massage & Body`
  - `Nails` -> `Nail Services`
  - `Package` -> `General`

- Products:
  - `Nails` -> `Tools & Accessories`
  - `Massage` -> `General`
