# Schedule Endpoint 500 Error - Fix Applied

## Issue
When navigating to the schedules section in the tenant dashboard, the frontend was receiving a 500 Internal Server Error when trying to fetch employee shifts.

**Error:** `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`

## Root Cause
The most likely cause was that the `staff_shifts` table (and related scheduling tables) may not have been created in the database, or the model sync was failing silently.

## Fixes Applied

### 1. **Server Startup - Table Creation** ✅
**File:** `server/src/index.js`

Changed the sync strategy for scheduling tables from `force: false` to `alter: true`:

```javascript
// Before
await db.StaffShift.sync({ force: false });
await db.StaffBreak.sync({ force: false });
await db.StaffTimeOff.sync({ force: false });
await db.StaffScheduleOverride.sync({ force: false });

// After
await db.StaffShift.sync({ alter: true });
await db.StaffBreak.sync({ alter: true });
await db.StaffTimeOff.sync({ alter: true });
await db.StaffScheduleOverride.sync({ alter: true });
```

**Why:** `alter: true` ensures tables are created if they don't exist, and updates the schema if the model definition has changed.

### 2. **Enhanced Error Handling** ✅
**File:** `server/src/controllers/tenantScheduleController.js`

Improved error logging for all schedule endpoints:
- `getShifts()` - Get employee shifts
- `getBreaks()` - Get employee breaks
- `getTimeOff()` - Get employee time-off
- `getOverrides()` - Get schedule overrides

**Changes:**
- Added model existence checks before querying
- Enhanced error logging with stack traces
- Added detailed error information in development mode
- Better error messages for debugging

### 3. **Error Response Format** ✅
All endpoints now return detailed error information in development mode:

```json
{
  "success": false,
  "message": "Failed to fetch shifts",
  "error": "Error message here",
  "details": "Full stack trace (development only)"
}
```

## Next Steps

### 1. **Restart the Backend Server**
The server needs to be restarted for the changes to take effect:

```powershell
# Stop the current server (Ctrl+C in the server window)
# Then restart it
cd server
npm run dev
```

Or use the startup script:
```powershell
.\start-all-systems.ps1
```

### 2. **Verify Table Creation**
After restarting, check the server console logs. You should see:
- `Database connection established successfully.`
- `✅ Database synced successfully.`

If you see any errors about table creation, they will now be visible in the console.

### 3. **Test the Endpoint**
1. Navigate to the tenant dashboard
2. Go to the Schedules section
3. Select an employee
4. Check the browser console and network tab

### 4. **Check Backend Logs**
If the error persists, check the backend console for detailed error messages. The enhanced error handling will now show:
- Full error stack trace
- Error name and message
- Original database error (if any)

## Expected Behavior After Fix

✅ **Success Case:**
- Endpoint returns: `{ success: true, shifts: [] }` (empty array if no shifts exist)
- No errors in console
- Frontend displays the schedule management interface

❌ **If Error Persists:**
- Check backend console for detailed error message
- Verify database connection
- Check if tables were created (see troubleshooting below)

## Troubleshooting

### If tables still don't exist:

1. **Check Database Connection:**
   ```sql
   -- Connect to PostgreSQL
   -- Check if tables exist
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('staff_shifts', 'staff_breaks', 'staff_time_off', 'staff_schedule_overrides');
   ```

2. **Manually Create Tables:**
   If tables don't exist, you can run the migration:
   ```powershell
   cd server
   node run-migration.js
   ```

3. **Check Model Loading:**
   Verify models are loaded correctly:
   ```javascript
   const db = require('./src/models');
   console.log('StaffShift:', db.StaffShift ? 'Loaded' : 'NOT LOADED');
   ```

### Common Issues:

1. **Database Connection Error:**
   - Verify Docker containers are running: `docker ps`
   - Check database credentials in `server/src/config/database.js`

2. **Model Not Found:**
   - Ensure `StaffShift.js` exists in `server/src/models/`
   - Check `server/src/models/index.js` loads all models

3. **Permission Errors:**
   - Verify database user has CREATE TABLE permissions
   - Check PostgreSQL logs for permission errors

## Files Modified

1. `server/src/index.js` - Changed sync strategy for scheduling tables
2. `server/src/controllers/tenantScheduleController.js` - Enhanced error handling

## Testing Checklist

- [ ] Backend server restarted successfully
- [ ] No errors in backend console on startup
- [ ] Can navigate to schedules section
- [ ] Can select an employee
- [ ] Shifts tab loads without errors
- [ ] Breaks tab loads without errors
- [ ] Time-off tab loads without errors
- [ ] Overrides tab loads without errors
- [ ] Can create a new shift
- [ ] Can edit an existing shift
- [ ] Can delete a shift

---

**Status:** ✅ Fixes Applied - Ready for Testing

**Next Action:** Restart the backend server and test the schedules section.


