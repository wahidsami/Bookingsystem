# RifahStaff (Expo)

Staff mobile app for Refah.

## Local Start

```bash
npm install
npx expo start --clear
```

## API URL Configuration

The app uses this priority:

1. `EXPO_PUBLIC_API_URL` (from `.env` or EAS env)
2. `expo.extra.apiUrl` in `app.json`
3. fallback default in code

For production builds, set:

```env
EXPO_PUBLIC_API_URL=https://rapi.unifinitylab.com/api/v1
```

For local Expo Go, set your LAN backend URL:

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:5000/api/v1
```

## EAS Build

```bash
eas build --profile preview --platform android
eas build --profile production --platform android
```

Before building, ensure EAS environment variables include:

- `EXPO_PUBLIC_API_URL`

## Notes

- Babel config is required for `expo-router` and worklets plugins.
- App requests use a 15s timeout to avoid indefinite startup hangs when API is unreachable.
