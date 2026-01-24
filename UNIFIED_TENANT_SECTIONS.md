# Unified Tenant Page - Complete Sections Overview

## 🎯 Single Source: PublicPage App

After unification, **all tenant pages** (whether accessed from client app or direct URL) will use **PublicPage** as the single source, which includes:

---

## 📄 **Main Pages/Sections**

### 1. **🏠 Landing Page (Home)** - `/t/[slug]/` or `/tenant/[slug]/`

**URL**: `http://localhost:3004/t/[slug]`

**Features**:
- ✅ **Hero Slider** (configurable - can be enabled/disabled)
  - Multiple slides with images
  - Call-to-action buttons
  - "Book Now" button
  - "Explore Services" button
- ✅ **Services Section** (configurable)
  - Featured services (shows first 6)
  - Service cards with images
  - "View All Services" button
- ✅ **Products Section** (configurable)
  - Featured products (shows first 8)
  - Product cards with images
  - "View All Products" button
- ✅ **Call-to-Action Section** (configurable)

**Configurable via tenant dashboard**:
- Show/hide hero slider
- Show/hide services section
- Show/hide products section
- Show/hide call-to-action

---

### 2. **💆 Services Page** - `/t/[slug]/services`

**URL**: `http://localhost:3004/t/[slug]/services`

**Features**:
- ✅ Full list of all services
- ✅ Service cards with:
  - Service image
  - Service name (EN/AR)
  - Description
  - Duration
  - Price
  - Category
- ✅ Filter/search functionality
- ✅ "Book Now" button on each service
- ✅ Click to view service details

**Navigation**: Accessible from:
- Header menu
- Landing page "View All Services" button
- Service cards on landing page

---

### 3. **💆 Service Detail Page** - `/t/[slug]/services/:id`

**URL**: `http://localhost:3004/t/[slug]/services/[service-id]`

**Features**:
- ✅ Full service information
- ✅ Service images
- ✅ Detailed description
- ✅ Duration, price, category
- ✅ Staff members who provide this service
- ✅ "Book Now" button
- ✅ Related services

**Navigation**: Click on any service card

---

### 4. **🛍️ Products Page** - `/t/[slug]/products`

**URL**: `http://localhost:3004/t/[slug]/products`

**Features**:
- ✅ Full list of all products
- ✅ Product cards with:
  - Product images
  - Product name (EN/AR)
  - Description
  - Price
  - Category
  - Stock availability
- ✅ Filter/search functionality
- ✅ "Add to Cart" button
- ✅ Click to view product details

**Navigation**: Accessible from:
- Header menu
- Landing page "View All Products" button
- Product cards on landing page
- Cart drawer

---

### 5. **🛍️ Product Detail Page** - `/t/[slug]/products/:id`

**URL**: `http://localhost:3004/t/[slug]/products/[product-id]`

**Features**:
- ✅ Full product information
- ✅ **Image Gallery**:
  - Main image display
  - Thumbnail gallery
  - Click thumbnail to change main image
- ✅ Detailed description
- ✅ Price, stock, category
- ✅ Quantity selector
- ✅ "Add to Cart" button
- ✅ Related products

**Navigation**: Click on any product card

---

### 6. **ℹ️ About Page** - `/t/[slug]/about`

**URL**: `http://localhost:3004/t/[slug]/about`

**Features**:
- ✅ **Hero Section** with image
- ✅ **Our Story**:
  - Story title
  - Story text (EN/AR)
- ✅ **Missions** section
- ✅ **Visions** section
- ✅ **Values** section
- ✅ **Facilities**:
  - Description (EN/AR)
  - Facility images gallery
- ✅ **Final Word**:
  - Title (EN/AR)
  - Text (EN/AR)
  - Image or icon

**Content**: Fully customizable via tenant dashboard

**Navigation**: Accessible from:
- Header menu
- Footer links

---

### 7. **📞 Contact Page** - `/t/[slug]/contact`

**URL**: `http://localhost:3004/t/[slug]/contact`

**Features**:
- ✅ **Contact Form**:
  - Name field
  - Email field
  - Phone field
  - Subject field
  - Message field
  - Submit button
- ✅ **Contact Information Display**:
  - Phone number
  - Email address
  - Physical address
  - Working hours
- ✅ **Social Media Links**:
  - Facebook
  - Instagram
  - Twitter
  - LinkedIn
  - YouTube
  - WhatsApp
- ✅ **Map/Location** (if available)

**Navigation**: Accessible from:
- Header menu
- Footer links

---

## 🛒 **Shopping & Booking Features**

### 8. **🛒 Shopping Cart Drawer**

**Features**:
- ✅ Slide-out cart drawer
- ✅ List of products in cart
- ✅ Product images
- ✅ Quantity adjustment
- ✅ Remove items
- ✅ Subtotal calculation
- ✅ "Checkout" button
- ✅ Cart icon with item count badge

**Access**: Click cart icon in header

---

### 9. **💳 Checkout Page** - `/t/[slug]/checkout`

**URL**: `http://localhost:3004/t/[slug]/checkout`

**Features**:
- ✅ **Multi-step checkout**:
  1. **Customer Details**:
     - Full name
     - Email
     - Phone number
  2. **Delivery Options**:
     - Pickup from salon
     - Deliver to address
     - Address form (if delivery)
  3. **Payment Method**:
     - Pay Online
     - Pay on Delivery (POD)
  4. **Order Summary**:
     - Products list
     - Subtotal
     - Delivery fee
     - VAT
     - Total amount
- ✅ Authentication check
- ✅ Login modal integration
- ✅ Order confirmation

**Navigation**: From cart drawer "Checkout" button

---

### 10. **✅ Order Success Page** - `/t/[slug]/order-success`

**URL**: `http://localhost:3004/t/[slug]/order-success?orderNumber=[order-number]`

**Features**:
- ✅ Success confirmation
- ✅ Order number display
- ✅ Order summary
- ✅ "Continue Shopping" button
- ✅ "Go to Home" button

**Navigation**: After successful order completion

---

### 11. **📅 Booking Modal**

**Features**:
- ✅ **Multi-step booking flow**:
  1. **Date Selection**: Calendar with available dates
  2. **Time Selection**: Available time slots
  3. **Service Type**: In-center or Home visit
  4. **Staff Selection**: Choose staff member (optional)
  5. **Customer Information**: Pre-filled if logged in
  6. **Payment Method**: At center or Online
  7. **Confirmation**: Review booking details
  8. **Success**: Booking reference number
- ✅ Authentication check
- ✅ Login modal integration
- ✅ Real-time availability
- ✅ Staff filtering by service

**Access**: 
- "Book Now" buttons throughout the site
- Hero slider "Book Now" button
- Service cards
- Service detail pages

---

## 🧭 **Navigation Components**

### 12. **📋 Header**

**Features**:
- ✅ **Tenant Logo** (clickable, goes to home)
- ✅ **Navigation Menu**:
  - Home
  - Services
  - Products
  - About
  - Contact
- ✅ **Phone Number** (clickable, tel: link)
- ✅ **Shopping Cart Icon** (with item count badge)
- ✅ **User Menu** (when logged in):
  - User avatar
  - Dropdown menu:
    - My Dashboard
    - My Bookings
    - My Purchases
    - Profile Settings
    - Logout
- ✅ **Login Button** (when not logged in)
- ✅ **Mobile Menu** (hamburger menu)

**Location**: Sticky header on all pages

---

### 13. **📄 Footer**

**Features**:
- ✅ **Quick Links**:
  - Home
  - Services
  - Products
  - About
  - Contact
- ✅ **Contact Information**:
  - Phone number
  - Email address
  - Physical address
  - Working hours
- ✅ **Social Media Links**:
  - Facebook
  - Instagram
  - Twitter
  - LinkedIn
  - YouTube
  - WhatsApp
- ✅ **Copyright** information
- ✅ **Tenant branding**

**Location**: Bottom of all pages

---

## ⚙️ **Configurable Sections**

Tenants can enable/disable sections via their dashboard:

### Section Configuration:
```typescript
sections: {
  heroSlider: boolean;    // Show/hide hero slider on landing page
  services: boolean;       // Show/hide services section
  products: boolean;       // Show/hide products section
  callToAction: boolean;   // Show/hide call-to-action section
}
```

### Theme Configuration:
```typescript
theme: {
  primaryColor: string;    // Main brand color
  secondaryColor: string;  // Secondary brand color
  helperColor: string;    // Accent color
}
```

### Template Selection:
- Template 1
- Template 2
- Template 3

---

## 🔐 **Authentication Features**

### 14. **🔑 Login Modal**

**Features**:
- ✅ Email/password login
- ✅ "Forgot Password" link
- ✅ "Register" link
- ✅ Info banner about login requirements
- ✅ Stays on current page after login (no redirect)
- ✅ Pre-fills user data after login

**Access**: 
- "Login" button in header
- Prompted when trying to book/purchase without login

---

## 📱 **Additional Features**

### 15. **💬 Chatbot Button** (Optional)

**Features**:
- ✅ Floating chatbot button
- ✅ Click to open chat interface
- ✅ Customer support integration

---

## 📊 **Complete Section Summary**

| Section | URL Pattern | Configurable | Features |
|---------|------------|--------------|----------|
| **Landing Page** | `/t/[slug]/` | ✅ Yes | Hero slider, Services, Products |
| **Services** | `/t/[slug]/services` | ✅ Yes | Full service listing |
| **Service Detail** | `/t/[slug]/services/:id` | ❌ No | Individual service page |
| **Products** | `/t/[slug]/products` | ✅ Yes | Full product listing |
| **Product Detail** | `/t/[slug]/products/:id` | ❌ No | Individual product page |
| **About** | `/t/[slug]/about` | ❌ No | About us information |
| **Contact** | `/t/[slug]/contact` | ❌ No | Contact form & info |
| **Checkout** | `/t/[slug]/checkout` | ❌ No | Product checkout flow |
| **Order Success** | `/t/[slug]/order-success` | ❌ No | Order confirmation |
| **Cart Drawer** | Modal | ❌ No | Shopping cart |
| **Booking Modal** | Modal | ❌ No | Service booking flow |
| **Login Modal** | Modal | ❌ No | User authentication |
| **Header** | All pages | ❌ No | Navigation & user menu |
| **Footer** | All pages | ❌ No | Links & contact info |

---

## 🎨 **Customization Options**

### Tenant Dashboard Controls:

1. **Sections Visibility**:
   - ✅ Enable/disable hero slider
   - ✅ Enable/disable services section
   - ✅ Enable/disable products section
   - ✅ Enable/disable call-to-action

2. **Theme Colors**:
   - ✅ Primary color
   - ✅ Secondary color
   - ✅ Helper/accent color

3. **Template Selection**:
   - ✅ Choose from 3 templates

4. **Content Management**:
   - ✅ About page content
   - ✅ Contact information
   - ✅ Social media links
   - ✅ Hero slider images
   - ✅ Logo and branding

---

## 🚀 **After Unification**

When client app redirects to PublicPage, users will have access to **ALL** these sections:

✅ **7 Main Pages** (Home, Services, Products, About, Contact, etc.)  
✅ **Shopping Cart System** (with checkout)  
✅ **Service Booking** (with modal flow)  
✅ **Product Purchase** (with cart)  
✅ **Authentication** (login, user menu)  
✅ **Navigation** (header, footer)  
✅ **Customization** (themes, sections, templates)

**Result**: A complete, professional tenant website with all features unified in one place! 🎉

---

## 📝 **Implementation Note**

After implementing the redirect:
- Client app: `/tenant/[slug]` → Redirects to → PublicPage: `/t/[slug]`
- All sections above will be available
- Single source of truth
- No code duplication
- Consistent experience everywhere
