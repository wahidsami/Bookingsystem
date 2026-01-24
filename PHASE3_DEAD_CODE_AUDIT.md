# Phase 3: Dead Code & Legacy Removal Audit

**Last Updated:** Phase 3 Start
**Priority:** High (Remove before deployment)
**Estimated Work:** 3 days

## 1. Dead Routes Identified

### 🔴 CRITICAL: Legacy `/auth` Route
- **File:** `server/src/routes/authRoutes.js`
- **Status:** DEAD CODE
- **Reason:** Replaced by `/api/v1/auth/tenant` and `/api/v1/auth/user`
- **Reference in Index:** Line 109: `app.use('/auth', authRoutes);`
- **Impact:** No endpoints use this legacy route
- **Action:** REMOVE ENTIRE FILE

### 🟡 Cleanup Routes (Temporary)
- **File:** `server/src/routes/cleanupRoutes.js`
- **Status:** ONE-TIME USE (Should be removed)
- **Endpoints:**
  - `/api/v1/cleanup/cleanup-rename-tenant` - ONE-TIME operation
  - `/api/v1/cleanup/assign-categories` - Data migration
  - `/api/v1/cleanup/fix-tenant-ids` - Data fix
- **Reference in Index:** Line 141: `app.use('/api/v1/cleanup', cleanupRoutes);`
- **Impact:** Database maintenance operations (no longer needed after initial setup)
- **Action:** Remove or move to separate admin utility

## 2. Dead Controllers Identified

### Potentially Unused Controllers
- `authController.js` - Used by dead authRoutes
- Check `cleanupController.js` - Not found (logic embedded in routes)

**Status:** Pending detailed import scanning

## 3. Dead Endpoints Identified

### Public Routes (`server/src/routes/publicRoutes.js`)
- Needs review of all endpoints for actual usage
- Some endpoints may only be used in old frontend versions

## 4. Test/Debug Endpoints

### 🟢 KEEP (For Development)
- `GET /` (Health check) - Line 137
- `GET /test-uploads` (Upload verification) - Line 143

### 🔴 REMOVE (Debug only)
- Any endpoints with `debug` in name
- Any endpoints with `test` prefix (except /test-uploads)

## 5. Dead Imports in Controllers

### Scan Results Needed
Common patterns to look for:
- `require()` statements not used in code
- Imported functions never called
- Legacy imports from removed packages

**Scan Command:** ESLint no-unused-vars rule

## 6. Dead Middleware

### Potentially Unused Middleware
- Check all middleware files for integration status
- Verify all middleware is applied to at least one route

**Files to audit:**
- `server/src/middleware/*.js`
- Currently: ~10+ middleware files

## 7. Legacy Database Models

### Potentially Deprecated Models
- Models synced but no longer used in routes/controllers
- Need to audit each model's usage

**Candidates for review:**
- `StaffSchedule` (Replaced by StaffShift/StaffBreak/StaffTimeOff)
- Legacy tables with `_backup` suffix

## 8. Dead Utility Functions

### Files to Audit
- `server/src/utils/*.js`
- `server/src/services/*.js`

Look for:
- Exported functions never called
- Utility functions with no imports
- Legacy calculation functions

## Removal Plan

### Phase 3.1: Safe Removals (Day 1)
1. ✅ Remove dead authRoutes.js file
2. ✅ Remove authRoutes import from index.js
3. ✅ Remove authController.js
4. ✅ Create DEAD_CODE_REMOVED.txt inventory

### Phase 3.2: Cleanup Routes Decision (Day 1)
- **Option A:** Completely remove cleanupRoutes.js (recommended)
- **Option B:** Move to `/api/v1/admin/maintenance/` endpoint (requires admin auth)
- **Decision:** Option A - One-time operations completed

### Phase 3.3: Test/Debug Code Cleanup (Day 2)
- Remove temporary console.log statements from production code
- Remove test endpoints not in /test-uploads
- Remove debug middleware

### Phase 3.4: Unused Import Cleanup (Day 2-3)
- Run ESLint scan
- Remove unused imports from all controllers
- Remove unused imports from all services

## ESLint Configuration for Dead Code Detection

```json
{
  "rules": {
    "no-unused-vars": ["error", {
      "args": "after-used",
      "argsIgnorePattern": "^_"
    }],
    "no-unreachable": "error",
    "no-unused-expressions": "error",
    "no-constant-condition": "error",
    "no-import-assign": "error"
  }
}
```

## Execution Status

| Item | Status | File | Notes |
|------|--------|------|-------|
| Dead routes audit | ✅ DONE | - | authRoutes.js identified as dead |
| Dead controllers audit | 🟡 IN PROGRESS | - | Need to scan all imports |
| Dead endpoints audit | 🟡 IN PROGRESS | - | Review public/admin endpoints |
| Dead middleware audit | 🟢 READY | - | Listed ~10 middleware files |
| Legacy models audit | 🟢 READY | - | Candidates identified |
| Dead utils audit | 🟢 READY | - | Need to scan exports |

## Files to Remove (Confirmed)

```
server/src/routes/authRoutes.js          # Dead legacy route
server/src/controllers/authController.js # Only used by dead route
```

## Files to Review (Not Confirmed Dead)

```
server/src/routes/cleanupRoutes.js       # One-time use - should remove
```

## Result Inventory

**Total Dead Code Lines (Estimated):** ~400 lines
**Total Files to Remove:** 2-3 files
**Total Imports to Clean:** ~50+ unused imports

---

**Next Step:** Execute removal plan starting with safe removals (authRoutes, authController)
