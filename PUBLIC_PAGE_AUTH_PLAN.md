# PublicPage Authentication Integration Plan

## Current Situation

**Two Separate Applications:**
1. **Client App** (Next.js): `/tenant/[slug]` - Has authentication ✅
2. **PublicPage App** (React/Vite): `/t/:slug` - NO authentication ❌

**Current PublicPage Flow:**
- `BookingModal` collects customer info (name, email, phone) as guest
- `CheckoutPage` collects customer info for products as guest
- Bookings/orders created without `platformUserId` (guest users)
- No way to sync with user's account

## Requirements

1. Add authentication to PublicPage app
2. When logged in, bookings/purchases should be associated with user account
3. All operations should sync with user's dashboard in client app
4. User should stay on tenant public page after login (no redirect)
5. Login should be prompted when trying to book/purchase

## Implementation Plan

### Phase 1: Create Authentication Context for PublicPage

**File: `PublicPage/src/context/AuthContext.tsx`**
- Similar to client app's AuthContext
- Use same API endpoints (`/api/v1/auth/user/login`)
- Store tokens in `sessionStorage` (same as client app for sync)
- Support `skipRedirect` option

### Phase 2: Create LoginModal Component

**File: `PublicPage/src/components/LoginModal.tsx`**
- Reuse logic from client app's LoginModal
- Adapt to React (not Next.js)
- Support `skipRedirect` to stay on tenant page

### Phase 3: Update Header Component

**File: `PublicPage/src/components/Header.tsx`**
- Add user avatar/login button (similar to client app)
- Show user menu when authenticated
- Hide login button when not authenticated (allow browsing)

### Phase 4: Update BookingModal

**File: `PublicPage/src/components/BookingModal.tsx`**
- Check authentication before allowing booking
- If not authenticated, show login modal
- If authenticated, use user's info (pre-fill email, phone, name)
- Pass `platformUserId` to booking API

### Phase 5: Update CheckoutPage

**File: `PublicPage/src/components/CheckoutPage.tsx`**
- Check authentication before checkout
- If not authenticated, show login modal
- If authenticated, use user's info (pre-fill details)
- Pass `platformUserId` to order API

### Phase 6: Update API Client

**File: `PublicPage/src/lib/api.ts`**
- Add token management (get/set tokens from sessionStorage)
- Add authentication headers to requests when token exists
- Update `createBooking` to accept `platformUserId`
- Update `createOrder` to accept `platformUserId`

### Phase 7: Update Backend (if needed)

**Check if backend supports:**
- Creating bookings with `platformUserId` (for authenticated users)
- Creating orders with `platformUserId` (for authenticated users)
- If not, update backend endpoints

## Key Differences from Client App

1. **No Next.js Router**: Use React Router instead
2. **No Next.js Link**: Use React Router Link
3. **No useRouter**: Use useNavigate from react-router-dom
4. **Same API**: Use same backend API endpoints
5. **Same Storage**: Use sessionStorage for token sync

## Testing Checklist

- [ ] User can browse tenant page without login
- [ ] User sees login prompt when clicking "Book Now"
- [ ] User sees login prompt when clicking "Buy Now"
- [ ] After login, user stays on tenant page
- [ ] User avatar appears in header after login
- [ ] Booking created with user's account (appears in dashboard)
- [ ] Order created with user's account (appears in dashboard)
- [ ] User can logout and login again
- [ ] Token syncs between client app and public page

## Files to Create/Modify

**New Files:**
- `PublicPage/src/context/AuthContext.tsx`
- `PublicPage/src/components/LoginModal.tsx`

**Modified Files:**
- `PublicPage/src/components/Header.tsx`
- `PublicPage/src/components/BookingModal.tsx`
- `PublicPage/src/components/CheckoutPage.tsx`
- `PublicPage/src/lib/api.ts`
- `PublicPage/src/App.tsx` (add AuthProvider)
