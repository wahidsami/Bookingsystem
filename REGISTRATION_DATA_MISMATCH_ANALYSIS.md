# Tenant Registration Data Mismatch Analysis

## Issue: ERR_CONNECTION_REFUSED

**Error**: `Failed to load resource: net::ERR_CONNECTION_REFUSED` for `/api/v1/auth/tenant/register`

**Status**: Backend is running on port 5000 (confirmed via netstat), but connection is being refused.

## Potential Causes

1. **Backend crashed or restarted** - The process might have stopped
2. **CORS issue** - Backend might be blocking the request
3. **Route not registered** - The route might not be properly set up
4. **Network/firewall issue** - Local firewall might be blocking

## Form Data vs Backend Expectations

### ✅ **Fields That Match**

| Form Field | Backend Expects | Status |
|------------|----------------|--------|
| `name_en` | `name_en` | ✅ Match |
| `name_ar` | `name_ar` | ✅ Match |
| `businessType` | `businessType` | ✅ Match |
| `phone` | `phone` | ✅ Match |
| `mobile` | `mobile` | ✅ Match |
| `email` | `email` | ✅ Match |
| `website` | `website` | ✅ Match |
| `password` | `password` | ✅ Match |
| `buildingNumber` | `buildingNumber` | ✅ Match |
| `district` | `district` | ✅ Match |
| `street` | `street` | ✅ Match |
| `city` | `city` | ✅ Match |
| `country` | `country` | ✅ Match |
| `googleMapLink` | `googleMapLink` | ✅ Match |
| `crNumber` | `crNumber` | ✅ Match |
| `taxNumber` | `taxNumber` | ✅ Match |
| `licenseNumber` | `licenseNumber` | ✅ Match |
| `contactPersonNameAr` | `contactPersonNameAr` | ✅ Match |
| `contactPersonNameEn` | `contactPersonNameEn` | ✅ Match |
| `contactPersonEmail` | `contactPersonEmail` | ✅ Match |
| `contactPersonMobile` | `contactPersonMobile` | ✅ Match |
| `contactPersonPosition` | `contactPersonPosition` | ✅ Match |
| `ownerNameAr` | `ownerNameAr` | ✅ Match |
| `ownerNameEn` | `ownerNameEn` | ✅ Match |
| `ownerPhone` | `ownerPhone` | ✅ Match |
| `ownerEmail` | `ownerEmail` | ✅ Match |
| `ownerNationalId` | `ownerNationalId` | ✅ Match |
| `selectedPackageId` | `selectedPackageId` | ✅ Match |
| `selectedBillingPeriod` | `selectedBillingPeriod` | ✅ Match |
| `preferredLanguage` | `preferredLanguage` | ✅ Match |

### ⚠️ **Fields That Need Conversion**

| Form Field | Form Value Type | Backend Expects | Conversion | Status |
|------------|----------------|-----------------|------------|--------|
| `providesHomeServices` | `boolean` | `boolean` | `value === 'true' \|\| value === true` | ✅ Fixed |
| `sellsProducts` | `boolean` | `boolean` | `value === 'true' \|\| value === true` | ✅ Fixed |
| `hasOwnPaymentGateway` | `boolean` | `boolean` | `value === 'true' \|\| value === true` | ✅ Fixed |
| `advertiseOnSocialMedia` | `boolean` | `boolean` | `value === 'true' \|\| value === true` | ✅ Fixed |
| `wantsRifahPromotion` | `boolean` | `boolean` | `value === 'true' \|\| value === true` | ✅ Fixed |
| `acceptedServiceAgreement` | `boolean` | `boolean` | `value === 'true' \|\| value === true` | ✅ Fixed |
| `staffCount` | `string` (can be empty) | `integer \| null` | `staffCount && staffCount !== '' && staffCount !== '0' ? parseInt(staffCount) : null` | ✅ Fixed |
| `serviceRanking` | `number` (0 initially) | `integer \| null` (min: 1, max: 5) | `serviceRanking && serviceRanking !== '' && serviceRanking !== '0' ? parseInt(serviceRanking) : null` | ✅ **FIXED** |

### 📁 **File Uploads**

| Form Field | Backend Expects | Status |
|------------|----------------|--------|
| `logo` | `req.files?.logo?.[0]` | ✅ Match |
| `crDocument` | `req.files?.crDocument?.[0]` | ✅ Match |
| `taxDocument` | `req.files?.taxDocument?.[0]` | ✅ Match |
| `licenseDocument` | `req.files?.licenseDocument?.[0]` | ✅ Match |

## Issues Found & Fixed

### ✅ **Issue 1: serviceRanking Validation**
**Problem**: Form sends `serviceRanking: 0` initially, which becomes `"0"` when converted to string. Backend parses it to `0`, which fails model validation (min: 1, max: 5).

**Fix Applied**: Updated backend to check for empty string and `"0"` before parsing:
```javascript
serviceRanking: serviceRanking && serviceRanking !== '' && serviceRanking !== '0' ? parseInt(serviceRanking) : null
```

### ✅ **Issue 2: staffCount Empty String**
**Problem**: Form sends `staffCount: ''` initially, which gets parsed incorrectly.

**Fix Applied**: Updated backend to check for empty string and `"0"`:
```javascript
staffCount: staffCount && staffCount !== '' && staffCount !== '0' ? parseInt(staffCount) : null
```

## Connection Issue

The `ERR_CONNECTION_REFUSED` error suggests the backend might have crashed or the route is not properly registered. 

### Steps to Debug:

1. **Check if backend is still running:**
   ```bash
   netstat -ano | findstr :5000
   ```

2. **Check backend logs** for any errors when the registration request is made

3. **Verify route registration:**
   - Route should be: `/api/v1/auth/tenant/register`
   - Registered in: `server/src/routes/tenantAuthRoutes.js`
   - Mounted in: `server/src/index.js` as `app.use('/api/v1/auth/tenant', tenantAuthRoutes)`

4. **Test the endpoint directly:**
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/tenant/register -H "Content-Type: application/json" -d "{\"name_en\":\"Test\",\"name_ar\":\"اختبار\",\"email\":\"test@test.com\",\"password\":\"test123456\",\"businessType\":\"salon\"}"
   ```

## Recommendations

1. ✅ **Fixed**: `serviceRanking` and `staffCount` parsing issues
2. ⚠️ **Check**: Backend server logs for connection errors
3. ⚠️ **Verify**: Route is properly registered and middleware is working
4. ⚠️ **Test**: Registration endpoint with a simple curl request

## Next Steps

1. Restart the backend server to apply the fixes
2. Check backend logs when attempting registration
3. Verify the route is accessible
4. Test registration with the fixed code

