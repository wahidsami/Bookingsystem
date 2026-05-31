# Testing with Expo Go (no EAS credits)

This project is currently set up to run in **Expo Go** so you can test without using EAS build credits.

## What was changed for Expo Go

- **newArchEnabled**: set to `false` (Expo Go is more reliable with old architecture).
- **experiments.reactCompiler**: removed (can cause issues in Expo Go).

## How to run

```bash
# Same WiFi as your phone:
npm run start:go

# Or use tunnel (works from anywhere):
npm run start:tunnel
```

Then scan the QR code with the **Expo Go** app.

## When you're ready for production APK again

1. In `app.json`, set `"newArchEnabled": true` if you want the new architecture.
2. In `app.json` → `experiments`, add back `"reactCompiler": true` if you use it.
3. Run `eas build` as before.
