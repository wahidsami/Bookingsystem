# Tenant Registration Form Analysis

## Current State

### Frontend Form (tenant/src/app/[locale]/register/page.tsx)
**Current Steps:**
1. Entity Details (name_ar, name_en, businessType, logo, phone, mobile, email, website, address)
2. Official Documentation (crNumber, crDocument, taxNumber, taxDocument, licenseNumber, licenseDocument)
3. Contact Person (contactPersonNameAr, contactPersonNameEn, contactPersonEmail, contactPersonMobile, contactPersonPosition)
4. Owner Details (ownerNameAr, ownerNameEn, ownerPhone, ownerEmail, ownerNationalId)
5. Business Details (providesHomeServices, staffCount, mainService, sellsProducts, hasOwnPaymentGateway, serviceRanking, advertiseOnSocialMedia, wantsRifahPromotion)
6. Service Agreement (acceptedServiceAgreement)

**Missing:** Subscription Package Selection

### Backend Endpoint (server/src/controllers/tenantRegistrationController.js)
**Route:** POST /api/v1/auth/tenant/register

**Accepted Data:**
- All fields from frontend steps 1-6
- File uploads: logo, crDocument, taxDocument, licenseDocument
- Password and preferredLanguage

**What it creates:**
- New Tenant record with status='pending'
- ActivityLog entry
- JWT tokens for immediate login
- Returns tenant data

**File Upload Configuration:**
- Uses multer with diskStorage
- Max file size: 10MB
- Allowed types: jpeg, jpg, png, gif, pdf
- Separate directories for logos and documents

**Upload Paths:**
- Logo: `uploads/tenants/logos/`
- CR Document: `uploads/tenants/documents/cr/`
- Tax Document: `uploads/tenants/documents/tax/`
- License Document: `uploads/tenants/documents/license/`

### Database Schema (server/src/models/Tenant.js)
**Tenant Model Fields:**
✅ name_en, name_ar (Business names)
✅ businessType (ENUM)
✅ logo (file path)
✅ phone, mobile, email, website
✅ buildingNumber, street, district, city, country, googleMapLink
✅ crNumber, crDocument, taxNumber, taxDocument, licenseNumber, licenseDocument
✅ contactPersonNameAr, contactPersonNameEn, contactPersonEmail, contactPersonMobile, contactPersonPosition
✅ ownerNameAr, ownerNameEn, ownerPhone, ownerEmail, ownerNationalId
✅ providesHomeServices, staffCount, mainService, sellsProducts, hasOwnPaymentGateway, serviceRanking, advertiseOnSocialMedia, wantsRifahPromotion
✅ status (ENUM: pending, approved, rejected, suspended, inactive)
✅ password (hashed)
✅ settings (JSONB)

**Legacy Fields (still present):**
- `plan` (ENUM: free_trial, basic, pro, enterprise) - OLD SYSTEM
- `planStartDate`, `planEndDate` - OLD SYSTEM

**Missing for New Subscription System:**
- Link to SubscriptionPackage (handled by TenantSubscription model separately)

## What Needs to be Added

### 1. Frontend: New Step for Subscription Package Selection
**Step 6: Choose Subscription Package**
- Three tabs: Monthly, 6 Months, Annual
- Display all active packages under each tab
- Show package details: name, price, limits, features
- Allow user to select one package
- Store `selectedPackageId` and `selectedBillingPeriod` in formData

### 2. Backend: Handle Subscription in Registration
**Update `tenantRegistrationController.js`:**
- Accept `selectedPackageId` and `selectedBillingPeriod` from request
- After tenant creation, create `TenantSubscription` record with status='pending'
- Return package information in response

### 3. Super Admin: Activate Subscription on Approval
**Update `adminTenantsController.js` (approveTenant):**
- When approving tenant, activate their TenantSubscription
- Set subscription dates (startDate, endDate based on billing period)
- Initialize TenantUsage tracking

## File Upload Validation

### Allowed Formats:
**Documents (CR, Tax, License):**
- ✅ PDF (.pdf)
- ✅ JPG (.jpg, .jpeg)
- ✅ PNG (.png)
- ❌ WEBP (.webp) - NOT CURRENTLY ALLOWED (need to add)

**Images (Logo):**
- ✅ JPG (.jpg, .jpeg)
- ✅ PNG (.png)
- ✅ GIF (.gif)
- ❌ WEBP (.webp) - NOT CURRENTLY ALLOWED (need to add)

**Required Update:** Add 'webp' to fileFilter in tenantRegistrationController.js

## Data Flow Verification

### Registration Flow:
1. User fills out form (6 steps)
2. Form data + files sent to `/api/v1/auth/tenant/register`
3. Backend validates data
4. Files saved to disk (multer)
5. Tenant record created in DB with file paths
6. TenantSubscription created (NEW - status='pending')
7. ActivityLog entry created
8. JWT tokens generated
9. Response sent to frontend
10. Redirect to "pending approval" page

### Approval Flow:
1. Super Admin views tenant in dashboard
2. Clicks "Approve"
3. Backend updates Tenant.status = 'approved'
4. Backend activates TenantSubscription (NEW)
5. Backend initializes TenantUsage (NEW)
6. Email/notification sent to tenant (TODO)
7. Tenant can now login and use platform

## Testing Checklist

- [ ] Can submit registration form with all fields
- [ ] Files upload successfully (logo, CR, tax, license)
- [ ] WEBP format is accepted
- [ ] Tenant record created with correct data
- [ ] All field values match between form → backend → database
- [ ] File paths are correct and files are accessible
- [ ] Subscription package is stored correctly
- [ ] Tenant appears in Super Admin dashboard (pending list)
- [ ] Super Admin can view all tenant details
- [ ] Super Admin can approve tenant
- [ ] Upon approval, subscription is activated
- [ ] Tenant can login after approval

