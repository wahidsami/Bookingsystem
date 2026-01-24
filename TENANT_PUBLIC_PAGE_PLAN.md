# 🏢 Tenant Public Page - Implementation Plan

**Date**: 2025-11-28  
**Status**: 📋 **PLANNING** - Ready to implement  
**Priority**: 🎯 **HIGH** - Core feature for client booking experience

---

## 🎯 Overview

Every tenant (salon/spa) needs a **public-facing page** that clients can visit to:
- View tenant information (name, logo, description, location)
- Browse services offered
- Browse staff/employees
- See gallery/images
- **Book appointments directly**

This is different from:
- **Tenant Dashboard** (`/tenant/dashboard`) - For salon owners (port 3003)
- **Tenants List** (`/tenants`) - Browse all salons (already exists)
- **Booking Page** (`/booking?tenantId=xxx`) - Multi-step booking flow (already exists)

---

## 📍 Current State

### ✅ What Exists:

1. **Backend API** ✅
   - `GET /api/v1/tenants` - List all tenants
   - `GET /api/v1/tenants/:idOrSlug` - Get tenant details
   - `GET /api/v1/tenants/:idOrSlug/services` - Get tenant's services
   - `GET /api/v1/tenants/:idOrSlug/staff` - Get tenant's staff
   - All endpoints are **public** (no auth required)

2. **Client App Pages** ✅
   - `/tenants` - Browse all salons (grid view)
   - `/booking?tenantId=xxx` - Multi-step booking flow

### ❌ What's Missing:

1. **Tenant Public Page** ❌
   - No dedicated page like `/tenant/[slug]` or `/salon/[slug]`
   - Clients currently go directly from `/tenants` → `/booking`
   - No way to view tenant details, services, staff before booking

---

## 🎨 Proposed Solution

### **Option 1: `/tenant/[slug]` (Recommended)**
```
URL: /tenant/luxury-salon-riyadh
```

**Structure:**
```
client/src/app/tenant/[slug]/page.tsx
```

**Features:**
- Hero section with tenant logo, name, description
- Services section (grid/cards)
- Staff section (cards with photos)
- Gallery section (if available)
- "Book Now" button → redirects to `/booking?tenantId=xxx`
- Location/contact info
- Reviews/ratings (future)

### **Option 2: `/salon/[slug]`**
```
URL: /salon/luxury-salon-riyadh
```

Same structure, different URL path.

---

## 📋 Implementation Plan

### **Phase 1: Create Tenant Public Page** (Priority)

#### 1.1 Create Route Structure
```
client/src/app/tenant/[slug]/
├── page.tsx          # Main tenant public page
└── components/
    ├── TenantHero.tsx
    ├── ServicesSection.tsx
    ├── StaffSection.tsx
    └── GallerySection.tsx (optional)
```

#### 1.2 Page Sections

**Hero Section:**
- Tenant logo
- Tenant name
- Description (if available)
- Location/address
- Contact info
- "Book Now" CTA button

**Services Section:**
- Grid of service cards
- Each card shows:
  - Service image
  - Service name (bilingual)
  - Price
  - Duration
  - "Book This Service" button

**Staff Section:**
- Grid of staff cards
- Each card shows:
  - Staff photo
  - Staff name
  - Skills/tags
  - Rating
  - "Book with [Name]" button

**Gallery Section (Optional):**
- Image carousel
- Showcase salon/spa interior

#### 1.3 Data Fetching

```typescript
// Fetch tenant details
const tenant = await api.get(`/tenants/${slug}`);

// Fetch services
const services = await api.get(`/tenants/${slug}/services`);

// Fetch staff
const staff = await api.get(`/tenants/${slug}/staff`);
```

#### 1.4 Navigation Flow

```
User Journey:
1. Browse salons → /tenants
2. Click on salon → /tenant/[slug] (NEW!)
3. View services/staff
4. Click "Book Now" → /booking?tenantId=xxx&serviceId=xxx (optional)
```

---

## 🔧 Technical Details

### **API Endpoints (Already Exist)**

1. **Get Tenant Details**
```bash
GET /api/v1/tenants/:idOrSlug
Response: {
  success: true,
  tenant: {
    id: "uuid",
    name: "Luxury Salon Riyadh",
    slug: "luxury-salon-riyadh",
    description: "...",
    logo: "url",
    location: "...",
    phone: "...",
    email: "...",
    servicesCount: 15,
    staffCount: 8
  }
}
```

2. **Get Tenant Services**
```bash
GET /api/v1/tenants/:idOrSlug/services
Response: {
  success: true,
  services: [
    {
      id: "uuid",
      name_en: "Haircut & Styling",
      name_ar: "قص وتصفيف",
      description_en: "...",
      description_ar: "...",
      basePrice: 150.00,
      duration: 60,
      image: "url"
    }
  ]
}
```

3. **Get Tenant Staff**
```bash
GET /api/v1/tenants/:idOrSlug/staff
Response: {
  success: true,
  staff: [
    {
      id: "uuid",
      name: "Layla Hassan",
      photo: "url",
      skills: ["haircut", "styling"],
      rating: 5.0,
      totalBookings: 150
    }
  ]
}
```

---

## 🎨 UI/UX Design

### **Design Principles:**
- **Clean & Modern**: Showcase the salon/spa professionally
- **Mobile-First**: Responsive design
- **Bilingual**: Support Arabic/English
- **Fast Loading**: Optimize images and data fetching
- **Clear CTAs**: "Book Now" buttons prominent

### **Layout Structure:**
```
┌─────────────────────────────────────┐
│         Hero Section                │
│  [Logo] Tenant Name                │
│  Description                        │
│  [Book Now Button]                  │
├─────────────────────────────────────┤
│         Services Section            │
│  [Service Cards Grid]               │
├─────────────────────────────────────┤
│         Staff Section               │
│  [Staff Cards Grid]                 │
├─────────────────────────────────────┤
│         Gallery (Optional)         │
│  [Image Carousel]                   │
└─────────────────────────────────────┘
```

---

## 📝 Files to Create

### **Frontend:**
1. `client/src/app/tenant/[slug]/page.tsx` - Main page
2. `client/src/components/tenant/TenantHero.tsx` - Hero section
3. `client/src/components/tenant/ServicesSection.tsx` - Services grid
4. `client/src/components/tenant/StaffSection.tsx` - Staff grid
5. `client/src/components/tenant/ServiceCard.tsx` - Service card component
6. `client/src/components/tenant/StaffCard.tsx` - Staff card component

### **API Client (Update):**
- Already has methods in `client/src/lib/api.ts`
- May need to add helper methods for tenant page

---

## 🚀 Implementation Steps

### **Step 1: Create Route Structure**
- Create `client/src/app/tenant/[slug]/page.tsx`
- Set up dynamic routing

### **Step 2: Fetch Tenant Data**
- Load tenant details by slug
- Load services
- Load staff
- Handle loading/error states

### **Step 3: Build UI Components**
- Hero section
- Services section
- Staff section
- Responsive layout

### **Step 4: Add Navigation**
- Update `/tenants` page to link to `/tenant/[slug]`
- Add "Book Now" buttons that redirect to booking flow

### **Step 5: Polish & Test**
- Add loading skeletons
- Error handling
- Mobile responsiveness
- Bilingual support

---

## ✅ Success Criteria

1. ✅ Clients can visit `/tenant/[slug]` for any tenant
2. ✅ Page displays tenant info, services, and staff
3. ✅ "Book Now" buttons redirect to booking flow
4. ✅ Page is responsive and bilingual
5. ✅ Fast loading (< 2 seconds)
6. ✅ SEO-friendly (meta tags, structured data)

---

## 🔗 Related Files

- **Backend**: `server/src/controllers/tenantController.js`
- **API Routes**: `server/src/routes/tenantRoutes.js`
- **Client API**: `client/src/lib/api.ts`
- **Tenants List**: `client/src/app/tenants/page.tsx`
- **Booking Flow**: `client/src/app/booking/page.tsx`

---

## 📚 References

- **TENANT_BROWSING_API.md** - API documentation
- **TENANT_DASHBOARD_PLAN.md** - Tenant dashboard (different!)
- **IMPLEMENTATION_ROADMAP.md** - Overall roadmap

---

## 🎯 Next Steps

1. **Confirm URL Structure**: `/tenant/[slug]` or `/salon/[slug]`?
2. **Start Implementation**: Create the page and components
3. **Test with Real Data**: Use existing tenants in database
4. **Update Navigation**: Link from `/tenants` page

---

**Status**: 📋 Ready to implement  
**Estimated Time**: 4-6 hours  
**Priority**: 🎯 High - Core client experience feature

