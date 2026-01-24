# Unifying Tenant Public Pages - Comprehensive Plan

## Current Situation

We have **two separate implementations**:
1. **Client App Tenant Page** (`client/src/app/tenant/[slug]/page.tsx`)
2. **Standalone PublicPage App** (`PublicPage/`)

Both serve the same purpose but have different:
- Components
- Routing systems
- Cart implementations
- UI/UX designs

---

## Unification Strategy

### Option 1: Make PublicPage the Single Source of Truth (Recommended)

**Approach**: Use PublicPage as the canonical implementation, integrate it into client app.

**Pros**:
- ✅ More feature-complete (cart, multiple pages, better UX)
- ✅ Already has all features
- ✅ Professional design
- ✅ Less code duplication

**Cons**:
- ⚠️ Need to handle Next.js ↔ React Router integration
- ⚠️ Need to share auth context

**Implementation**:
1. Keep PublicPage as standalone app (for direct tenant URLs)
2. Embed PublicPage in client app (iframe or component integration)
3. Or redirect client app tenant pages to PublicPage

---

### Option 2: Extract Shared Components Library

**Approach**: Create a shared component library that both apps use.

**Pros**:
- ✅ True code reuse
- ✅ Single source of truth for components
- ✅ Easier maintenance

**Cons**:
- ⚠️ Requires refactoring both apps
- ⚠️ Need to handle framework differences (Next.js vs React Router)
- ⚠️ More complex setup

**Implementation**:
1. Create `shared/` or `packages/` directory
2. Extract common components:
   - Booking components
   - Product components
   - Cart components
   - API clients
3. Both apps import from shared library

---

### Option 3: Consolidate into Client App Only

**Approach**: Remove PublicPage, enhance client app tenant page.

**Pros**:
- ✅ Single codebase
- ✅ No duplication
- ✅ Easier maintenance

**Cons**:
- ⚠️ Lose standalone tenant website capability
- ⚠️ Need to rebuild cart system in client app
- ⚠️ Less flexible for tenant branding

---

### Option 4: Consolidate into PublicPage Only

**Approach**: Remove client app tenant page, always use PublicPage.

**Pros**:
- ✅ Single, feature-complete implementation
- ✅ Better UX
- ✅ Already has all features

**Cons**:
- ⚠️ Need to handle client app navigation
- ⚠️ May need to adjust routing

---

## Recommended Approach: Hybrid Solution

**Best of both worlds**: Keep PublicPage as standalone, enhance client app to use it.

### Phase 1: Component Extraction (Short-term)

1. **Extract shared components**:
   ```
   shared/
   ├── components/
   │   ├── Booking/
   │   │   ├── BookingFlow.tsx (unified)
   │   │   └── BookingModal.tsx (wrapper)
   │   ├── Products/
   │   │   ├── ProductCard.tsx
   │   │   ├── ProductDetail.tsx
   │   │   └── Cart/
   │   │       ├── CartDrawer.tsx
   │   │       └── CheckoutPage.tsx
   │   └── Common/
   │       ├── Currency.tsx
   │       └── ServiceCard.tsx
   ├── lib/
   │   ├── api.ts (unified API client)
   │   └── types.ts
   └── hooks/
       ├── useBooking.ts
       └── useCart.ts
   ```

2. **Refactor both apps** to use shared components

### Phase 2: Unified Implementation (Long-term)

1. **Make PublicPage the canonical implementation**
2. **Client app options**:
   - **Option A**: Redirect to PublicPage
     ```typescript
     // client/src/app/tenant/[slug]/page.tsx
     useEffect(() => {
       window.location.href = `http://localhost:3004/t/${params.slug}`;
     }, [params.slug]);
     ```
   
   - **Option B**: Embed PublicPage (iframe)
     ```typescript
     // client/src/app/tenant/[slug]/page.tsx
     return (
       <iframe 
         src={`http://localhost:3004/t/${params.slug}`}
         className="w-full h-screen"
       />
     );
     ```
   
   - **Option C**: Use PublicPage components directly
     - Import PublicPage components into Next.js
     - Handle routing differences
     - Share contexts (Auth, Cart, Tenant)

---

## Detailed Implementation Plan

### Step 1: Create Shared Component Library

```bash
# Create shared directory structure
mkdir -p shared/components/Booking
mkdir -p shared/components/Products
mkdir -p shared/components/Cart
mkdir -p shared/lib
mkdir -p shared/hooks
```

**Shared Components to Extract**:
1. `BookingFlow` - Unified booking component
2. `ProductCard` - Product display
3. `CartDrawer` - Shopping cart
4. `CheckoutPage` - Checkout flow
5. `Currency` - Currency formatting
6. `ServiceCard` - Service display

### Step 2: Unify Booking Components

**Current State**:
- Client App: `BookingFlow` (Next.js component)
- PublicPage: `BookingModal` (React Router component)

**Unified Component**:
```typescript
// shared/components/Booking/BookingFlow.tsx
interface BookingFlowProps {
  tenantId: string;
  tenant: Tenant;
  serviceId?: string;
  mode: 'modal' | 'page';
  onComplete?: (bookingId: string) => void;
  onCancel?: () => void;
  // Framework-agnostic props
}
```

**Usage in Client App**:
```typescript
import { BookingFlow } from '@/shared/components/Booking/BookingFlow';
```

**Usage in PublicPage**:
```typescript
import { BookingFlow } from '../../shared/components/Booking/BookingFlow';
```

### Step 3: Unify Cart System

**Current State**:
- Client App: No cart (direct purchase)
- PublicPage: Full cart system

**Solution**: Add cart to client app using shared components

```typescript
// shared/components/Cart/CartProvider.tsx
// Framework-agnostic cart context

// shared/components/Cart/CartDrawer.tsx
// Reusable cart drawer component
```

### Step 4: Unify API Client

**Current State**:
- Client App: `client/src/lib/api.ts`
- PublicPage: `PublicPage/src/lib/api.ts`

**Solution**: Single unified API client

```typescript
// shared/lib/api.ts
class UnifiedAPI {
  // All API methods
  // Framework-agnostic
}
```

### Step 5: Handle Framework Differences

**Challenge**: Next.js vs React Router

**Solutions**:
1. **Use React Router in both** (if possible)
2. **Abstract navigation**:
   ```typescript
   // shared/lib/navigation.ts
   interface NavigationAdapter {
     navigate: (path: string) => void;
     goBack: () => void;
   }
   
   // Client app adapter
   class NextJSNavigation implements NavigationAdapter {
     navigate(path: string) {
       router.push(path);
     }
   }
   
   // PublicPage adapter
   class ReactRouterNavigation implements NavigationAdapter {
     navigate(path: string) {
       navigate(path);
     }
   }
   ```

### Step 6: Share Contexts

**Challenge**: Auth, Cart, Tenant contexts

**Solutions**:
1. **Extract to shared contexts** (if using same framework)
2. **Use props instead of contexts** (more flexible)
3. **Create adapter pattern** for different frameworks

---

## Implementation Steps

### Phase 1: Preparation (Week 1)

1. ✅ Analyze both implementations
2. ✅ Identify common components
3. ✅ Create shared directory structure
4. ✅ Set up build system for shared library

### Phase 2: Component Extraction (Week 2-3)

1. Extract `Currency` component
2. Extract `ServiceCard` component
3. Extract `ProductCard` component
4. Extract `BookingFlow` component
5. Extract API client

### Phase 3: Cart System (Week 4)

1. Extract cart components
2. Add cart to client app
3. Test cart functionality

### Phase 4: Integration (Week 5)

1. Update client app to use shared components
2. Update PublicPage to use shared components
3. Test both implementations

### Phase 5: Cleanup (Week 6)

1. Remove duplicate code
2. Update documentation
3. Final testing

---

## Alternative: Quick Win Approach

**Simpler approach for immediate unification**:

### Option: Redirect Client App to PublicPage

**Implementation**:
```typescript
// client/src/app/tenant/[slug]/page.tsx
"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function TenantDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  useEffect(() => {
    // Redirect to PublicPage
    window.location.href = `http://localhost:3004/t/${slug}`;
  }, [slug]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to salon page...</p>
      </div>
    </div>
  );
}
```

**Pros**:
- ✅ Immediate unification
- ✅ No code duplication
- ✅ Single source of truth
- ✅ Easy to implement

**Cons**:
- ⚠️ Full page redirect (not seamless)
- ⚠️ Different domain/port

### Option: Iframe Embedding

**Implementation**:
```typescript
// client/src/app/tenant/[slug]/page.tsx
"use client";

import { useParams } from "next/navigation";

export default function TenantDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <div className="w-full h-screen">
      <iframe
        src={`http://localhost:3004/t/${slug}`}
        className="w-full h-full border-0"
        title={`${slug} - Salon Page`}
      />
    </div>
  );
}
```

**Pros**:
- ✅ Stays within client app
- ✅ No redirect
- ✅ Single source of truth

**Cons**:
- ⚠️ Iframe limitations (navigation, auth sharing)
- ⚠️ May have styling issues

---

## Recommendation

**For immediate unification**: Use **redirect approach** (Option: Redirect Client App to PublicPage)

**For long-term**: Implement **shared component library** (Phase 1-5)

**Best approach**: Start with redirect, then gradually extract shared components.

---

## Next Steps

1. **Decide on approach** (redirect vs shared components)
2. **Create shared directory** structure
3. **Extract first component** (Currency - easiest)
4. **Test in both apps**
5. **Gradually extract more components**
6. **Remove duplicate code**

---

## Questions to Consider

1. **Do you want to keep both apps separate?**
   - Yes → Shared component library
   - No → Redirect or consolidate

2. **Is seamless navigation important?**
   - Yes → Shared components or iframe
   - No → Redirect is fine

3. **Do you need different branding per app?**
   - Yes → Keep separate, use shared components
   - No → Consolidate

4. **What's your timeline?**
   - Quick → Redirect
   - Long-term → Shared components
