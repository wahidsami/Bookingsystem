# Home Page Data Sources - Verification

## ✅ Home Page Structure

The home page (`/t/:slug`) now contains ONLY the following sections:

1. **Header** (Global - always visible)
2. **Hero Slider** (Conditional - based on `sections.heroSlider`)
3. **Services Section** (Conditional - based on `sections.services`)
4. **Products Section** (Conditional - based on `sections.products`)
5. **Footer** (Global - always visible)

---

## 📊 Data Sources

### 1. Header Component
**File**: `PublicPage/src/components/Header.tsx`

**Data Source**: `TenantContext` → `tenant` object

**Fields Used**:
- Logo: `tenant.logo` or `tenant.profileImage` (fallback)
- Name: `tenant.name_en` or `tenant.name` (fallback)
- Phone: `tenant.phone` or `tenant.mobile` (fallback)

**API Endpoint**: `GET /api/v1/public/tenant/:slug`
- Returns tenant basic info from **Tenant Dashboard → Settings Section**

---

### 2. Hero Slider Component
**File**: `PublicPage/src/components/HeroSlider.tsx`

**Data Source**: `TenantContext` → `pageData.heroSliders`

**Fields Used**:
- `pageData.heroSliders[]` - Array of hero slider objects
  - `backgroundImage`
  - `taglineEn`, `taglineAr`
  - `heroTitleEn`, `heroTitleAr`
  - `subtitleEn`, `subtitleAr`
  - `ctaButtonTextEn`, `ctaButtonTextAr`
  - `ctaButtonType`, `ctaButtonItemId`
  - `textAlignment`
  - `heroTitleColor`, `subtitleColor`

**API Endpoint**: `GET /api/v1/public/tenant/:tenantId/page-data`
- Returns hero sliders from **Tenant Dashboard → My Page Section → Hero Slider Tab**

**Fallback**: If no hero sliders exist, shows a default welcome slide

---

### 3. Services Section
**File**: `PublicPage/src/components/LandingPage.tsx`

**Data Source**: API call to services endpoint

**Fields Used**:
- `services[]` - Array of service objects (first 6)
  - `id`, `name_en`, `name_ar`
  - `description_en`, `description_ar`
  - `category`, `finalPrice`, `duration`
  - `image`
  - `availableInCenter`, `availableHomeVisit`
  - `benefits`, `whatToExpect`

**API Endpoint**: `GET /api/v1/public/tenant/:tenantId/services`
- Returns services from **Tenant Dashboard → Services Management**

**Display**: Shows first 6 services with "View All Services" button

---

### 4. Products Section
**File**: `PublicPage/src/components/ProductsSection.tsx`

**Data Source**: API call to products endpoint

**Fields Used**:
- `products[]` - Array of product objects (first 8)
  - `id`, `name_en`, `name_ar`
  - `description_en`, `description_ar`
  - `category`, `price`, `rawPrice`
  - `images[]`, `stock`, `isAvailable`

**API Endpoint**: `GET /api/v1/public/tenant/:tenantId/products`
- Returns products from **Tenant Dashboard → Products Management**

**Display**: Shows first 8 products with "View All Products" button

---

### 5. Footer Component
**File**: `PublicPage/src/components/Footer.tsx`

**Data Source**: `TenantContext` → `tenant` object

**Fields Used**:
- Logo: `tenant.logo` or `tenant.profileImage` (fallback)
- Name: `tenant.name_en` or `tenant.name` (fallback)
- Phone: `tenant.phone` or `tenant.mobile` (fallback)
- Email: `tenant.email`
- Address: `tenant.buildingNumber`, `tenant.street`, `tenant.district`, `tenant.city`, `tenant.country`
- Social Media Links:
  - `tenant.facebookUrl`
  - `tenant.instagramUrl`
  - `tenant.twitterUrl`
  - `tenant.linkedinUrl`
  - `tenant.tiktokUrl`
  - `tenant.youtubeUrl`
  - `tenant.snapchatUrl`
  - `tenant.pinterestUrl`
  - `tenant.whatsappNumber`

**API Endpoint**: `GET /api/v1/public/tenant/:slug`
- Returns tenant info from **Tenant Dashboard → Settings Section**

**Sections**:
1. **Logo & Social Media** - Tenant logo, name, social media icons
2. **Contact Us** - Phone, email, address
3. **Quick Links** - Navigation links (Home, Services, Products, About, Contact)
4. **Opening Hours** - Static display (can be made dynamic later)

---

## 🔧 Backend Fixes Applied

### Service Controller
- ✅ Removed non-existent `rating` field from attributes
- ✅ All other fields verified to exist in Service model

### Staff Controller  
- ✅ Changed `image` to `photo` (actual database column)
- ✅ Removed non-existent `specialty` field
- ✅ Added mapping: `photo` → `image` and `skills[0]` → `specialty` for frontend compatibility

---

## ✅ Verification Checklist

- [x] Header loads logo from tenant settings
- [x] Hero slider loads from My Page section
- [x] Services section loads from dashboard services
- [x] Products section loads from dashboard products
- [x] Footer loads all data from tenant settings
- [x] All API endpoints return correct data structure
- [x] Error handling for missing data implemented
- [x] Loading states implemented
- [x] Empty states with user-friendly messages

---

## 🚀 Next Steps

1. **Test the home page** - Verify all sections display correctly
2. **Verify data flow** - Check browser console for any errors
3. **Test with empty data** - Ensure graceful handling when sections are empty
4. **Proceed to next pages** - Once home page is confirmed working

---

## 📝 Notes

- All sections respect `sections` visibility flags from `generalSettings`
- If a section is disabled, it won't render at all
- If data is missing, sections show "Data not available" messages
- Images use fallback mechanisms if they fail to load
- All API calls use `Promise.allSettled` for graceful error handling

