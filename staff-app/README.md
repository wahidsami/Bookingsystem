# Rifah Staff (Expo)

Native mobile app for salon and spa staff members.

This app now supports:

- staff email/password sign-in
- persisted staff sessions
- today overview
- appointment list and detail
- staff-side appointment actions
- schedule, breaks, and time-off view
- in-app password change

It uses the same backend base as the rest of the system: `/api/v1`.

## Prerequisites

- Node 20+
- Expo CLI via `npx expo`
- optional: EAS CLI for cloud builds

## Local development

```bash
cd staff-app
cp .env.example .env
npm install
npx expo start
```

Use a real API URL in `.env`.

## Environment

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Full backend URL, including `/api/v1` |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Expo project id used by EAS builds |

Example production API:

```env
EXPO_PUBLIC_API_URL=https://rapi.unifinitylab.com/api/v1
```

## Build and checks

```bash
npm run typecheck
npx expo start
```

## EAS

This app is built with Expo/EAS, not Coolify.

- preview/internal Android build:
  `eas build --profile preview --platform android`
- preview/internal iOS build:
  `eas build --profile preview --platform ios`
- production Android build:
  `eas build --profile production --platform android`
- production iOS build:
  `eas build --profile production --platform ios`

## Notes

- staff credentials are provisioned from the tenant dashboard employee screens
- if a staff member forgets their password before store-ready recovery flows exist, the tenant can reset it from the dashboard
