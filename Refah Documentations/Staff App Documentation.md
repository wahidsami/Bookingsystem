# Refah Staff App Documentation

Date: 2026-05-19

## 1. Platform Tech Details
- Application: Staff mobile app for Refah operations
- Stack: Expo, React Native, TypeScript
- Package path: `staff-app/package.json`
- Runtime: Expo-managed mobile app for iOS, Android, and web
- Key libraries: `expo-notifications`, `expo-secure-store`, `react-native`
- Build / start commands:
  - `cd staff-app && npm run start`
  - `cd staff-app && npm run android`
  - `cd staff-app && npm run ios`
  - `cd staff-app && npm run web`

## 2. What It Is
The Staff App is the mobile operational companion for salon and service center staff.
It is designed to help employees manage their day, work through appointments, and update their own account settings.
It is intentionally limited to staff workflow and does not expose tenant or admin configuration screens.

### Target User
- Service providers
- Barbershop staff
- Receptionists / front desk operators
- In-center employees who handle appointments and check-ins

## 3. What It Can Do Today
- Authenticate staff members with email and password
- Show a staff dashboard overview with today’s appointment metrics
- Display the full list of today’s appointments
- View appointment details and customer contact information
- Change appointment status to:
  - Check In
  - Start Service
  - Complete
  - No Show
  - Cancel
- Display the daily schedule, breaks, and time-off records
- Enable or disable push notifications locally
- Change staff password
- Logout from the app

## 4. Current Visible Sections
The current live app exposes four main tabs after staff sign in:

### 4.1 Sign In Screen
What it contains:
- `Rifah Staff` branding and sign-in header
- Email input field
- Password input field
- `Sign In` primary button
- API base endpoint display
- `Ping API` secondary button for connectivity check
- Health status message area

How it looks:
- Light-themed sign-in card with rounded corners
- Teal primary action button
- Supporting metadata and endpoint info below the login form

### 4.2 Overview Tab
What it contains:
- Tenant business name and staff welcome message
- Current date display
- Refresh button to reload staff data from the API
- Tab navigation row with four visible tabs:
  - Overview
  - Appointments
  - Schedule
  - Profile
- Metrics cards for:
  - Total appointments
  - Active appointments
  - Completed appointments
- `Next appointment` summary card
- `Today at a glance` schedule summary card showing working windows or time off status

How it looks:
- White metric cards on a soft gray background
- Bold titles with teal highlights
- Concise cards with key shift information

### 4.3 Appointments Tab
What it contains:
- A list of today’s appointments
- Each appointment item includes:
  - Customer name
  - Appointment status badge
  - Service name
  - Appointment time range
  - Payment status and price
- Appointment detail panel for the selected appointment with:
  - Customer name and contact
  - Service name
  - Appointment time window
  - Status
  - Payment state and amount
  - Notes
- Available action buttons based on current appointment status  - `Check In`, `No Show`, `Cancel` for pending/confirmed bookings
  - `Start Service`, `No Show`, `Cancel` for checked-in bookings
  - `Complete`, `Cancel` for in-service bookings
How it looks:
- Simple vertical appointment list with tappable cards
- Selected appointment highlighted with a pale green background
- Detail panel below the list with clear metadata and actions
- Action buttons grouped horizontally for quick access

### 4.4 Schedule Tab
What it contains:
- `Shifts` section showing working shift windows
- `Breaks` section showing scheduled breaks
- `Time off` section showing any recorded staff time off

How it looks:
- Separate white cards for Shifts, Breaks, and Time off
- Each item displays formatted start/end times and labels
- Empty state text appears when no schedule data exists for the date

### 4.5 Profile Tab
What it contains:
- Staff profile details:
  - Name
  - Email
  - Phone
  - Tenant business name
  - Tenant city
  - Commission rate
  - Rating
- Push notifications toggle with status text
- Password change form:
  - Current password input
  - New password input
  - `Update Password` button
- `Logout` button

How it looks:
- White profile card with stacked profile lines
- Notification toggle section in a separate panel
- Password change fields clearly spaced
- Secondary logout button at the bottom

## 5. Current Visible Feature Details
### Sign In
- Secure employee login form
- Connectivity test using the Ping API button
- Local error display for missing credentials or failed login

### Overview
- Dashboard-style summary of the staff shift
- Next appointment preview
- Quick visibility of whether the staff has a working shift or time off
- Manual refresh control

### Appointments
- View the complete list of appointments for the selected date
- Tap an appointment to view detail information
- See customer contact fields and notes
- Perform lifecycle actions with status-aware buttons:
  - `Check In` for pending/confirmed bookings
  - `Start Service` for checked-in bookings
  - `Complete` for in-service bookings
  - `No Show` and `Cancel` in applicable states

### Schedule
- See working shift blocks for the day
- Review breaks and break labels
- See any time off records for the selected date

### Profile
- View authenticated staff and tenant context
- Toggle push notifications on or off per device
- Change password securely within the app
- Logout from the staff session

## 6. Hidden / Non-Visible Sections Today
These sections are not currently exposed in the visible app UI:
- Messages / internal inbox
- Earnings / payroll summary
- Reviews / feedback management

## 7. Operational Notes
- The current staff app is focused on practical daily execution rather than broad staff product features.
- Visible sections are intentionally limited to the core staff workflow: overview, appointments, schedule, and profile.
- Profile is the only section that offers settings controls today.
- Because the app is currently a compact staff workspace, additional staff pages are not visible or available in the current release.
