# Tenant Public Page Comparison

## Overview

There are **TWO different implementations** of tenant public pages in your system:

1. **Client App Tenant Page** - Simple tenant view within the main client app
2. **Standalone PublicPage App** - Full-featured standalone website

---

## 1. Client App Tenant Page

**Location**: `client/src/app/tenant/[slug]/page.tsx`  
**URL**: `http://localhost:3000/tenant/[slug]`  
**Framework**: Next.js (part of client app)

### Features:
- ✅ Simple tabbed interface (Services, Staff, Products)
- ✅ Basic tenant information display
- ✅ **Service Booking**: Full booking flow via `BookingFlow` modal component
  - Date/time selection
  - Staff selection
  - Service type (in-center/home-visit)
  - Payment method selection
  - Online payment support
- ✅ **Product Purchase**: Direct purchase via `ProductPurchaseFlow` modal component
  - No cart system (one product at a time)
  - Payment method selection (Online/POD/POV)
  - Shipping address input
- ✅ Authentication integration (uses client app's `AuthContext`)
- ✅ User menu in header
- ✅ Custom tenant colors support
- ✅ Product detail modals with image gallery

### Design:
- Simple, functional layout
- Tab-based navigation
- Modal-based booking/purchase flows
- Integrated with client app's design system

### API:
- Uses client app's API client (`@/lib/api`)
- Calls `/public/tenant/:slug` endpoints
- Same backend endpoints as PublicPage

---

## 2. Standalone PublicPage App

**Location**: `PublicPage/` directory  
**URL**: `http://localhost:3004/t/[slug]` or `http://localhost:3004/tenant/[slug]`  
**Framework**: React + Vite + React Router (separate app)

### Features:
- ✅ **Full website structure**:
  - Landing page with hero slider
  - Services page (`/services`)
  - Products page (`/products`)
  - Service detail pages
  - Product detail pages
  - About page (`/about`)
  - Contact page (`/contact`)
  - Order success page
- ✅ **Navigation**:
  - Header with menu
  - Footer with links
  - Breadcrumbs
  - Full routing system
- ✅ **Service Booking**: Full booking flow via `BookingModal` component
  - Multi-step booking modal
  - Date/time selection
  - Staff selection
  - Service type selection (in-center/home-visit)
  - Payment method selection
  - Online payment support
- ✅ **Shopping cart**:
  - Cart drawer
  - Add to cart functionality
  - Cart persistence
  - Multiple products support
- ✅ **Checkout flow**:
  - Multi-step checkout page (not modal)
  - Delivery options
  - Payment method selection
  - Order summary
  - Can checkout multiple products at once
- ✅ **Authentication**:
  - Own `AuthContext` (separate from client app)
  - Login modal
  - User menu
  - Token management
- ✅ **Tenant customization**:
  - Custom colors
  - Logo display
  - Cover images
  - Hero sliders
  - Page sections (configurable)
- ✅ **Tenant list page**:
  - Browse all tenants
  - Search functionality
  - Tenant cards

### Design:
- Professional, polished website design
- Full navigation structure
- Multiple pages/routes
- More sophisticated UI/UX

### API:
- Uses its own API client (`PublicPage/src/lib/api.ts`)
- Calls same backend endpoints (`/api/v1/public/...`)
- Has token management and auth headers

---

## Key Differences

| Feature | Client App Tenant Page | Standalone PublicPage |
|---------|----------------------|---------------------|
| **Purpose** | Quick tenant view within client app | Full standalone website |
| **Complexity** | Simple, tabbed interface | Full website with multiple pages |
| **Navigation** | Single page with tabs | Multiple routes/pages |
| **Service Booking** | ✅ Yes (via `BookingFlow` modal) | ✅ Yes (via `BookingModal`) |
| **Product Purchase** | ✅ Yes (via `ProductPurchaseFlow` modal, direct purchase) | ✅ Yes (via cart + checkout page) |
| **Cart System** | ❌ No cart (direct purchase only) | ✅ Full shopping cart |
| **Checkout** | Modal-based (for products) | Full checkout page flow |
| **Pages** | 1 page (tabs) | 6+ pages (landing, services, products, about, contact, etc.) |
| **Footer** | No | Yes, with links |
| **Hero Slider** | No | Yes |
| **Tenant List** | No | Yes (on root `/`) |
| **Framework** | Next.js | React + Vite |
| **Routing** | Next.js App Router | React Router |
| **Auth System** | Client app's AuthContext | Own AuthContext |
| **Port** | 3000 | 3004 |
| **URL Pattern** | `/tenant/[slug]` | `/t/[slug]` or `/tenant/[slug]` |

---

## Use Cases

### Client App Tenant Page (`/tenant/[slug]`)
- **Best for**: Users browsing from the main client app
- **When**: User is already in the client app and wants to view a tenant
- **Flow**: User clicks on tenant from tenant list → Views tenant page → Books/purchases via modals

### Standalone PublicPage (`/t/[slug]`)
- **Best for**: Direct tenant website access
- **When**: Tenant wants to share their own website URL
- **Flow**: User visits tenant's URL directly → Full website experience → Books/purchases → Can navigate to other pages

---

## Which One Should You Use?

### Recommendation: **Use Both**

1. **Client App Tenant Page** (`/tenant/[slug]`):
   - Keep for users browsing from the main app
   - Simpler, faster experience
   - Integrated with client app features

2. **Standalone PublicPage** (`/t/[slug]`):
   - Use for tenant's own marketing
   - Shareable tenant URLs
   - Professional website experience
   - Better SEO potential
   - More customization options

---

## Current Status

✅ **Both are functional** and use the same backend APIs
✅ **Both support** booking and purchasing
✅ **Both support** authentication
✅ **Both use** the same tenant data

---

## Potential Improvements

1. **Unify the design** - Make them look more similar if desired
2. **Share components** - Extract common components to a shared package
3. **Sync auth** - Both use sessionStorage, so tokens are already shared
4. **Add redirect** - Optionally redirect from client app tenant page to PublicPage
5. **Consolidate** - Consider making one the "canonical" version

---

## Summary

**They are DIFFERENT implementations**:
- Client App Tenant Page = Simple, integrated view
- Standalone PublicPage = Full-featured website

Both serve the same purpose (showing tenant info and allowing bookings/purchases) but with different levels of sophistication and use cases.
