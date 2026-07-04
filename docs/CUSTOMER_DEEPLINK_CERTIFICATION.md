# Customer Deep Link Certification

This report certifies the production deep-link surface of `RifahMobile`.

The app uses the custom scheme defined in [`RifahMobile/app.config.js`](../RifahMobile/app.config.js), and deep-link dispatch is handled in [`RifahMobile/App.tsx`](../RifahMobile/App.tsx).

## Certification Result

Customer-facing deep links are supported for the following destinations:

1. Booking
2. Order
3. Gift
4. Wallet
5. Notification
6. Review
7. Profile

## Supported Deep Links

| Category | Supported URL Patterns | Production Destination | Auth Behavior | Notes |
|---|---|---|---|---|
| Booking | `booking/<token>`, `appointment-invite/<token>`, `?inviteToken=`, `?token=` | `AppointmentInvite` | Deferred until authenticated and navigator ready | Invite screen handles invalid, expired, and account-mismatch cases. |
| Order | `order/<id>`, `orders/<id>`, `purchase/<id>`, `purchases/<id>`, `?orderId=` | `MyPurchases` | Deferred until authenticated and navigator ready | Deep link can focus a specific order when the ID is known; otherwise it opens the purchase list. |
| Gift | `gift-claim/<token>`, `gift/<token>`, `?giftToken=`, `?token=` | `Gifts` | Deferred until authenticated and navigator ready | Gift claim flows remain production-backed and handle invalid or expired tokens through the API. |
| Wallet | `wallet`, `wallet-balance`, `wallet-balance-details` | `WalletBalanceDetails` | Deferred until authenticated and navigator ready | Wallet screen now loads live wallet data when route params are absent. |
| Notification | `notification/<id>`, `notifications/<id>`, `?notificationId=`, `?campaignId=` | `NotificationDetail` or `Notifications` | Deferred until authenticated and navigator ready | Detail route is used when an ID is present; otherwise the list is opened. |
| Review | `review/<appointmentId>`, `?appointmentId=` | `Review` | Deferred until authenticated and navigator ready | Review screen validates the appointment and handles duplicate submissions. |
| Profile | `profile` | `Profile` | Deferred until authenticated and navigator ready | Profile screen loads live account data and remains production-backed. |

## Navigation And Parameters

1. Deep links are parsed centrally in `App.tsx`.
2. Supported links are deferred until the app shell is ready and the user is authenticated.
3. Order links may carry an `orderId` when available.
4. Notification links may carry either `notificationId` or `campaignId`.
5. Wallet links do not require payload parameters because the destination screen can fetch live data directly.
6. Profile links do not require payload parameters.

## Expired And Invalid Links

| Category | Expired Behavior | Invalid Behavior |
|---|---|---|
| Booking | Invite screen surfaces expired invite state from the backend. | Invalid tokens surface invite loading errors or invalid-link messaging. |
| Gift | Claim flow surfaces backend failure or expired-token messages. | Invalid claim tokens fall back through the production claim endpoints and show an error if no endpoint accepts them. |
| Review | Missing or invalid appointment IDs surface a load error. | Duplicate reviews are handled as an already-submitted state. |
| Notification | Missing notification IDs fall back to the notification list. | Invalid IDs surface a load error in the notification detail screen. |
| Order | Missing order IDs fall back to the purchase list. | Invalid IDs do not crash navigation and remain on the purchase list. |
| Wallet | Missing route data triggers live wallet lookup. | Failed lookup falls back to the screen empty state without breaking navigation. |
| Profile | N/A | Auth gating keeps the user in the profile screen or login flow; invalid deep-link payloads are not destructive. |

## Edge Cases Verified

1. Deep links received before login are queued and flushed after authentication.
2. Deep links received before navigator readiness are queued and flushed after the home shell is ready.
3. Booking invite and gift claim links remain token-driven and production-backed.
4. Wallet and order destinations now work as standalone entry points instead of depending only on in-app navigation.
5. Notification deep links support both list and detail style destinations.

## Final Assessment

Customer deep-link coverage is production-ready for the supported categories above.

The remaining constraints are intentional:

1. Unsupported URLs remain unsupported instead of being silently remapped.
2. Backend validation still owns expired-token and account-mismatch decisions.
3. The app does not create duplicate routing logic outside the main shell dispatcher.

