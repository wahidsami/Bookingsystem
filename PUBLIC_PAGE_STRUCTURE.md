# Tenant Public Page - Complete Structure & Data Flow

## 📋 Overview

The Tenant Public Page is a **standalone React application** that displays a customizable public website for each tenant. Each tenant has a unique URL based on their slug (e.g., `http://localhost:3004/t/aleel-trading`).

---

## 🏗️ Architecture Overview

```
Browser (http://localhost:3004/t/aleel-trading)
    ↓
React Router (extracts slug: "aleel-trading")
    ↓
TenantProvider (fetches tenant data)
    ↓
TemplateWrapper (applies CSS template)
    ↓
AppContent (renders pages based on route)
    ↓
Components (display tenant-specific content)
```

---

## 🔄 Data Flow & Loading Process

### Step 1: URL Routing (`App.tsx`)

**File**: `PublicPage/src/App.tsx`

1. User visits: `http://localhost:3004/t/aleel-trading`
2. React Router matches route: `/t/:slug/*`
3. Extracts slug: `"aleel-trading"`
4. Wraps app with `TenantRouteWrapper`

```typescript
<Route path="/t/:slug/*" element={<TenantRouteWrapper><AppContent /></TenantRouteWrapper>} />
```

### Step 2: Tenant Context Loading (`TenantContext.tsx`)

**File**: `PublicPage/src/context/TenantContext.tsx`

**What it loads:**

1. **Tenant Basic Info** (from `GET /api/v1/public/tenant/:slug`):
   - Name, logo, contact info
   - Address, social media links
   - Business type, slug

2. **Public Page Data** (from `GET /api/v1/public/tenant/:tenantId/page-data`):
   - Hero sliders
   - About Us content
   - General settings (template, theme colors, section visibility)

**Process:**
```typescript
useEffect(() => {
  // 1. Get tenant by slug
  const tenantResponse = await publicAPI.getTenantBySlug(slug);
  // 2. Get public page data using tenant ID
  const pageDataResponse = await publicAPI.getPublicPageData(tenantData.id);
  // 3. Apply theme colors to CSS variables
  document.documentElement.style.setProperty('--color-primary', theme.primaryColor);
}, [slug]);
```

**Data Provided to Components:**
- `tenant`: Basic tenant information
- `pageData`: Hero sliders, about us, general settings
- `template`: Selected template (template1, template2, template3)
- `theme`: Primary, secondary, helper colors
- `sections`: Visibility flags (heroSlider, services, products, callToAction)
- `loading`: Loading state
- `error`: Error message if any

### Step 3: Template Application (`TemplateWrapper.tsx`)

**File**: `PublicPage/src/components/TemplateWrapper.tsx`

- Reads `template` from TenantContext
- Dynamically imports corresponding CSS file (`template1.css`, `template2.css`, `template3.css`)
- Applies template class to wrapper
- Conditionally renders sections based on `sections` flags

### Step 4: Page Rendering (`AppContent` in `App.tsx`)

**File**: `PublicPage/src/App.tsx`

Based on the route, renders different pages:

- `/` → `LandingPage` (homepage)
- `/services` → `ServicesPage` (services listing)
- `/services/:id` → `ServiceDetailPage` (service details)
- `/products` → `ProductsListingPage` (products listing)
- `/products/:id` → `ProductDetailPage` (product details)
- `/about` → `AboutPage` (about us content)
- `/contact` → `ContactPage` (contact form)
- `/checkout` → `CheckoutPage` (order checkout)
- `/order-success` → `OrderSuccessPage` (order confirmation)

---

## 📡 API Endpoints Used

### Base URL: `http://localhost:5000/api/v1/public`

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/tenant/:slug` | GET | Get tenant basic info by slug | `TenantContext` |
| `/tenant/:tenantId/page-data` | GET | Get hero sliders, about us, general settings | `TenantContext` |
| `/tenant/:tenantId/services` | GET | Get services list (with filters) | `LandingPage`, `ServicesPage` |
| `/tenant/:tenantId/services/:id` | GET | Get single service details | `ServiceDetailPage` |
| `/tenant/:tenantId/products` | GET | Get products list (with filters) | `LandingPage`, `ProductsListingPage` |
| `/tenant/:tenantId/products/:id` | GET | Get single product details | `ProductDetailPage` |
| `/tenant/:tenantId/staff` | GET | Get active staff members | `LandingPage`, `AboutPage` |
| `/tenant/:tenantId/bookings` | POST | Create booking (public, no auth) | `BookingModal` |
| `/tenant/:tenantId/orders` | POST | Create product order (public, no auth) | `CheckoutPage` |
| `/tenant/:tenantId/contact` | POST | Submit contact form | `ContactPage` |

---

## 🎨 Component Structure

### Global Components (Always Visible)

1. **Header** (`Header.tsx`)
   - Tenant logo/name
   - Navigation links
   - Phone number
   - Shopping cart icon
   - Uses: `tenant.logo`, `tenant.name`, `tenant.phone`

2. **Footer** (`Footer.tsx`)
   - Tenant contact info
   - Social media links
   - Quick navigation
   - Opening hours
   - Uses: `tenant.email`, `tenant.phone`, `tenant.address`, social media URLs

### Page Components

#### 1. LandingPage (`LandingPage.tsx`)
**What it loads:**
- Hero sliders (from `pageData.heroSliders`)
- Services (first 6, from API)
- Products (first 8, from API)
- Staff members (from API)

**Data sources:**
- `pageData.heroSliders` → Hero slider content
- `publicAPI.getServices(tenantId)` → Services list
- `publicAPI.getProducts(tenantId)` → Products list
- `publicAPI.getStaff(tenantId)` → Staff members

#### 2. ServicesPage (`ServicesPage.tsx`)
**What it loads:**
- All services (from API)
- Filtering by category, price range

**Data source:**
- `publicAPI.getServices(tenantId, filters)`

#### 3. ServiceDetailPage (`ServiceDetailPage.tsx`)
**What it loads:**
- Single service details (from API)
- Service images, description, pricing
- Staff assignments

**Data source:**
- `publicAPI.getService(tenantId, serviceId)`

#### 4. ProductsListingPage (`ProductsListingPage.tsx`)
**What it loads:**
- All products (from API)
- Filtering by category, price range

**Data source:**
- `publicAPI.getProducts(tenantId, filters)`

#### 5. ProductDetailPage (`ProductDetailPage.tsx`)
**What it loads:**
- Single product details (from API)
- Product images, description, pricing, stock

**Data source:**
- `publicAPI.getProduct(tenantId, productId)`

#### 6. AboutPage (`AboutPage.tsx`)
**What it loads:**
- Hero image (from `pageData.aboutUs.heroImage`)
- Story (from `pageData.aboutUs.storyEn` / `storyAr`)
- Missions, Visions, Values (from `pageData.aboutUs`)
- Facilities images (from `pageData.aboutUs.facilitiesImages`)
- Staff members (from API)

**Data sources:**
- `pageData.aboutUs` → About us content
- `publicAPI.getStaff(tenantId)` → Staff members

#### 7. ContactPage (`ContactPage.tsx`)
**What it displays:**
- Tenant contact info (phone, email, address)
- Google Maps link
- Social media links
- Contact form (submits to API)

**Data sources:**
- `tenant.phone`, `tenant.email`, `tenant.address` → Contact info
- `tenant.googleMapLink` → Map link
- `tenant.*Url` → Social media links
- `publicAPI.submitContactForm(tenantId, formData)` → Form submission

---

## 🎨 Theming System

### CSS Variables

Theme colors are applied dynamically via CSS variables:

```css
:root {
  --color-primary: #3B82F6;    /* Applied from pageData.generalSettings.theme.primaryColor */
  --color-secondary: #8B5CF6;  /* Applied from pageData.generalSettings.theme.secondaryColor */
  --color-helper: #10B981;      /* Applied from pageData.generalSettings.theme.helperColor */
}
```

**Applied in:** `TenantContext.tsx` (lines 78-80)

### Template System

Three CSS-based templates (same components, different layouts):

- **template1**: Sidebar navigation layout
- **template2**: Top navigation layout
- **template3**: Minimal centered layout

**Selected from:** `pageData.generalSettings.template`

---

## 🔐 Section Visibility Control

Sections can be enabled/disabled from tenant dashboard:

```typescript
sections: {
  heroSlider: boolean;    // Show/hide hero slider on homepage
  services: boolean;       // Show/hide services section
  products: boolean;       // Show/hide products section
  callToAction: boolean;   // Show/hide call-to-action sections
}
```

**Controlled by:** `pageData.generalSettings.sections`

**Used in:** Components check `sections.*` before rendering sections

---

## 🖼️ Image Handling

All images are loaded from backend:

**Format:** `http://localhost:5000/uploads/...`

**Examples:**
- Tenant logo: `http://localhost:5000${tenant.logo}`
- Service image: `http://localhost:5000${service.image}`
- Product image: `http://localhost:5000${product.images[0]}`

**Fallback:** Components handle missing images gracefully (show placeholder or hide)

---

## 📦 State Management

### Contexts Used

1. **TenantContext** (`TenantContext.tsx`)
   - Provides tenant data, theme, template, sections
   - Fetches data on mount
   - Applies theme colors

2. **CartContext** (`CartContext.tsx`)
   - Manages shopping cart state
   - Add/remove products
   - Calculate totals

---

## 🚀 Loading Sequence

1. **User visits URL** → `http://localhost:3004/t/aleel-trading`
2. **React Router** extracts slug: `"aleel-trading"`
3. **TenantProvider** mounts and fetches:
   - `GET /api/v1/public/tenant/aleel-trading` → Tenant info
   - `GET /api/v1/public/tenant/{tenantId}/page-data` → Page data
4. **Theme colors** applied to CSS variables
5. **TemplateWrapper** loads template CSS
6. **AppContent** renders based on route
7. **Page components** fetch additional data (services, products, staff)
8. **Page displays** with tenant-specific content

---

## 🔧 Configuration Files

### Frontend
- `PublicPage/vite.config.ts` - Vite dev server (port 3004)
- `PublicPage/src/lib/api.ts` - API client configuration
- `PublicPage/src/context/TenantContext.tsx` - Data fetching logic

### Backend
- `server/src/index.js` - CORS configuration (includes port 3004)
- `server/src/routes/publicRoutes.js` - Public API routes
- `server/src/controllers/publicTenantController.js` - Public API controllers

---

## 🐛 Common Issues & Solutions

### CORS Error
**Error:** `Access to fetch at 'http://localhost:5000/...' has been blocked by CORS policy`

**Solution:** Ensure `http://localhost:3004` is in CORS allowed origins in `server/src/index.js`

### Tenant Not Found
**Error:** `Tenant not found`

**Solution:** Verify tenant slug exists in database and matches URL

### Images Not Loading
**Error:** Images show broken icon

**Solution:** Check image paths start with `/uploads/` and backend serves static files correctly

---

## 📝 Summary

**The Tenant Public Page:**
1. **Loads** tenant data from backend API based on URL slug
2. **Displays** tenant-specific content (logo, name, contact, social media)
3. **Applies** theme colors and template layout from tenant settings
4. **Shows/Hides** sections based on tenant preferences
5. **Fetches** services, products, staff dynamically from API
6. **Allows** public bookings and orders without authentication

**All data comes from:**
- Backend API (`http://localhost:5000/api/v1/public`)
- Tenant database records
- PublicPageData model (hero sliders, about us, general settings)

