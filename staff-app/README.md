# Rifah Staff (Expo)

Mobile app for salon/spa **staff** (employees). Uses the same Rifah API as the web apps (`/api/v1`).

> **Backend note:** Staff-specific login and APIs are still evolving. This app includes API URL config and a health ping. Extend with `expo-router`, staff auth, and schedule/appointment screens as endpoints become available.

## Prerequisites

- Node 20+ (LTS)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) / `npx expo`
- Optional: [EAS CLI](https://docs.expo.dev/eas/) for cloud builds (`npm i -g eas-cli`)

## Local development

```bash
cd staff-app
cp .env.example .env
# Edit .env – on a real phone use your machine's LAN IP, not localhost

npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android/iOS) or press `a` / `i` for emulators.

## Environment

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Full API base, e.g. `https://your-api.domain/api/v1` |

Set in `.env` for local dev. For **EAS Build**, define the same in [EAS secrets / env](https://docs.expo.dev/build-reference/variables/).

## Expo.dev & EAS (not Coolify)

Native apps are built with **EAS Build** on Expo’s infrastructure, not Docker on Coolify:

1. Create/link project: `npx eas init` (or connect repo at [expo.dev](https://expo.dev)).
2. Set `EXPO_PUBLIC_API_URL` for **preview** and **production** builds in the Expo dashboard or `eas secret:create`.
3. **Development build:** `eas build --profile development --platform android` (or `ios`).
4. **Preview APK/IPA:** `eas build --profile preview --platform android`.

Coolify continues to host **API + web**; the staff app ships via **Expo / stores** (or internal distribution).

## Project layout

```
staff-app/
  app.config.js    # App name, bundle ids, EXPO_PUBLIC_* via env
  App.tsx          # Entry UI
  src/
    config/env.ts   # API URL resolution
    lib/api.ts      # Fetch helpers (expand here)
```

## Align with monorepo

Root `package.json` includes optional scripts; install from repo root:

```bash
npm run install:staff
```

(If that script is not present, run `cd staff-app && npm install`.)
