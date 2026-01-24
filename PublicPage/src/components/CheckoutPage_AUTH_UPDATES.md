# CheckoutPage Authentication Updates Needed

## Current State
- File has 452 lines
- No authentication integration yet
- handleNext at line 31
- handleComplete at line 47
- Component ends at line 483

## Updates Required

### 1. Add Imports (after line 7)
```typescript
import { useAuth } from '../context/AuthContext';
import { LoginModal } from './LoginModal';
```

### 2. Add useState for LoginModal (after line 20)
```typescript
const [showLoginModal, setShowLoginModal] = useState(false);
```

### 3. Add useAuth hook (after line 22)
```typescript
const { user, isAuthenticated } = useAuth();
```

### 4. Add useEffect to pre-fill user data (after line 29)
```typescript
// Pre-fill user data when authenticated
useEffect(() => {
  if (isAuthenticated && user && currentStep === 'details') {
    setCheckoutData(prev => ({
      ...prev,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone,
    }));
  }
}, [isAuthenticated, user, currentStep]);
```

### 5. Update handleNext (replace lines 31-37)
```typescript
const handleNext = () => {
  const steps: CheckoutStep[] = ['details', 'delivery', 'payment', 'summary'];
  const currentIndex = steps.indexOf(currentStep);
  const nextStep = steps[currentIndex + 1];
  
  // Check authentication before proceeding to summary (final step)
  if (nextStep === 'summary' && !isAuthenticated) {
    setShowLoginModal(true);
    return;
  }
  
  if (currentIndex < steps.length - 1) {
    setCurrentStep(nextStep);
  }
};
```

### 6. Update handleComplete - add platformUserId (around line 105)
```typescript
platformUserId: isAuthenticated && user ? user.id : undefined
```

### 7. Add LoginModal before closing div (before line 483)
```typescript
{/* Login Modal */}
{showLoginModal && (
  <LoginModal
    isOpen={showLoginModal}
    onClose={() => setShowLoginModal(false)}
    onSuccess={() => {
      setShowLoginModal(false);
      // After login, proceed to summary step
      setCurrentStep('summary');
    }}
  />
)}
```
