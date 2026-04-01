# Refah Mobile App - Font & i18n Setup

## Custom Fonts

### Cairo (Arabic)
- **Download:** https://fonts.google.com/specimen/Cairo
- **Weights needed:** Regular (400), Medium (500), Bold (700)
- **Location:** `assets/fonts/Cairo-Regular.ttf`, `Cairo-Bold.ttf`

### Poppins (English)  
- **Download:** https://fonts.google.com/specimen/Poppins
- **Weights needed:** Regular (400), Medium (500), Bold (700)
- **Location:** `assets/fonts/Poppins-Regular.ttf`, `Poppins-Bold.ttf`

## Implementation Plan

### Step 1: Download Fonts
```bash
# Download from Google Fonts:
# 1. Go to fonts.google.com
# 2. Search "Cairo" → Select Regular, Medium, Bold → Download
# 3. Search "Poppins" → Select Regular, Medium, Bold → Download
# 4. Extract TTF files to assets/fonts/
```

### Step 2: Load Fonts in App
```tsx
import { useFonts } from 'expo-font';

const [fontsLoaded] = useFonts({
  'Cairo-Regular': require('./assets/fonts/Cairo-Regular.ttf'),
  'Cairo-Bold': require('./assets/fonts/Cairo-Bold.ttf'),
  'Poppins-Regular': require('./assets/fonts/Poppins-Regular.ttf'),
  'Poppins-Bold': require('./assets/fonts/Poppins-Bold.ttf'),
});
```

### Step 3: Use Fonts Based on Language
```tsx
const fontFamily = language === 'ar' ? 'Cairo-Regular' : 'Poppins-Regular';
const fontFamilyBold = language === 'ar' ? 'Cairo-Bold' : 'Poppins-Bold';

<Text style={{ fontFamily }}>Content</Text>
```

## Accessibility Integration

**YES, ADD FROM THE START!** ✅

Accessibility is **easier to build in** than retrofit. We'll add:

1. **Screen Reader Support**
   - `accessibilityLabel` on all touchables
   - `accessibilityHint` for non-obvious actions
   - `accessibilityRole` for proper semantics

2. **Visual Accessibility**
   - 4.5:1 color contrast ratios
   - Minimum 16px font size
   - Support dynamic text sizing

3. **Motor Accessibility**
   - 48pt minimum touch targets
   - Adequate spacing (16pt between elements)

4. **Bilingual Accessibility**
   - Arabic VoiceOver reads Arabic text properly
   - English TalkBack reads English text properly
   - Proper text direction (RTL for Arabic)

## Current Status

✅ expo-font installed
✅ i18n translations created (AR/EN)
✅ LanguageContext created
⏳ Waiting for font files download
⏳ Building 4 onboarding screens next
