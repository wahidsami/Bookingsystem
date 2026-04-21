# Tenant Employee Editor Redesign Plan

## Goal
Redesign the Teams add/edit employee flow into a cleaner, section-based editor without changing the underlying feature set or breaking existing staff/dashboard access behavior.

## Current State
- `Employees` section already supports add/edit forms.
- Basic fields already exist: name, email, phone, nationality, gender, job title.
- Biography fields already exist partially: bio, experience, skills, photo.
- Finance fields already exist partially: salary and commission rate.
- Access logic already exists:
  - service providers: staff app access + staff permissions
  - non-service-providers: dashboard permissions
- Schedule persistence already exists in dedicated tables:
  - `staff_shifts`
  - `staff_breaks`
  - `staff_time_off`
  - `staff_schedule_overrides`

## Target Layout
- Split the page into two halves.
- Left half: vertical list of sections, acting like tabs.
- Right half: active section content.
- Save and Cancel actions stay at the top.
- Add a completion meter for each section based on required fields.
- Arabic layout mirrors the same structure:
  - section list on the right
  - content on the left
  - labels and alignment mirrored

## Sections

### 1. Basic Information
Required:
- full name
- email
- phone
- nationality
- gender
- job title

### 2. Biography
Fields:
- biography
- experience
- skills
- spoken languages multi-select
- employee photo upload

### 3. Finance
Fields:
- salary amount
- VAT-aware summary
- service commission toggle
- products commission toggle

Note:
- VAT should use existing tenant tax settings.
- No new billing logic should be introduced here.

### 4. Schedule
Fields:
- weekly schedule rows from Saturday to Friday
- day enable checkbox
- from/to time fields
- add shift / sub-shift
- delete shift
- recurring vs date-ranged schedule

Note:
- Reuse the existing schedule tables and APIs.
- Do not duplicate schedule persistence.

### 5. Access
Behavior:
- service provider:
  - show app access
  - show staff permissions
- non-service-provider:
  - show dashboard permissions

## Database Changes Likely Needed
Likely required:
- `spokenLanguages` as `JSONB`
- `serviceCommissionEnabled` as `BOOLEAN`
- `productCommissionEnabled` as `BOOLEAN`

Likely not required:
- schedule tables
- completion meter
- access logic

## Implementation Order
1. Extract shared section components for the add/edit employee forms.
2. Build the vertical section navigator and top action bar.
3. Move existing fields into the new section structure.
4. Add the new biography and finance fields.
5. Wire the schedule section to existing schedule endpoints/models.
6. Keep the access section logic exactly aligned with employee job title.
7. Add only the minimum database migrations needed for the new persisted fields.
8. Verify English and Arabic rendering separately.

## Safety Notes
- Keep the existing employee save/update flow intact where possible.
- Avoid creating a new schedule system.
- Avoid changing the current access model unless necessary.
- Keep the new layout mostly presentational until each section is confirmed stable.

## Reference Files
- `tenant/src/app/[locale]/dashboard/employees/new/page.tsx`
- `tenant/src/app/[locale]/dashboard/employees/[id]/page.tsx`
- `tenant/src/lib/dashboardAccess.ts`
- `tenant/src/lib/employeePositions.ts`
- `server/src/controllers/tenantEmployeeController.js`
- `server/src/models/Staff.js`
- `server/src/models/StaffShift.js`
- `server/src/models/StaffBreak.js`
- `server/src/models/StaffTimeOff.js`
- `server/src/models/StaffScheduleOverride.js`
