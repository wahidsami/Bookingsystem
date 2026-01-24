# Tenant Public Page Authentication & Booking/Purchase Integration Plan

## Overview
Enable users to login, book appointments, and purchase products directly from tenant public pages (accessed via browser on laptop/mobile), while maintaining full synchronization with the client app.

---

## Current State Analysis

### Tenant Public Page (`/tenant/[slug]`)
- ✅ Publicly accessible (no login required)
- ✅ Displays tenant info, services, staff, products
- ✅ "Book Now" button redirects to `/booking?tenantId=...&serviceId=...`
- ✅ "Buy Now" button redirects to `/products/purchase?productId=...&tenantId=...`
- ❌ No authentication state
- ❌ No user avatar in header
- ❌ Cannot book/purchase without redirecting to separate pages

### Client App Flow
- ✅ Requires login via `/login` page
- ✅ Uses `AuthContext` for authentication state
- ✅ Protected routes for booking/purchase pages
- ✅ All actions sync with backend

---

## Requirements

### Functional Requirements
1. **Authentication on Tenant Page**
   - User can login from tenant public page
   - User stays on tenant page after login (no redirect)
   - User avatar appears in header when logged in
   - User can logout from tenant page

2. **Booking Flow on Tenant Page**
   - When logged in: "Book Now" opens booking flow on same page (modal or inline)
   - When not logged in: "Book Now" shows login prompt, then opens booking flow
   - Booking flow should be similar to `/booking` page but embedded in tenant page
   - After booking, user stays on tenant page

3. **Purchase Flow on Tenant Page**
   - When logged in: "Buy Now" opens purchase flow on same page
   - When not logged in: "Buy Now" shows login prompt, then opens purchase flow
   - Purchase flow should be similar to `/products/purchase` but embedded
   - After purchase, user stays on tenant page

4. **Data Synchronization**
   - All bookings created from tenant page appear in client app
   - All purchases made from tenant page appear in client app
   - Same backend APIs, same user account
   - Real-time sync (no delay)

### Technical Requirements
1. **Shared Authentication**
   - Use same `AuthContext` across tenant page and client app
   - Same token storage mechanism
   - Same API authentication headers

2. **Component Reusability**
   - Extract booking flow into reusable components
   - Extract purchase flow into reusable components
   - Share components between tenant page and dedicated pages

3. **User Experience**
   - Smooth transitions (no page reloads)
   - Modal-based flows for booking/purchase
   - Clear visual feedback for authentication state
   - Responsive design (mobile + desktop)

---

## Implementation Plan

### Phase 1: Authentication Integration (Foundation)

#### 1.1 Add AuthContext to Tenant Page
**File:** `client/src/app/tenant/[slug]/page.tsx`

**Changes:**
- Import `useAuth` from `AuthContext`
- Check authentication state
- Display user avatar in header when logged in
- Add login/logout buttons in header

**Implementation:**
```typescript
const { user, isAuthenticated, login, logout } = useAuth();
const [showLoginModal, setShowLoginModal] = useState(false);
```

#### 1.2 Create Login Modal Component
**File:** `client/src/components/LoginModal.tsx` (NEW)

**Features:**
- Modal overlay with login form
- Email/password fields
- Error handling
- Success callback (stays on tenant page)
- Register link option
- Responsive design

**Props:**
```typescript
interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void; // Optional callback after successful login
  showRegisterLink?: boolean;
}
```

#### 1.3 Update Tenant Page Header
**File:** `client/src/app/tenant/[slug]/page.tsx`

**Changes:**
- Add user avatar section in header (when logged in)
- Add "Login" button (when not logged in)
- Add "My Dashboard" link (when logged in)
- Add logout functionality

**Header Structure:**
```
[Back] [Tenant Logo/Name] [Language Switcher] [User Avatar/Login Button]
```

---

### Phase 2: Booking Flow Integration

#### 2.1 Create Reusable Booking Component
**File:** `client/src/components/BookingFlow.tsx` (NEW)

**Purpose:** Extract booking logic from `/booking` page into reusable component

**Features:**
- Service selection (pre-filled if serviceId provided)
- Staff selection (filtered by service)
- Date/time selection
- Summary and confirmation
- Payment integration
- Success handling

**Props:**
```typescript
interface BookingFlowProps {
  tenantId: string;
  serviceId?: string; // Pre-select service
  staffId?: string; // Pre-select staff
  onComplete?: (appointmentId: string) => void;
  onCancel?: () => void;
  mode?: 'modal' | 'inline'; // Display mode
}
```

#### 2.2 Integrate Booking Flow in Tenant Page
**File:** `client/src/app/tenant/[slug]/page.tsx`

**Changes:**
- Replace "Book Now" link with button that opens booking flow
- Show login modal if not authenticated
- Show booking modal/flow if authenticated
- Handle booking completion (show success, stay on page)

**Flow:**
1. User clicks "Book Now" on service
2. If not logged in → Show login modal
3. After login → Show booking flow modal
4. User completes booking → Show success message
5. User stays on tenant page

#### 2.3 Update Booking Payment Flow
**File:** `client/src/app/booking/payment/page.tsx` (OPTIONAL - Keep for direct access)

**Note:** Keep existing booking payment page for direct access, but also support modal-based payment in tenant page.

---

### Phase 3: Purchase Flow Integration

#### 3.1 Create Reusable Purchase Component
**File:** `client/src/components/ProductPurchaseFlow.tsx` (NEW)

**Purpose:** Extract purchase logic from `/products/purchase` page into reusable component

**Features:**
- Product details display
- Quantity selection
- Payment method selection (Online, POD, POV)
- Address form (for Online/POD)
- Pickup date (for POV)
- Order summary
- Payment integration
- Success handling

**Props:**
```typescript
interface ProductPurchaseFlowProps {
  productId: string;
  tenantId: string;
  onComplete?: (orderId: string) => void;
  onCancel?: () => void;
  mode?: 'modal' | 'inline';
}
```

#### 3.2 Integrate Purchase Flow in Tenant Page
**File:** `client/src/app/tenant/[slug]/page.tsx`

**Changes:**
- Replace "Buy Now" button with purchase flow trigger
- Show login modal if not authenticated
- Show purchase flow modal if authenticated
- Handle purchase completion (show success, stay on page)

**Flow:**
1. User clicks "Buy Now" on product
2. If not logged in → Show login modal
3. After login → Show purchase flow modal
4. User completes purchase → Show success message
5. User stays on tenant page

---

### Phase 4: Payment Integration

#### 4.1 Create Reusable Payment Component
**File:** `client/src/components/PaymentModal.tsx` (NEW)

**Purpose:** Extract payment form from booking/product payment pages

**Features:**
- Card details form
- Test card info display
- Payment processing
- Success/error handling
- Supports both booking and product payments

**Props:**
```typescript
interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'booking' | 'product';
  orderData: {
    appointmentId?: string;
    orderId?: string;
    amount: number;
    tenantId: string;
    // ... other relevant data
  };
  onSuccess: (transaction: any) => void;
}
```

#### 4.2 Integrate Payment in Booking/Purchase Flows
- Use `PaymentModal` in `BookingFlow` component
- Use `PaymentModal` in `ProductPurchaseFlow` component
- Handle payment success within tenant page context

---

### Phase 5: UI/UX Enhancements

#### 5.1 Header Enhancements
- User avatar with dropdown menu:
  - View Profile
  - My Bookings
  - My Purchases
  - My Dashboard
  - Logout
- Notification badge (if applicable)
- Language switcher (already exists)

#### 5.2 Modal Management
- Create `ModalManager` context for managing multiple modals
- Prevent modal stacking issues
- Smooth transitions between modals

#### 5.3 Success States
- Success modals for booking/purchase
- Options to:
  - View booking/purchase in dashboard
  - Continue browsing tenant page
  - Go to home

---

## File Structure

```
client/src/
├── app/
│   ├── tenant/
│   │   └── [slug]/
│   │       └── page.tsx (UPDATED - Add auth, booking, purchase flows)
│   ├── booking/
│   │   └── page.tsx (KEEP - For direct access)
│   └── products/
│       └── purchase/
│           └── page.tsx (KEEP - For direct access)
├── components/
│   ├── LoginModal.tsx (NEW)
│   ├── BookingFlow.tsx (NEW)
│   ├── ProductPurchaseFlow.tsx (NEW)
│   ├── PaymentModal.tsx (NEW)
│   └── UserAvatar.tsx (NEW - Reusable avatar component)
└── contexts/
    └── AuthContext.tsx (NO CHANGES - Already shared)
```

---

## Implementation Steps

### Step 1: Create Login Modal Component
1. Create `client/src/components/LoginModal.tsx`
2. Extract login form from `/login` page
3. Add modal overlay and styling
4. Integrate with `AuthContext`
5. Add success callback support

### Step 2: Add Authentication to Tenant Page
1. Import `useAuth` in tenant page
2. Add login modal state
3. Update header to show user avatar or login button
4. Add logout functionality
5. Test authentication flow

### Step 3: Create Booking Flow Component
1. Analyze `/booking` page structure
2. Extract booking logic into `BookingFlow` component
3. Make it work in both modal and inline modes
4. Add props for pre-selected service/staff
5. Integrate payment flow

### Step 4: Integrate Booking in Tenant Page
1. Replace "Book Now" links with booking flow triggers
2. Add authentication check
3. Show login modal if needed
4. Show booking flow modal after login
5. Handle booking completion

### Step 5: Create Purchase Flow Component
1. Analyze `/products/purchase` page structure
2. Extract purchase logic into `ProductPurchaseFlow` component
3. Make it work in modal mode
4. Integrate payment flow

### Step 6: Integrate Purchase in Tenant Page
1. Replace "Buy Now" buttons with purchase flow triggers
2. Add authentication check
3. Show login modal if needed
4. Show purchase flow modal after login
5. Handle purchase completion

### Step 7: Create Payment Modal Component
1. Extract payment form from booking/product payment pages
2. Make it reusable for both booking and product payments
3. Add proper type handling
4. Integrate with booking/purchase flows

### Step 8: Testing & Refinement
1. Test complete booking flow on tenant page
2. Test complete purchase flow on tenant page
3. Verify data sync with client app
4. Test on mobile and desktop
5. Test RTL (Arabic) support
6. Fix any issues

---

## Data Flow

### Booking Flow
```
Tenant Page → Click "Book Now" → Check Auth → Login (if needed) → 
Booking Flow Modal → Select Staff/Date/Time → Payment Modal → 
Success → Stay on Tenant Page → Data syncs to client app
```

### Purchase Flow
```
Tenant Page → Click "Buy Now" → Check Auth → Login (if needed) → 
Purchase Flow Modal → Select Quantity/Payment Method → 
Payment Modal (if online) → Success → Stay on Tenant Page → 
Data syncs to client app
```

---

## Key Considerations

### 1. Authentication State Management
- Use existing `AuthContext` (already shared)
- Token stored in localStorage (accessible across pages)
- No need for separate authentication system

### 2. Component Reusability
- Extract common logic into reusable components
- Keep dedicated pages for direct access
- Share components between tenant page and dedicated pages

### 3. URL Structure
- Tenant page: `/tenant/[slug]` (public, no auth required)
- After login: Still `/tenant/[slug]` (user stays on page)
- Booking flow: Modal on tenant page (no URL change)
- Purchase flow: Modal on tenant page (no URL change)

### 4. State Management
- Use React state for modal visibility
- Use `AuthContext` for user state
- Use existing API calls (no changes needed)

### 5. Error Handling
- Show errors in modals
- Handle network errors gracefully
- Provide clear error messages

### 6. Mobile Responsiveness
- Modals should be full-screen on mobile
- Touch-friendly interactions
- Proper keyboard handling

---

## Success Criteria

✅ User can login from tenant public page
✅ User avatar appears in header after login
✅ User can book appointments without leaving tenant page
✅ User can purchase products without leaving tenant page
✅ All bookings appear in client app
✅ All purchases appear in client app
✅ Smooth user experience (no jarring redirects)
✅ Works on both mobile and desktop
✅ Supports both English and Arabic

---

## Future Enhancements (Optional)

1. **Guest Checkout** (if needed)
   - Allow booking/purchase without account
   - Create account after booking/purchase

2. **Social Login**
   - Google, Apple, Facebook login options

3. **Quick Actions**
   - "Book Again" for repeat customers
   - "Buy Again" for repeat purchases

4. **Notifications**
   - Real-time notifications for booking confirmations
   - Order status updates

---

## Estimated Implementation Time

- **Phase 1 (Authentication):** 2-3 hours
- **Phase 2 (Booking Flow):** 4-5 hours
- **Phase 3 (Purchase Flow):** 4-5 hours
- **Phase 4 (Payment Integration):** 2-3 hours
- **Phase 5 (UI/UX):** 2-3 hours
- **Testing & Refinement:** 2-3 hours

**Total:** ~16-22 hours

---

## Notes

- All existing functionality in client app remains unchanged
- Dedicated booking/purchase pages still work for direct access
- Same backend APIs, no backend changes needed
- Full data synchronization guaranteed (same user account, same APIs)
