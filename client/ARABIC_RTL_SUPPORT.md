# Arabic Language & RTL Support

## Overview
The Rifah platform now fully supports Arabic language with RTL (Right-to-Left) layout.

## Features Implemented

### 1. Translation System
- **Custom i18n Context**: Built-in translation system using React Context
- **Translation Files**: 
  - `src/i18n/messages/en.json` - English translations
  - `src/i18n/messages/ar.json` - Arabic translations
- **Type-safe translations**: Full TypeScript support for translation keys

### 2. RTL Support
- **Automatic Direction Switching**: Document direction changes based on language
- **CSS Logical Properties**: Using `start/end` instead of `left/right`
- **Tailwind RTL Utilities**: Custom utilities for RTL-aware layouts
- **Sidebar Positioning**: Correctly flips from left to right in RTL

### 3. Font Support
- **English**: Inter font family
- **Arabic**: Noto Sans Arabic font family
- **Automatic Font Switching**: Font changes based on selected language

### 4. Language Switcher Component
Three variants available:
- **Dropdown**: Full dropdown with language list
- **Toggle**: Quick switch button between languages
- **Minimal**: Compact flag-only buttons

## Usage

### Using Translations
```tsx
import { useLanguage } from "@/contexts/LanguageContext";

function MyComponent() {
    const { t, isRTL, locale } = useLanguage();
    
    return (
        <div>
            <h1>{t("nav.dashboard")}</h1>
            <p>{t("common.loading")}</p>
        </div>
    );
}
```

### Language Switcher
```tsx
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// Dropdown variant (default)
<LanguageSwitcher />

// Toggle variant
<LanguageSwitcher variant="toggle" />

// Minimal variant (flags only)
<LanguageSwitcher variant="minimal" />
```

### RTL-Aware Styling
```tsx
// Use logical properties
<div className="text-start">  {/* Instead of text-left */}
<div className="ms-4">       {/* Instead of ml-4 (margin-start) */}
<div className="me-4">       {/* Instead of mr-4 (margin-end) */}
<div className="ps-4">       {/* Instead of pl-4 (padding-start) */}
<div className="pe-4">       {/* Instead of pr-4 (padding-end) */}
<div className="start-0">    {/* Instead of left-0 */}
<div className="end-0">      {/* Instead of right-0 */}
```

## Translation Keys Structure

```
common.*         - Common UI elements (loading, save, cancel, etc.)
nav.*            - Navigation items
auth.*           - Authentication forms
dashboard.*      - Dashboard page
profile.*        - Profile page
bookings.*       - Bookings page
payments.*       - Payments & transactions
wallet.*         - Wallet & loyalty
tenants.*        - Salon browsing
booking.*        - Booking flow
settings.*       - Settings page
errors.*         - Error messages
```

## Adding New Translations

1. Add the key to both `en.json` and `ar.json`:

```json
// en.json
{
  "mySection": {
    "myKey": "English text"
  }
}

// ar.json
{
  "mySection": {
    "myKey": "النص العربي"
  }
}
```

2. Use in components:
```tsx
const { t } = useLanguage();
return <span>{t("mySection.myKey")}</span>;
```

## Browser Storage
- Language preference is saved in `localStorage` under key `rifah_locale`
- Persists across sessions

## Components Updated
- ✅ Login Page
- ✅ Register Page
- ✅ Dashboard Layout (sidebar navigation)
- ✅ All navigation items

## Future Enhancements
- [ ] Update remaining pages (Booking, Tenants, Profile, etc.)
- [ ] Add more translation keys as needed
- [ ] Consider using next-intl for advanced features (pluralization, formatting)
- [ ] Add language preference sync with user profile on backend

