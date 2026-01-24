# Schema Verification: Frontend → Backend → Database

## Frontend Form Fields (tenant/src/app/[locale]/register/page.tsx)

### Step 1: Entity Details
- ✅ `name_en` → Backend: `name_en` → DB: `name_en` ✅
- ✅ `name_ar` → Backend: `name_ar` → DB: `name_ar` ✅
- ✅ `businessType` → Backend: `businessType` → DB: `businessType` ✅
- ✅ `phone` → Backend: `phone` → DB: `phone` ✅
- ✅ `mobile` → Backend: `mobile` → DB: `mobile` ✅
- ✅ `email` → Backend: `email` → DB: `email` ✅
- ✅ `website` → Backend: `website` → DB: `website` ✅
- ✅ `password` → Backend: `password` → DB: `password` ✅
- ✅ `buildingNumber` → Backend: `buildingNumber` → DB: `buildingNumber` ✅
- ✅ `district` → Backend: `district` → DB: `district` ✅
- ✅ `street` → Backend: `street` → DB: `street` ✅
- ✅ `city` → Backend: `city` → DB: `city` ✅
- ✅ `country` → Backend: `country` → DB: `country` ✅
- ✅ `googleMapLink` → Backend: `googleMapLink` → DB: `googleMapLink` ✅
- ✅ `logo` (file) → Backend: `logo` → DB: `logo` ✅

### Step 2: Official Documentation
- ✅ `crNumber` → Backend: `crNumber` → DB: `crNumber` ✅
- ✅ `crDocument` (file) → Backend: `crDocument` → DB: `crDocument` ✅
- ✅ `taxNumber` → Backend: `taxNumber` → DB: `taxNumber` ✅
- ✅ `taxDocument` (file) → Backend: `taxDocument` → DB: `taxDocument` ✅
- ✅ `licenseNumber` → Backend: `licenseNumber` → DB: `licenseNumber` ✅
- ✅ `licenseDocument` (file) → Backend: `licenseDocument` → DB: `licenseDocument` ✅

### Step 3: Contact Person
- ✅ `contactPersonNameAr` → Backend: `contactPersonNameAr` → DB: `contactPersonNameAr` ✅
- ✅ `contactPersonNameEn` → Backend: `contactPersonNameEn` → DB: `contactPersonNameEn` ✅
- ✅ `contactPersonEmail` → Backend: `contactPersonEmail` → DB: `contactPersonEmail` ✅
- ✅ `contactPersonMobile` → Backend: `contactPersonMobile` → DB: `contactPersonMobile` ✅
- ✅ `contactPersonPosition` → Backend: `contactPersonPosition` → DB: `contactPersonPosition` ✅

### Step 4: Owner Details
- ✅ `ownerNameAr` → Backend: `ownerNameAr` → DB: `ownerNameAr` ✅
- ✅ `ownerNameEn` → Backend: `ownerNameEn` → DB: `ownerNameEn` ✅
- ✅ `ownerPhone` → Backend: `ownerPhone` → DB: `ownerPhone` ✅
- ✅ `ownerEmail` → Backend: `ownerEmail` → DB: `ownerEmail` ✅
- ✅ `ownerNationalId` → Backend: `ownerNationalId` → DB: `ownerNationalId` ✅

### Step 5: Business Details
- ✅ `providesHomeServices` → Backend: `providesHomeServices` → DB: `providesHomeServices` ✅
- ✅ `staffCount` → Backend: `staffCount` → DB: `staffCount` ✅
- ✅ `mainService` → Backend: `mainService` → DB: `mainService` ✅
- ✅ `sellsProducts` → Backend: `sellsProducts` → DB: `sellsProducts` ✅
- ✅ `hasOwnPaymentGateway` → Backend: `hasOwnPaymentGateway` → DB: `hasOwnPaymentGateway` ✅
- ✅ `serviceRanking` → Backend: `serviceRanking` → DB: `serviceRanking` ✅
- ✅ `advertiseOnSocialMedia` → Backend: `advertiseOnSocialMedia` → DB: `advertiseOnSocialMedia` ✅
- ✅ `wantsRifahPromotion` → Backend: `wantsRifahPromotion` → DB: `wantsRifahPromotion` ✅

### Step 6: Subscription Package
- ✅ `selectedPackageId` → Backend: `selectedPackageId` → DB: (stored in TenantSubscription) ✅
- ✅ `selectedBillingPeriod` → Backend: `selectedBillingPeriod` → DB: (stored in TenantSubscription) ✅

### Step 7: Service Agreement
- ✅ `acceptedServiceAgreement` → Backend: `acceptedServiceAgreement` → DB: (not stored, just validated) ✅
- ✅ `preferredLanguage` → Backend: `preferredLanguage` → DB: `settings.language` ✅

## ✅ ALL FIELDS MATCH!

## Potential Issues:

1. **Email Uniqueness**: The error "A business with this email already exists" is coming from line 168-174 of `tenantRegistrationController.js`. This is a VALIDATION error, not a schema mismatch.

2. **Boolean Conversion**: Frontend sends booleans as strings in FormData. Backend correctly converts them (lines 249-256).

3. **Number Conversion**: Frontend sends numbers as strings. Backend correctly converts them (lines 250, 254).

## Conclusion:
**ALL SCHEMA FIELDS MATCH PERFECTLY!** ✅

The 400 error is a **business logic validation** (email already exists), not a schema mismatch. The user should try with a different email address.

