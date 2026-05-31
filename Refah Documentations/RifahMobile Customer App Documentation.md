# RifahMobile Customer App Documentation

Date: 2026-05-19

## 1. Platform Tech Details
- Application: `RifahMobile` customer mobile app
- Stack: Expo, React Native, TypeScript
- Package path: `RifahMobile/package.json`
- Runtime: Expo-managed React Native app for iOS, Android, and web
- Key libraries: React Navigation, Axios, Expo Notifications, Secure Store
- Build / start commands:
  - `cd RifahMobile && npm run start`
  - `cd RifahMobile && npm run android`
  - `cd RifahMobile && npm run ios`
  - `cd RifahMobile && npm run web`

## 2. What It Is
`RifahMobile` is the customer-facing mobile application for the Refah platform.
It provides discovery, booking, payment, and account management features for end customers.

### Target User
- Salon or spa customers
- Service buyers
- Loyalty members
- Mobile-first shoppers

## 3. What It Can Do
- Browse salons and service providers
- Discover hot deals and promotions
- Search and filter tenants, services, or providers
- Book services and products
- Track appointments and order history
- Manage profile, payment methods, and notifications
- View wallet balance and transaction history
- Receive booking and payment notifications

## 4. Sections and Structure
The app is organized into key customer workflows:

### 4.1 Home / Discovery
- Hot deals and featured offers
- Trending tenants and new centers
- Category browsing
- Promotional banners and quick booking actions

### 4.2 Tenant / Service Detail
- Tenant public page and branding
- Service list and pricing
- Staff/ provider profiles and availability
- Reviews and ratings
- Booking eligibility and payment options

### 4.3 Booking Flow
- Select service and time slot
- Choose a staff provider or automatic assignment
- Add personal details and booking notes
- Review pricing and deposit requirements
- Complete booking confirmation

### 4.4 Cart / Purchases
- Review selected services or products
- Checkout with saved payment methods
- Retry failed payments
- View order and purchase summary

### 4.5 Bookings
- Upcoming appointments list
- Past booking history
- Booking status and details
- Payment state for each booking

### 4.6 Notifications
- Appointment updates
- Payment confirmations
- Promotional messages
- System alerts

### 4.7 Profile
- Personal details and contact info
- Language settings and app preferences
- Password change flow
- Avatar and profile updates

### 4.8 Wallet and Payment Methods
- Saved payment cards or wallets
- Current wallet balance
- Transaction and payment history
- Payment method management

### 4.9 More / Support
- Help and contact pages
- Privacy policy and terms
- About the app
- Social links and app settings

## 5. Available Features by Section
### Home / Discovery
- Browse hot deals and promotions
- Search tenants and services
- View service categories
- Open detailed tenant offers

### Tenant / Service Detail
- View tenant description and images
- View service details, duration, and price
- Review staff qualifications and ratings
- Access booking widget from tenant page
- See active hot deals and available time slots

### Booking Flow
- Choose service, date, and time
- Select provider or allow auto-assign
- Provide customer details
- Confirm booking
- Proceed to payment if required

### Cart / Purchases
- Review selected booking items
- Confirm checkout details
- Retry or complete pending payments
- Track purchase history

### Bookings
- See upcoming appointment list
- Track past bookings and statuses
- Open booking details
- Verify payment and booking notes

### Notifications
- Receive booking confirmation messages
- Follow changes to appointment status
- Get promotional messages from tenants

### Profile
- Update name, email, phone, and password
- Set preferred language
- Manage notification preferences

### Wallet / Payment
- Store secure payment methods
- Check wallet balance
- Review transaction history
- Manage payment settings

### More / Support
- Access app help resources
- View policy and terms content
- Check app version and support contact

## 6. Operational Notes
- `RifahMobile` is designed for customer discovery and booking.
- It is currently an Expo-managed mobile app with React Native.
- Connects to the Refah backend for booking, payment, and profile synchronization.
- Ideal for customers who want a mobile-first experience and loyalty tracking.
