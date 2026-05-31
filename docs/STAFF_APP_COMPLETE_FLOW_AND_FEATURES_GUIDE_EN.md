# Refah Staff App - Complete Functional Guide (EN)

## 1) Scope
This document describes the active Staff mobile app implementation in:
- `RifahStaff/`

It covers:
- app launch and splash behavior
- authentication flow
- role/feature-based access
- all tab sections and detail pages
- available actions and screen-level features

## 2) Startup Flow (Splash to Main App)

## 2.1 Root initialization
File: `RifahStaff/app/_layout.tsx`

On launch, the app initializes in this order:
1. `i18n` bootstrap
2. Cairo fonts load (`@expo-google-fonts/cairo`)
3. Language context restore
4. Auth session restore
5. Push notification listeners setup
6. Expo splash is hidden only when all required loading is complete

While boot is in progress, a centered loading spinner is shown.

## 2.2 Splash behavior
- Native Expo splash is kept visible via `SplashScreen.preventAutoHideAsync()`.
- It is hidden only when:
  - fonts are loaded (or font error handled), and
  - auth context finished loading, and
  - language context finished loading.

There is no custom visual “splash screen component”; it is controlled at root layout level.

## 2.3 Global providers
Wrapped at root:
- `AppErrorBoundary`
- `LanguageProvider`
- `AuthProvider`

## 3) Auth & Route Guarding Logic

## 3.1 Auth storage and restore
File: `RifahStaff/src/context/AuthContext.tsx`

Session tokens are stored in `expo-secure-store`:
- `refah_staff_access_token`
- `refah_staff_refresh_token`

On app start:
- if token exists, app calls `/staff/me`
- if valid, user session is restored
- if invalid, tokens are deleted and user is treated as logged out

## 3.2 Protected routing
Auth guard uses Expo Router segments:
- unauthenticated users are redirected to `/(auth)/login`
- authenticated users are redirected away from auth screens to `/(tabs)`
- if `must_change_password = true`, user is forced to `/(auth)/change-password`

## 3.3 API auth handling
File: `RifahStaff/src/services/api.ts`

- Axios request interceptor injects bearer token.
- On 401, refresh token flow calls `/staff/auth/refresh-token`.
- If refresh fails, app falls back to auth flow.

## 4) Authentication Screens

Auth stack file: `RifahStaff/app/(auth)/_layout.tsx`
Screens:
- `login`
- `change-password`
- `forgot-password`
- `reset-password`

## 4.1 Login
File: `RifahStaff/app/(auth)/login.tsx`

Contains:
- email input
- password input
- forgot password link
- sign-in button with loading state

Behavior:
- POST `/staff/auth/login`
- requires `accessToken`, `refreshToken`, and `staff` payload
- successful sign-in updates `AuthContext` and route guard moves user into tabs

## 4.2 Change Password (forced or optional)
File: `RifahStaff/app/(auth)/change-password.tsx`

Contains:
- current password
- new password
- confirm new password
- submit button
- first-login warning if `must_change_password` is true

Behavior:
- PATCH `/staff/me/password`
- on success updates user (`must_change_password=false`) and routes to `/(tabs)`

## 4.3 Forgot Password
File: `RifahStaff/app/(auth)/forgot-password.tsx`

Current behavior is guidance-based (no public self-reset API):
- asks for staff email
- confirms that staff should contact manager/admin for reset
- returns to login

## 4.4 Reset Password
File: `RifahStaff/app/(auth)/reset-password.tsx`

Current behavior:
- informational screen directing staff to manager-supported reset process
- button routes back to reset-help flow

## 5) Main Navigation Structure

## 5.1 Tabs
File: `RifahStaff/app/(tabs)/_layout.tsx`

Configured tabs:
- `schedule` (default initial tab)
- `notifications`
- `messages`
- `profile`
- `earnings` (conditional)
- `reviews` (conditional)

Hidden/internal tabs:
- `index` redirects to schedule
- `explore` is hidden (template/dev screen)

## 5.2 RBAC and feature gates
File: `RifahStaff/src/utils/capabilities.ts`

Visibility and actions are controlled by user permissions/features:
- `canViewEarnings`
- `canViewReviews`
- `canReplyToReviews`
- `canViewMessages`
- `canViewNotifications`
- `canRequestTimeOff`
- `canViewClients`
- `canViewBookingNotes`
- `canStartService`
- `canMarkNoShow`

## 6) Schedule Section (Core Staff Workspace)

File: `RifahStaff/app/(tabs)/schedule.tsx`

This is the richest operational screen.

## 6.1 Data loaded
- schedule range (shifts, breaks, time off): `getSchedule(startDate, endDate)`
- appointments per selected date: `getAppointmentsForDate(date)`
- week appointments cache for week mode

## 6.2 View modes
Schedule supports:
- `Layout`: Grid (default) or Cards
- `Scope`: Day or Entire Week
- configurable visible week range (1-4 weeks, constrained by admin limit from `scheduleVisibilityWeeks`)
- grid scaling percentage for density/readability

## 6.3 Navigation controls
- previous/next period navigation
- jump to today
- selected day highlight
- week horizontal snapping in week mode

## 6.4 Shift and break rendering
Shows:
- shifts (start/end)
- break windows (including labeled breaks)
- approved time-off overlays

## 6.5 Appointment rendering
For each appointment card:
- customer name + avatar (if available)
- service name and time
- booking/payment indicators
- urgency/status labels
- notes indicator (if permission allows)

## 6.6 Appointment status actions
Based on status and permissions, staff can perform:
- Check in / Start service / Complete
- Mark no-show
- Cancel

Backend mapping:
- started -> `in_service`
- no-show -> `no_show`
- complete -> `completed`

## 6.7 Client profile access
If `canViewClients` is enabled, staff can open client profile from appointment context.

## 6.8 Time-off management
If `canRequestTimeOff` is enabled:
- “Request Time Off” opens modal form
- upcoming requests can be canceled (with confirmation)

## 6.9 Live behavior
- refresh on screen focus
- refresh on app foreground
- periodic refresh timer (~45s)
- pull-to-refresh

## 7) Time-Off Request Modal

File: `RifahStaff/app/(modals)/request-time-off.tsx`

Fields:
- leave type: vacation/sick/personal/training/other
- start date
- end date
- reason (optional)

Validation:
- end date cannot be before start date

Submit:
- `submitTimeOffRequest(startDate, endDate, type, reason)`

## 8) Messages Section

File: `RifahStaff/app/(tabs)/messages.tsx`

Purpose:
- dedicated inbox for admin/tenant messages

Features:
- loads messages from `/staff/messages`
- keeps only admin-type sender messages
- stats cards: total/unread/pinned/recent
- search by subject/body
- filters: all, unread, pinned, recent
- unread indicator and pinned badge
- message detail navigation
- mark-as-read on open (`POST /staff/messages/:id/read`)

## 9) Notifications Section

File: `RifahStaff/app/(tabs)/notifications.tsx`

Purpose:
- dedicated system notifications tab (separated from admin messages)

Features:
- loads same message source but excludes admin-type senders
- unread styling
- opens detail page
- marks unread items as read on open

## 10) Message Detail Page

File: `RifahStaff/app/message/[id].tsx`

Shows:
- subject
- pinned indicator
- timestamp
- full message body

If payload parse fails, shows fallback error + back action.

## 11) Profile Section

File: `RifahStaff/app/(tabs)/profile.tsx`

Shows:
- avatar (or fallback icon)
- name + email
- tenant badge info

Settings/actions:
- change password
- language selector modal
- notifications preferences placeholder (currently not backend-enabled)
- logout

Language picker:
- supports multiple languages
- persists language
- applies RTL for Arabic/Urdu
- can trigger app reload for direction/font updates

## 12) Earnings Section

File: `RifahStaff/app/(tabs)/earnings.tsx`

Visible only when permissions/features allow.

Features:
- current cycle hero card with net pay and cycle status
- earnings summary cards:
  - total earned
  - commission
  - tips
  - base salary
  - bonuses
  - deductions
- payroll history list with status filters:
  - all / paid / processed / pending(draft)
- expandable payroll item details

Data source:
- `getEarnings()` from financial services

## 13) Reviews Section

File: `RifahStaff/app/(tabs)/reviews.tsx`

Visible only when reviews capability is enabled.

Features:
- average rating summary
- review distribution (5..1 stars)
- stats cards (total / need reply / 5-star / low-rated)
- search and filter chips
- review list with timestamps
- reply action (if `canReplyToReviews`) via modal

Reply API:
- `replyToReview(reviewId, text)`

## 14) Client Profile Detail

File: `RifahStaff/app/client/[id].tsx`

Accessed from Schedule appointment context when permitted.

Includes:
- customer identity and contact
- visit/spend/loyalty metrics
- notes and tags
- visit signals (last visit, avg value, no-shows, cancellations)
- recent appointments list with status badges

## 15) Push Notifications Behavior

Hook: `RifahStaff/src/hooks/usePushNotifications.ts`

Behavior:
- registers Expo push token on login (`registerFcmToken`)
- sets Android notification channel
- handles foreground notifications with haptics/vibration
- routes on notification tap:
  - appointment-related -> `/(tabs)/schedule`
  - other -> `/(tabs)/notifications`

## 16) Date/Time and Regional Formatting

Core schedule uses Riyadh-centric utilities:
- date keys
- week boundaries
- long/month/day labels
- Riyadh-based comparisons

This ensures consistent operational scheduling for KSA timezone.

## 17) Hidden/Template Routes

- `/(tabs)/explore` exists from Expo template; hidden from tab bar and not operational business flow.
- `/(tabs)/index` redirects to `/(tabs)/schedule`.

## 18) End-to-End User Journey (Staff)

1. App launches -> splash retained during font/language/auth restoration.
2. If no valid session -> Login.
3. If `must_change_password=true` -> forced Change Password.
4. After valid auth -> Tabs open on Schedule.
5. Staff manages day/week workload:
   - shift visibility
   - appointments
   - status updates
   - breaks/time off
6. Staff uses Messages for admin communications and Notifications for system events.
7. Optional tabs (Earnings/Reviews) appear only if granted.
8. Profile handles language, password, and logout.

## 19) Quick Route Map

Root:
- `app/_layout.tsx`

Auth:
- `/(auth)/login`
- `/(auth)/change-password`
- `/(auth)/forgot-password`
- `/(auth)/reset-password`

Tabs:
- `/(tabs)/schedule`
- `/(tabs)/notifications`
- `/(tabs)/messages`
- `/(tabs)/profile`
- `/(tabs)/earnings` (conditional)
- `/(tabs)/reviews` (conditional)

Detail/Modal:
- `/message/[id]`
- `/client/[id]`
- `/(modals)/request-time-off`
