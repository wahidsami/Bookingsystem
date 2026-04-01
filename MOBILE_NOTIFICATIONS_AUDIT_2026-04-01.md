# Mobile Notifications Audit - 2026-04-01

## Scope
- `RifahMobile` customer native app
- `staff-app` native staff app
- backend support in `server`

## What Existed Before This Pass
- No real push notification implementation in either mobile app
- No Expo push token registration in the apps
- No backend table for device tokens
- No authenticated endpoints for registering/unregistering device tokens
- No real push sender for booking, payment, order, or staff events
- Customer app still had one unrelated live regression:
  - `TopProvidersSection` was calling the retired `/api/v1/staff` route

## What This Batch Added

### Backend
- Added `MobilePushToken` model to store active Expo push tokens
- Added shared `pushNotificationService`
- Added customer push-token endpoints:
  - `POST /api/v1/users/push-token`
  - `DELETE /api/v1/users/push-token`
- Added staff push-token endpoints:
  - `POST /api/v1/staff/me/push-token`
  - `DELETE /api/v1/staff/me/push-token`
- Added safe push dispatch hooks for:
  - booking creation
  - booking cancellation
  - booking payment confirmation
  - booking status changes from tenant dashboard
  - booking status changes from staff app
  - order creation
  - order payment updates
  - order status updates
  - order cancellation

### Customer App (`RifahMobile`)
- Added Expo notification handling and permission flow
- Registers push token after authenticated session becomes active
- Unregisters push token on logout
- Added foreground notification presentation handler
- Fixed the home `Top Providers` section to use a real public endpoint

### Staff App (`staff-app`)
- Added Expo notification handling and permission flow
- Registers push token after staff login/session restore
- Unregisters push token on logout
- Added foreground notification presentation handler

## Verification Completed
- `RifahMobile` TypeScript check passed
- `staff-app` TypeScript check passed
- changed backend files passed `node --check`

## Remaining Real-Device Validation
- Physical-device permission prompt on iOS and Android
- Expo push token generation on real devices
- Delivery of customer notifications for:
  - booking created
  - booking paid
  - order created
  - order paid
  - order status updated
- Delivery of staff notifications for:
  - newly assigned appointment
  - customer cancellation
- Logout cleanup:
  - token is marked inactive on backend

## Important Notes
- Push notifications now have real plumbing, but final confidence still requires device testing through Expo/EAS.
- If `EXPO_PUBLIC_EAS_PROJECT_ID` is missing or incorrect for a build, token registration may be skipped.
- Notification send failures are intentionally non-blocking and should never break booking or purchase flows.
