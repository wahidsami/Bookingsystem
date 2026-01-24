# JASMIN Spa & Salon - Website Structure Documentation

## 🌳 Website Tree Structure

```
JASMIN Spa & Salon Website
│
├── 📄 Home Page (/)
│   ├── Header (Global)
│   ├── Hero Slider Section
│   ├── Featured Services Section
│   ├── Interior Showcase Gallery
│   ├── Staff Section
│   ├── Featured Products Section
│   ├── Reviews Carousel
│   ├── Footer (Global)
│   └── Chatbot Button (Global)
│
├── 📄 Services Page (/services)
│   ├── Header (Global)
│   ├── Page Hero Section
│   ├── Services Filter Section
│   │   ├── Category Filter (All, Massage, Facial, Hair, Nails, Body)
│   │   └── Price Range Filter
│   ├── Services Grid
│   │   └── Service Cards (Click → Service Detail Page)
│   ├── Footer (Global)
│   └── Chatbot Button (Global)
│
├── 📄 Service Detail Page (/services/:id)
│   ├── Header (Global)
│   ├── Back Button
│   ├── Service Hero Section
│   │   ├── Service Image
│   │   ├── Service Title
│   │   ├── Service Price
│   │   └── Book Now Button
│   ├── Service Description
│   ├── Benefits List
│   ├── Duration & Details
│   ├── Related Services
│   ├── Footer (Global)
│   └── Chatbot Button (Global)
│
├── 🗓️ Booking Modal (Overlay)
│   ├── Step 1: Service Selection
│   ├── Step 2: Date & Time Selection
│   ├── Step 3: Service Type (In-Center / Home Visit)
│   ├── Step 4: Staff Selection
│   ├── Step 5: Personal Information
│   ├── Step 6: Payment Method
│   │   ├── Pay at Center
│   │   ├── Online Full Payment
│   │   └── Booking Fee Only
│   └── Step 7: Confirmation
│
├── 📄 Products Page (/products)
│   ├── Header (Global)
│   ├── Page Hero Section
│   ├── Products Filter Section
│   │   ├── Category Filter (All, Skincare, Haircare, Body Care, Sets)
│   │   └── Price Range Filter
│   ├── Products Grid
│   │   └── Product Cards (Click → Product Detail Page)
│   ├── Footer (Global)
│   └── Chatbot Button (Global)
│
├── 📄 Product Detail Page (/products/:id)
│   ├── Header (Global)
│   ├── Back Button
│   ├── Product Gallery
│   │   ├── Main Image
│   │   └── Thumbnail Gallery
│   ├── Product Info Section
│   │   ├── Product Title
│   │   ├── Product Price
│   │   ├── Rating & Reviews
│   │   ├── Quantity Selector
│   │   └── Add to Cart Button
│   ├── Product Description
│   ├── Key Ingredients
│   ├── How to Use
│   ├── Product Features
│   ├── Related Products
│   ├── Footer (Global)
│   └── Chatbot Button (Global)
│
├── 🛒 Shopping Cart Drawer (Side Panel)
│   ├── Cart Header
│   ├── Cart Items List
│   │   ├── Product Image
│   │   ├── Product Name & Price
│   │   ├── Quantity Controls
│   │   └── Remove Button
│   ├── Cart Summary
│   │   ├── Subtotal
│   │   ├── Tax
│   │   └── Total
│   └── Checkout Button
│
├── 📄 Checkout Page (/checkout)
│   ├── Header (Global - Cart Icon Disabled)
│   ├── Back Button
│   ├── Step Indicator
│   ├── Step 1: Shipping Information
│   │   ├── Full Name
│   │   ├── Email
│   │   ├── Phone
│   │   ├── Address
│   │   ├── City
│   │   └── Postal Code
│   ├── Step 2: Delivery Method
│   │   ├── Standard Delivery
│   │   └── Express Delivery
│   ├── Step 3: Payment Information
│   │   ├── Credit/Debit Card
│   │   ├── Cash on Delivery
│   │   └── Apple Pay
│   ├── Order Summary Sidebar
│   │   ├── Products List
│   │   ├── Subtotal
│   │   ├── Delivery Fee
│   │   ├── Tax
│   │   └── Total
│   └── Place Order Button
│
├── 📄 Order Success Page (/order-success)
│   ├── Success Animation/Icon
│   ├── Order Number
│   ├── Confirmation Message
│   ├── Order Summary
│   ├── Continue Shopping Button
│   └── Go Home Button
│
├── 📄 About Us Page (/about)
│   ├── Header (Global)
│   ├── About Hero Section
│   ├── Our Story Section
│   ├── Mission & Vision Section
│   ├── Values Section
│   ├── Gallery Section
│   ├── Team Section
│   │   └── Team Member Cards
│   ├── Awards & Certifications
│   ├── Footer (Global)
│   └── Chatbot Button (Global)
│
├── 📄 Contact Us Page (/contact)
│   ├── Header (Global)
│   ├── Contact Hero Section
│   ├── Contact Information Cards
│   │   ├── Phone
│   │   ├── Email
│   │   ├── Address
│   │   └── Working Hours
│   ├── Contact Form
│   │   ├── Name
│   │   ├── Email
│   │   ├── Phone
│   │   ├── Subject
│   │   └── Message
│   ├── Map Section
│   ├── FAQ Section
│   ├── Footer (Global)
│   └── Chatbot Button (Global)
│
└── 💬 Chatbot (Fixed Button)
    ├── Chatbot Toggle Button
    └── Chat Window
        ├── Chat Header
        ├── Messages Area
        ├── Quick Reply Buttons
        └── Message Input Field
```

---

## 📄 Page Structures - Detailed Breakdown

### 🏠 HOME PAGE STRUCTURE

```
LandingPage Component
│
├── Hero Slider Section
│   ├── Slide 1: "Welcome to Paradise"
│   ├── Slide 2: "Signature Treatments"
│   ├── Slide 3: "Expert Care"
│   └── Navigation Controls (Auto-play with Motion carousel)
│
├── Featured Services Section
│   ├── Section Header
│   │   ├── Title: "Our Signature Services"
│   │   ├── Subtitle
│   │   └── View All Services Link
│   └── Services Grid (6 Featured Services)
│       ├── Aromatherapy Massage
│       ├── Gold Facial Treatment
│       ├── Hair Styling & Treatment
│       ├── Luxury Manicure
│       ├── Hot Stone Massage
│       └── Deep Cleansing Facial
│       └── Each Card Contains:
│           ├── Service Image
│           ├── Service Category Badge
│           ├── Service Title
│           ├── Service Description
│           ├── Service Price
│           ├── Duration
│           └── Book Now Button
│
├── Interior Showcase Section
│   ├── Section Header
│   │   ├── Title: "Our Luxurious Space"
│   │   └── Subtitle
│   └── Image Gallery Grid
│       ├── Reception Area
│       ├── Treatment Rooms
│       ├── Relaxation Lounge
│       └── Spa Facilities
│
├── Meet Our Team Section
│   ├── Section Header
│   │   ├── Title: "Meet Our Expert Team"
│   │   └── Subtitle
│   └── Staff Grid (6 Team Members)
│       ├── Dr. Sarah Mitchell (Lead Therapist)
│       ├── Emma Rodriguez (Hair Specialist)
│       ├── Lisa Chen (Nail Artist)
│       ├── Maria Santos (Massage Therapist)
│       ├── Aisha Abdullah (Facial Specialist)
│       └── Fatima Al-Rashid (Wellness Consultant)
│       └── Each Card Contains:
│           ├── Staff Photo
│           ├── Staff Name
│           ├── Position/Specialty
│           ├── Experience Years
│           └── Certifications
│
├── Featured Products Section
│   ├── Section Header
│   │   ├── Title: "Premium JASMIN Products"
│   │   ├── Subtitle
│   │   └── View All Products Link
│   └── Products Carousel
│       ├── Jasmine Radiance Serum (289 SAR)
│       ├── Pure Jasmine Essential Oil (189 SAR)
│       ├── Luxury Face Cream (349 SAR)
│       ├── Botanical Body Oil (229 SAR)
│       ├── Nourishing Hair Oil (169 SAR)
│       └── Complete Skincare Set (699 SAR)
│       └── Each Card Contains:
│           ├── Product Image
│           ├── Product Category
│           ├── Product Title
│           ├── Product Price
│           ├── Rating (5 stars)
│           ├── Add to Cart Button
│           └── Quick View Icon
│
└── Customer Reviews Section
    ├── Section Header
    │   ├── Title: "What Our Clients Say"
    │   └── Subtitle
    └── Reviews Carousel (Auto-scroll)
        ├── Review 1 - Layla M.
        ├── Review 2 - Noor A.
        ├── Review 3 - Sara K.
        ├── Review 4 - Hana R.
        └── Review 5 - Zainab F.
        └── Each Review Contains:
            ├── 5-Star Rating
            ├── Review Text
            ├── Customer Name
            ├── Service Type
            └── Date
```

---

### 💆 SERVICES PAGE STRUCTURE

```
ServicesPage Component
│
├── Page Hero Section
│   ├── Background Image/Gradient
│   ├── Page Title: "Our Services"
│   ├── Breadcrumb Navigation (Home > Services)
│   └── Subtitle/Description
│
├── Filter Section
│   ├── Category Filter Tabs
│   │   ├── All Services (Default)
│   │   ├── Massage
│   │   ├── Facial
│   │   ├── Hair Care
│   │   ├── Nails
│   │   └── Body Treatments
│   └── Price Range Filter
│       ├── All Prices
│       ├── Under 200 SAR
│       ├── 200-400 SAR
│       └── 400+ SAR
│
└── Services Grid (12 Total Services)
    ├── Swedish Massage (250 SAR)
    ├── Deep Tissue Massage (300 SAR)
    ├── Hot Stone Massage (350 SAR)
    ├── Aromatherapy Massage (320 SAR)
    ├── Deep Cleansing Facial (200 SAR)
    ├── Anti-Aging Facial (350 SAR)
    ├── Gold Facial Treatment (400 SAR)
    ├── Hydrating Facial (280 SAR)
    ├── Hair Cut & Style (150 SAR)
    ├── Hair Coloring (300 SAR)
    ├── Keratin Treatment (450 SAR)
    └── Hair Treatment (200 SAR)
    └── Each Service Card Contains:
        ├── Service Image (Unsplash)
        ├── Category Badge
        ├── Service Name
        ├── Short Description
        ├── Duration (60-120 mins)
        ├── Price
        ├── "View Details" Button
        └── "Book Now" Button
```

---

### 📋 SERVICE DETAIL PAGE STRUCTURE

```
ServiceDetailPage Component
│
├── Back Navigation Button
│   └── "← Back to Services"
│
├── Service Hero Section
│   ├── Large Service Image
│   ├── Service Category Badge
│   ├── Service Title (H1)
│   ├── Star Rating (5.0)
│   ├── Price Display
│   ├── Duration Badge
│   └── Primary CTA: "Book This Service"
│
├── Service Overview Tabs/Sections
│   ├── Description Tab
│   │   ├── Full Service Description
│   │   └── What to Expect
│   │
│   ├── Benefits Section
│   │   ├── Benefit 1 (Icon + Text)
│   │   ├── Benefit 2 (Icon + Text)
│   │   ├── Benefit 3 (Icon + Text)
│   │   └── Benefit 4 (Icon + Text)
│   │
│   ├── Details Section
│   │   ├── Duration: 60-90 minutes
│   │   ├── Recommended Frequency
│   │   ├── Suitable For
│   │   └── Special Notes
│   │
│   └── Preparation Section
│       ├── Before Your Visit
│       ├── What to Bring
│       └── Contraindications
│
├── Service Options
│   ├── In-Center Service
│   │   ├── Regular Price
│   │   └── Available Time Slots
│   └── Home Visit Service
│       ├── Price + Additional Fee
│       └── Availability Notice
│
├── Staff Selection Preview
│   ├── "Choose Your Preferred Therapist"
│   └── Staff Cards (3-4 specialists)
│       └── Each Shows:
│           ├── Photo
│           ├── Name
│           ├── Specialty
│           └── "Select" Button
│
├── Related Services Section
│   ├── Section Title: "You May Also Like"
│   └── Service Cards (3-4 related services)
│       └── Mini Cards with:
│           ├── Image
│           ├── Title
│           ├── Price
│           └── Quick Book Button
│
└── Sticky Bottom Bar (Mobile)
    ├── Price Display
    └── "Book Now" Button
```

---

### 🗓️ BOOKING MODAL STRUCTURE

```
BookingModal Component (Multi-Step Wizard)
│
├── Modal Header
│   ├── Logo
│   ├── "Book Your Appointment"
│   ├── Step Indicator (7 Steps)
│   └── Close Button (X)
│
├── STEP 1: Service Selection
│   ├── Service Categories
│   ├── Service List (All 12 Services)
│   └── Each Service Shows:
│       ├── Name
│       ├── Duration
│       ├── Price
│       └── Radio Button Selection
│
├── STEP 2: Date & Time Selection
│   ├── Calendar Component
│   │   ├── Month Navigation
│   │   ├── Date Grid
│   │   ├── Disabled Past Dates
│   │   └── Highlight Available Dates
│   └── Time Slots Grid
│       ├── Morning Slots (11:00 AM - 12:00 PM)
│       ├── Afternoon Slots (12:00 PM - 6:00 PM)
│       └── Evening Slots (6:00 PM - 12:00 AM)
│       └── Each Slot Shows:
│           ├── Time
│           ├── Availability Status
│           └── Selection State
│
├── STEP 3: Service Type Selection
│   ├── In-Center Service Card
│   │   ├── Icon
│   │   ├── Title
│   │   ├── Description
│   │   ├── Base Price
│   │   └── Radio Selection
│   └── Home Visit Service Card
│       ├── Icon
│       ├── Title
│       ├── Description
│       ├── Price + Additional Fee (100 SAR)
│       ├── Location Input Field
│       └── Radio Selection
│
├── STEP 4: Staff Selection
│   ├── "Choose Your Preferred Specialist"
│   ├── "Any Available" Option (Recommended)
│   └── Staff Grid (6 Specialists)
│       └── Each Card Shows:
│           ├── Profile Photo
│           ├── Name
│           ├── Position/Specialty
│           ├── Years of Experience
│           ├── Rating (5.0 stars)
│           ├── Availability Indicator
│           └── Radio Selection
│
├── STEP 5: Personal Information
│   ├── Form Fields:
│   │   ├── Full Name (Required)
│   │   ├── Email Address (Required)
│   │   ├── Phone Number (Required)
│   │   ├── Special Requests (Textarea, Optional)
│   │   └── Terms & Conditions Checkbox
│   └── Validation Messages
│
├── STEP 6: Payment Method Selection
│   ├── Pay at Center Option
│   │   ├── Icon: Building
│   │   ├── Title
│   │   ├── Description: "Pay when you arrive"
│   │   ├── No prepayment required
│   │   └── Radio Selection
│   │
│   ├── Pay Full Amount Online
│   │   ├── Icon: Credit Card
│   │   ├── Title
│   │   ├── Description: "Secure online payment"
│   │   ├── Total Amount Display
│   │   ├── Payment Form:
│   │   │   ├── Card Number
│   │   │   ├── Expiry Date
│   │   │   ├── CVV
│   │   │   └── Cardholder Name
│   │   └── Radio Selection
│   │
│   └── Pay Booking Fee Only
│       ├── Icon: Shield Check
│       ├── Title
│       ├── Description: "Reserve with 50 SAR"
│       ├── Booking Fee: 50 SAR
│       ├── Remaining Balance Info
│       ├── Payment Form (Same as above)
│       └── Radio Selection
│
└── STEP 7: Confirmation
    ├── Success Icon/Animation
    ├── Confirmation Message
    ├── Booking Summary:
    │   ├── Service Name
    │   ├── Date & Time
    │   ├── Service Type (In-Center/Home Visit)
    │   ├── Selected Staff
    │   ├── Location (if home visit)
    │   ├── Payment Method
    │   └── Total Amount
    ├── Booking Reference Number
    ├── Confirmation Email Notice
    ├── Add to Calendar Button
    └── Action Buttons:
        ├── "Done" (Close Modal)
        └── "Book Another Service"
```

---

### 🛍️ PRODUCTS PAGE STRUCTURE

```
ProductsListingPage Component
│
├── Page Hero Section
│   ├── Background Gradient
│   ├── Page Title: "JASMIN Premium Products"
│   ├── Breadcrumb (Home > Products)
│   └── Subtitle: "Natural beauty products with jasmine extracts"
│
├── Filter Section
│   ├── Category Filter Tabs
│   │   ├── All Products (Default)
│   │   ├── Skincare
│   │   ├── Haircare
│   │   ├── Body Care
│   │   └── Gift Sets
│   └── Price Range Filter
│       ├── All Prices
│       ├── Under 200 SAR
│       ├── 200-300 SAR
│       └── 300+ SAR
│
└── Products Grid (6 Products)
    ├── Jasmine Radiance Serum (289 SAR)
    │   ├── Category: Skincare
    │   ├── 30ml
    │   └── Star Rating: 5.0 (124 reviews)
    │
    ├── Pure Jasmine Essential Oil (189 SAR)
    │   ├── Category: Body Care
    │   ├── 15ml
    │   └── Star Rating: 5.0 (98 reviews)
    │
    ├── Luxury Face Cream (349 SAR)
    │   ├── Category: Skincare
    │   ├── 50ml
    │   └── Star Rating: 5.0 (156 reviews)
    │
    ├── Botanical Body Oil (229 SAR)
    │   ├── Category: Body Care
    │   ├── 100ml
    │   └── Star Rating: 5.0 (87 reviews)
    │
    ├── Nourishing Hair Oil (169 SAR)
    │   ├── Category: Haircare
    │   ├── 50ml
    │   └── Star Rating: 5.0 (76 reviews)
    │
    └── Complete Skincare Set (699 SAR)
        ├── Category: Gift Sets
        ├── 4 Products
        └── Star Rating: 5.0 (203 reviews)
    
    └── Each Product Card Contains:
        ├── Product Image
        ├── Category Badge
        ├── Product Name
        ├── Price (SAR)
        ├── Star Rating + Review Count
        ├── Short Description
        ├── "View Details" Button
        ├── "Add to Cart" Button
        └── Wishlist Icon (Heart)
```

---

### 📦 PRODUCT DETAIL PAGE STRUCTURE

```
ProductDetailPage Component
│
├── Back Navigation Button
│   └── "← Back to Products"
│
├── Product Main Section (2-Column Layout)
│   │
│   ├── LEFT: Product Gallery
│   │   ├── Main Image Display
│   │   │   ├── Large Product Image
│   │   │   └── Zoom on Hover
│   │   └── Thumbnail Gallery (4 images)
│   │       ├── Product Front View
│   │       ├── Product Back View
│   │       ├── Product in Use
│   │       └── Product Ingredients
│   │
│   └── RIGHT: Product Information
│       ├── Product Category Badge
│       ├── Product Title (H1)
│       ├── Star Rating (5.0) + Review Count
│       ├── Price Display (Large, Bold)
│       ├── Size/Volume Info
│       ├── Short Description
│       ├── Quantity Selector
│       │   ├── Decrease Button (-)
│       │   ├── Quantity Display
│       │   └── Increase Button (+)
│       ├── Add to Cart Button (Primary CTA)
│       ├── Add to Wishlist Button
│       ├── In Stock Status
│       └── Quick Info:
│           ├── Free Shipping on Orders Over 200 SAR
│           ├── 30-Day Return Policy
│           └── Authentic JASMIN Product
│
├── Product Details Tabs
│   │
│   ├── TAB 1: Description
│   │   ├── Full Product Description
│   │   ├── Product Benefits
│   │   └── Why Choose This Product
│   │
│   ├── TAB 2: Key Ingredients
│   │   ├── Ingredient 1
│   │   │   ├── Name
│   │   │   └── Benefits
│   │   ├── Ingredient 2
│   │   ├── Ingredient 3
│   │   └── Ingredient 4
│   │
│   ├── TAB 3: How to Use
│   │   ├── Step-by-Step Instructions
│   │   ├── Usage Frequency
│   │   ├── Best Time to Use
│   │   └── Pro Tips
│   │
│   └── TAB 4: Reviews
│       ├── Overall Rating Summary
│       ├── Rating Breakdown (5-star to 1-star)
│       └── Customer Reviews List
│           └── Each Review:
│               ├── Customer Name
│               ├── Star Rating
│               ├── Review Date
│               ├── Review Text
│               └── Helpful Button
│
├── Product Features Section
│   ├── Feature 1: Natural Ingredients
│   ├── Feature 2: Dermatologically Tested
│   ├── Feature 3: Cruelty-Free
│   └── Feature 4: Premium Quality
│
└── Related Products Section
    ├── Section Title: "Complete Your Routine"
    └── Product Carousel (4 related products)
        └── Each Shows:
            ├── Image
            ├── Title
            ├── Price
            ├── Rating
            └── Quick Add to Cart
```

---

### 🛒 SHOPPING CART STRUCTURE

```
CartDrawer Component (Side Panel - Slides from Right)
│
├── Cart Header
│   ├── Title: "Shopping Cart"
│   ├── Items Count Badge
│   └── Close Button (X)
│
├── Cart Items Section (Scrollable)
│   ├── Empty Cart State (if cart is empty)
│   │   ├── Empty Cart Icon
│   │   ├── "Your cart is empty"
│   │   └── "Continue Shopping" Button
│   │
│   └── Cart Items List (if cart has items)
│       └── Each Cart Item Contains:
│           ├── Product Image (Thumbnail)
│           ├── Product Details:
│           │   ├── Product Name
│           │   ├── Category
│           │   └── Unit Price
│           ├── Quantity Controls:
│           │   ├── Decrease Button (-)
│           │   ├── Quantity Display
│           │   └── Increase Button (+)
│           ├── Subtotal (Quantity × Price)
│           └── Remove Button (Trash Icon)
│
├── Cart Summary Section
│   ├── Subtotal Row
│   │   ├── Label: "Subtotal"
│   │   └── Amount
│   ├── Tax Row (15% VAT)
│   │   ├── Label: "Tax (15%)"
│   │   └── Amount
│   ├── Shipping Row
│   │   ├── Label: "Shipping"
│   │   └── Status: "Calculated at checkout"
│   ├── Divider Line
│   └── Total Row (Bold/Large)
│       ├── Label: "Total"
│       └── Total Amount (SAR)
│
├── Promo Code Section
│   ├── Promo Code Input Field
│   └── "Apply" Button
│
└── Action Buttons
    ├── "Continue Shopping" (Secondary)
    └── "Proceed to Checkout" (Primary, Gradient)
```

---

### 💳 CHECKOUT PAGE STRUCTURE

```
CheckoutPage Component (Full Page)
│
├── Page Header
│   ├── JASMIN Logo
│   ├── "Secure Checkout" Title
│   ├── Back Button (Returns to Cart)
│   └── Progress Steps Indicator
│       ├── Step 1: Shipping ✓
│       ├── Step 2: Delivery ✓
│       └── Step 3: Payment (Active)
│
├── Main Content (2-Column Layout)
│   │
│   ├── LEFT COLUMN: Checkout Form
│   │   │
│   │   ├── STEP 1: Shipping Information
│   │   │   ├── Section Title: "Shipping Address"
│   │   │   ├── Full Name Input (Required)
│   │   │   ├── Email Input (Required)
│   │   │   ├── Phone Input (Required)
│   │   │   ├── Address Line 1 (Required)
│   │   │   ├── Address Line 2 (Optional)
│   │   │   ├── City Input (Required)
│   │   │   ├── Postal Code (Required)
│   │   │   ├── Save Address Checkbox
│   │   │   └── "Continue to Delivery" Button
│   │   │
│   │   ├── STEP 2: Delivery Method
│   │   │   ├── Section Title: "Delivery Method"
│   │   │   ├── Standard Delivery Option
│   │   │   │   ├── Radio Button
│   │   │   │   ├── Delivery Time: 3-5 Business Days
│   │   │   │   └── Cost: Free (Orders over 200 SAR)
│   │   │   ├── Express Delivery Option
│   │   │   │   ├── Radio Button
│   │   │   │   ├── Delivery Time: 1-2 Business Days
│   │   │   │   └── Cost: 50 SAR
│   │   │   └── "Continue to Payment" Button
│   │   │
│   │   └── STEP 3: Payment Information
│   │       ├── Section Title: "Payment Method"
│   │       │
│   │       ├── Credit/Debit Card Option
│   │       │   ├── Radio Selection
│   │       │   ├── Card Number Input (16 digits)
│   │       │   ├── Cardholder Name
│   │       │   ├── Expiry Date (MM/YY)
│   │       │   ├── CVV (3 digits)
│   │       │   └── Save Card Checkbox
│   │       │
│   │       ├── Cash on Delivery Option
│   │       │   ├── Radio Selection
│   │       │   ├── Icon: Money Bill
│   │       │   └── Description
│   │       │
│   │       ├── Apple Pay Option
│   │       │   ├── Radio Selection
│   │       │   ├── Apple Pay Icon
│   │       │   └── "Pay with Apple Pay" Button
│   │       │
│   │       ├── Terms & Conditions Checkbox
│   │       └── "Place Order" Button (Primary, Large)
│   │
│   └── RIGHT COLUMN: Order Summary
│       ├── Section Title: "Order Summary"
│       ├── Products List
│       │   └── Each Product:
│       │       ├── Product Image (Small)
│       │       ├── Product Name
│       │       ├── Quantity Badge
│       │       └── Price
│       ├── Promo Code Section
│       │   ├── Input Field
│       │   └── "Apply" Button
│       ├── Pricing Breakdown
│       │   ├── Subtotal
│       │   ├── Delivery Fee
│       │   ├── Tax (15%)
│       │   ├── Discount (if applied)
│       │   └── Total (Large, Bold)
│       ├── Secure Checkout Badge
│       └── Money-Back Guarantee Notice
│
└── Trust Indicators Footer
    ├── Secure Payment Icon
    ├── Free Returns Icon
    └── 24/7 Support Icon
```

---

### ℹ️ ABOUT US PAGE STRUCTURE

```
AboutPage Component
│
├── About Hero Section
│   ├── Large Background Image
│   ├── Overlay Gradient
│   ├── Page Title: "About JASMIN"
│   ├── Breadcrumb (Home > About)
│   └── Subtitle: "Luxury, Wellness & Tranquility Since 2010"
│
├── Our Story Section
│   ├── 2-Column Layout
│   │   ├── LEFT: Story Text
│   │   │   ├── Section Title: "Our Story"
│   │   │   ├── Foundation Year: 2010
│   │   │   ├── Story Paragraphs (3-4)
│   │   │   └── Founder Quote
│   │   └── RIGHT: Image
│   │       └── Spa Interior / Founder Photo
│   └── Timeline/Milestones
│       ├── 2010: Founded
│       ├── 2015: Expanded Services
│       ├── 2020: Launched Product Line
│       └── 2025: Award-Winning Spa
│
├── Mission & Vision Section
│   ├── 2-Card Layout
│   │   ├── Mission Card
│   │   │   ├── Icon
│   │   │   ├── Title: "Our Mission"
│   │   │   └── Description
│   │   └── Vision Card
│   │       ├── Icon
│   │       ├── Title: "Our Vision"
│   │       └── Description
│
├── Our Values Section
│   ├── Section Title: "Our Core Values"
│   └── Values Grid (4 Values)
│       ├── Excellence
│       │   ├── Icon
│       │   ├── Title
│       │   └── Description
│       ├── Authenticity
│       ├── Wellness
│       └── Luxury
│
├── Facility Gallery Section
│   ├── Section Title: "Explore Our Spa"
│   └── Gallery Grid (6-8 Images)
│       ├── Reception & Waiting Area
│       ├── Private Treatment Rooms
│       ├── Relaxation Lounge
│       ├── Spa Facilities
│       ├── Product Boutique
│       └── Outdoor Garden Area
│
├── Meet Our Team Section
│   ├── Section Title: "Our Expert Team"
│   ├── Subtitle: "Internationally certified professionals"
│   └── Team Grid (6 Members)
│       └── Each Team Card:
│           ├── Professional Photo
│           ├── Name
│           ├── Position/Title
│           ├── Specialty
│           ├── Years of Experience
│           ├── Certifications
│           └── Short Bio
│
├── Awards & Certifications Section
│   ├── Section Title: "Awards & Recognition"
│   └── Awards Grid
│       ├── Best Spa 2024
│       ├── Luxury Wellness Award
│       ├── ISO Certified
│       └── Organic Products Certified
│
└── Why Choose Us Section
    ├── Section Title: "Why Choose JASMIN"
    └── Features Grid (6 Features)
        ├── Expert Therapists
        ├── Premium Products
        ├── Luxurious Facilities
        ├── Personalized Care
        ├── Hygiene Standards
        └── Award-Winning Service
```

---

### 📞 CONTACT US PAGE STRUCTURE

```
ContactPage Component
│
├── Contact Hero Section
│   ├── Background Gradient
│   ├── Page Title: "Get In Touch"
│   ├── Breadcrumb (Home > Contact)
│   └── Subtitle: "We'd love to hear from you"
│
├── Contact Information Cards Section
│   ├── Grid Layout (4 Cards)
│   │   │
│   │   ├── Phone Card
│   │   │   ├── Phone Icon
│   │   │   ├── Title: "Call Us"
│   │   │   ├── Phone 1: +966 12 345 6789
│   │   │   ├── Phone 2: +966 12 345 6790
│   │   │   └── "Available 11 AM - 12 AM"
│   │   │
│   │   ├── Email Card
│   │   │   ├── Email Icon
│   │   │   ├── Title: "Email Us"
│   │   │   ├── General: contact@jasminspa.com
│   │   │   ├── Bookings: bookings@jasminspa.com
│   │   │   └── "We reply within 24 hours"
│   │   │
│   │   ├── Location Card
│   │   │   ├── Location Icon
│   │   │   ├── Title: "Visit Us"
│   │   │   ├── Address: Anas Ibn Malik Road
│   │   │   ├── City: Riyadh, Saudi Arabia
│   │   │   └── "Click for directions"
│   │   │
│   │   └── Working Hours Card
│   │       ├── Clock Icon
│   │       ├── Title: "Opening Hours"
│   │       ├── Sat-Thu: 11:00 AM - 12:00 AM
│   │       └── Friday: 1:00 PM - 12:00 AM
│
├── Contact Form Section
│   ├── 2-Column Layout
│   │   │
│   │   ├── LEFT: Contact Form
│   │   │   ├── Form Title: "Send Us a Message"
│   │   │   ├── Form Description
│   │   │   ├── Name Input (Required)
│   │   │   ├── Email Input (Required)
│   │   │   ├── Phone Input (Required)
│   │   │   ├── Subject Dropdown
│   │   │   │   ├── General Inquiry
│   │   │   │   ├── Booking Question
│   │   │   │   ├── Service Information
│   │   │   │   ├── Product Question
│   │   │   │   └── Complaint/Feedback
│   │   │   ├── Message Textarea (Required)
│   │   │   ├── File Upload (Optional)
│   │   │   ├── Subscribe to Newsletter Checkbox
│   │   │   └── Submit Button: "Send Message"
│   │   │
│   │   └── RIGHT: Additional Info
│   │       ├── Why Contact Us
│   │       ├── Response Time Notice
│   │       ├── Booking Preference Note
│   │       └── Social Media Links
│   │           ├── Facebook
│   │           ├── Instagram
│   │           ├── Twitter
│   │           └── WhatsApp
│
├── Map Section
│   ├── Section Title: "Find Us On Map"
│   └── Embedded Map / Map Placeholder
│       ├── Location Pin
│       ├── Address Display
│       └── "Get Directions" Button
│
├── FAQ Section
│   ├── Section Title: "Frequently Asked Questions"
│   └── FAQ Accordion (8-10 Questions)
│       ├── Q1: How do I book an appointment?
│       ├── Q2: What are your cancellation policies?
│       ├── Q3: Do you offer home visit services?
│       ├── Q4: What payment methods do you accept?
│       ├── Q5: Are your products available for purchase?
│       ├── Q6: Do you have parking facilities?
│       ├── Q7: What should I bring to my appointment?
│       └── Q8: Do you offer gift certificates?
│
└── CTA Section
    ├── Background: Gradient
    ├── Title: "Ready to Book?"
    ├── Description
    └── "Book Appointment" Button (Large, Primary)
```

---

## 🧩 GLOBAL COMPONENTS

### 🎯 Header Component (Global)
```
- Logo (Jasmine Image)
- Desktop Navigation
  ├── Home
  ├── Services
  ├── Products
  ├── About
  └── Contact
- Phone Number Display
- Shopping Cart Icon (with badge count)
- Mobile Menu Toggle
- Sticky on Scroll
```

### 🦶 Footer Component (Global)
```
- 4-Column Layout
  ├── Column 1: About JASMIN + Social Links
  ├── Column 2: Contact Information
  ├── Column 3: Quick Links (Navigation)
  └── Column 4: Opening Hours
- Bottom Bar: Copyright Notice
```

### 💬 Chatbot Component (Global)
```
- Fixed Position (Bottom Right)
- Toggle Button (Message Icon)
- Chat Window
  ├── Header: "JASMIN Virtual Assistant"
  ├── Messages Area (Scrollable)
  ├── Quick Reply Buttons (6 options)
  ├── Knowledge Base (50+ responses)
  └── Message Input + Send Button
```

---

## 🎨 DESIGN SYSTEM

### Color Palette
- **Primary**: Jasmine Pink (#E91E63 / #C2185B)
- **Accent**: Gold (#FFD700)
- **Background**: White (#FFFFFF)
- **Text**: Dark Gray (#1A1A1A)
- **Light Gray**: (#F5F5F5)

### Typography
- **Headings**: Custom Typography from globals.css
- **Body**: Sans-serif, Clean & Modern
- **Weights**: Regular (400), Medium (500), Bold (700)

### Components Style
- **Rounded Corners**: 12px - 24px
- **Shadows**: Soft, Layered
- **Gradients**: Pink to Dark Pink
- **Hover Effects**: Scale, Color Transition (300ms)

---

## 📊 KEY FEATURES SUMMARY

✅ **Responsive Design** - Mobile, Tablet, Desktop
✅ **Motion Animations** - Smooth carousel transitions
✅ **State Management** - React Context (Cart)
✅ **Multi-Step Forms** - Booking & Checkout wizards
✅ **E-commerce** - Full shopping cart & checkout
✅ **Smart Chatbot** - 50+ pre-made responses
✅ **SEO Ready** - Semantic HTML structure
✅ **Performance** - Optimized image loading
✅ **Accessibility** - ARIA labels, keyboard navigation

---

## 🗂️ FILE STRUCTURE

```
/
├── App.tsx (Main Router)
├── /components
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── ChatbotButton.tsx
│   ├── LandingPage.tsx
│   ├── ServicesPage.tsx
│   ├── ServiceDetailPage.tsx
│   ├── BookingModal.tsx
│   ├── ProductsListingPage.tsx
│   ├── ProductDetailPage.tsx
│   ├── CartDrawer.tsx
│   ├── CheckoutPage.tsx
│   ├── OrderSuccessPage.tsx
│   ├── AboutPage.tsx
│   └── ContactPage.tsx
├── /context
│   └── CartContext.tsx
└── /styles
    └── globals.css
```

---

**Documentation Version**: 1.0  
**Last Updated**: November 28, 2025  
**Website**: JASMIN Spa & Salon Premium Website
