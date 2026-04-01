# Rifah Mobile

Native Expo customer app for the Refah platform.

## Current Scope

- customer onboarding and language selection
- email/password auth with session restoration
- tenant discovery and tenant detail browsing
- booking flow with mock payment continuation
- cart, orders, purchase history, and payment retry
- customer profile and profile editing

Payment and SMS are still mocked/deferred for now. The app is wired to the real backend and uses the backend mock-payment contract.

## Local Setup

```bash
npm install
npm start
```

Useful commands:

- `npm run android`
- `npm run ios`
- `npm run web`
- `.\node_modules\.bin\tsc --noEmit`

## Environment

Create `.env` from `.env.example`.

```bash
EXPO_PUBLIC_API_URL=https://rapi.unifinitylab.com/api/v1
EXPO_PUBLIC_EAS_PROJECT_ID=your-expo-project-uuid
```

`EXPO_PUBLIC_EAS_PROJECT_ID` is optional until the app is linked to a real Expo project.

## Expo / EAS

The app now uses `app.config.js` and `eas.json`.

Preview APK:

```bash
eas build --profile preview --platform android
```

Production build:

```bash
eas build --profile production --platform all
```

## Important Notes

- API/media URLs are environment-driven
- customer mobile talks to `https://rapi.unifinitylab.com/api/v1` by default
- payment remains fake for now, but orders and bookings use the real backend contracts
- if an Expo project is not linked yet, set `EXPO_PUBLIC_EAS_PROJECT_ID` before store builds
