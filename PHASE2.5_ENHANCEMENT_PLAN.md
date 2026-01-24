# Phase 2.5 Enhancement - User Features & Fake Payments

**Date**: 2025-01-27  
**Approach**: Option B - Polish & Enhance User Features  
**Duration**: 1-2 weeks  
**Status**: Planning

---

## 🎯 Objectives

Enhance the user experience by adding:
1. **User Profile Management** (photo upload, edit profile)
2. **Booking History** (detailed view, services history)
3. **Fake Payment System** (mock payment for testing)
4. **Transaction History** (payment records)
5. **Payment Methods Management** (save/manage cards)
6. **Wallet & Loyalty** (balance, points, top-up)
7. **Settings & Preferences** (notifications, language)

---

## 📋 What We'll Build

### 1. User Profile Management ✅

#### Backend APIs:
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update profile
- `POST /api/v1/users/profile/photo` - Upload profile photo
- `PUT /api/v1/users/password` - Change password

#### Frontend Pages:
- `/dashboard/profile` - Edit profile page
  - Photo upload
  - Edit name, email, phone
  - Change password
  - Update preferences

#### Features:
- ✅ Profile photo upload (local storage or cloud)
- ✅ Edit personal information
- ✅ Change password
- ✅ Update preferences (language, notifications)

---

### 2. Booking History & Services History ✅

#### Backend APIs:
- `GET /api/v1/users/bookings` - All bookings (already exists)
- `GET /api/v1/users/bookings/:id` - Booking details
- `GET /api/v1/users/services-history` - Services used across all salons

#### Frontend Pages:
- `/dashboard/bookings` - Enhanced booking history
  - Timeline view
  - Filter by salon, date, status
  - Booking details modal
  - Services history per salon

#### Features:
- ✅ All bookings across all salons
- ✅ Booking details (service, staff, price, salon)
- ✅ Services history (what services user booked)
- ✅ Filter and search
- ✅ Cancel bookings

---

### 3. Fake Payment System 💳

#### Backend APIs:
- `POST /api/v1/payments/fake-payment` - Process fake payment
- `POST /api/v1/payments/create-intent` - Create payment intent
- `GET /api/v1/payments/history` - Payment history

#### Frontend Pages:
- `/booking/payment` - Fake payment page
  - Card number input (fake validation)
  - Expiry date, CVV
  - Cardholder name
  - Process payment button

#### Features:
- ✅ Fake card validation (format only)
- ✅ Mock payment processing
- ✅ Create transaction record
- ✅ Update booking status to "paid"
- ✅ Redirect to confirmation

#### Fake Card Numbers (for testing):
- `4242 4242 4242 4242` - Success
- `4000 0000 0000 0002` - Declined
- `4000 0000 0000 9995` - Insufficient funds

---

### 4. Transaction History 💰

#### Backend APIs:
- `GET /api/v1/users/transactions` - All transactions
- `GET /api/v1/users/transactions/:id` - Transaction details
- `GET /api/v1/users/transactions/receipt/:id` - Download receipt

#### Frontend Pages:
- `/dashboard/payments` - Payment history
  - Transaction list
  - Filter by date, type, status
  - Transaction details
  - Download receipts

#### Features:
- ✅ All transactions (bookings, refunds, top-ups)
- ✅ Transaction details
- ✅ Receipt generation (PDF)
- ✅ Filter and search

---

### 5. Payment Methods Management 💳

#### Backend APIs:
- `GET /api/v1/users/payment-methods` - List payment methods
- `POST /api/v1/users/payment-methods` - Add payment method
- `DELETE /api/v1/users/payment-methods/:id` - Remove payment method
- `PUT /api/v1/users/payment-methods/:id/set-default` - Set default

#### Frontend Pages:
- `/dashboard/payment-methods` - Manage cards
  - List saved cards
  - Add new card
  - Set default card
  - Delete card

#### Features:
- ✅ Save payment methods (fake cards)
- ✅ Multiple cards per user
- ✅ Set default payment method
- ✅ Delete payment methods
- ✅ Card security (last 4 digits only)

---

### 6. Wallet & Loyalty 💎

#### Backend APIs:
- `GET /api/v1/users/wallet` - Get wallet balance
- `POST /api/v1/users/wallet/topup` - Top up wallet
- `GET /api/v1/users/loyalty-points` - Get loyalty points
- `POST /api/v1/users/loyalty-points/redeem` - Redeem points

#### Frontend Pages:
- `/dashboard/wallet` - Wallet & loyalty
  - Wallet balance
  - Top-up wallet
  - Loyalty points
  - Points history
  - Redeem points

#### Features:
- ✅ Wallet balance display
- ✅ Top-up wallet (fake payment)
- ✅ Loyalty points display
- ✅ Points redemption
- ✅ Transaction history

---

### 7. Settings & Preferences ⚙️

#### Backend APIs:
- `GET /api/v1/users/settings` - Get settings
- `PUT /api/v1/users/settings` - Update settings
- `PUT /api/v1/users/notifications` - Update notification preferences

#### Frontend Pages:
- `/dashboard/settings` - Settings page
  - Notification preferences
  - Language selection
  - Privacy settings
  - Account settings

#### Features:
- ✅ Notification preferences (email, SMS, WhatsApp, push)
- ✅ Language selection (English/Arabic)
- ✅ Privacy settings
- ✅ Account management

---

## 🗂️ File Structure

### Backend Files to Create:
```
server/src/
├── controllers/
│   ├── userController.js          (profile, settings)
│   ├── paymentController.js       (fake payments)
│   └── transactionController.js    (transaction history)
├── services/
│   ├── paymentService.js          (fake payment processing)
│   ├── fileUploadService.js       (photo upload)
│   └── receiptService.js          (PDF generation)
└── routes/
    ├── userRoutes.js              (user profile APIs)
    ├── paymentRoutes.js            (payment APIs)
    └── transactionRoutes.js       (transaction APIs)
```

### Frontend Files to Create:
```
client/src/app/
├── dashboard/
│   ├── profile/
│   │   └── page.tsx               (edit profile)
│   ├── bookings/
│   │   ├── page.tsx                (enhanced booking history)
│   │   └── [id]/
│   │       └── page.tsx            (booking details)
│   ├── payments/
│   │   ├── page.tsx                (payment history)
│   │   └── methods/
│   │       └── page.tsx            (payment methods)
│   ├── wallet/
│   │   └── page.tsx                (wallet & loyalty)
│   └── settings/
│       └── page.tsx                (settings)
└── booking/
    └── payment/
        └── page.tsx                (fake payment page)
```

---

## 🎨 UI/UX Features

### Profile Page:
- Profile photo with upload button
- Edit form (name, email, phone, DOB, gender)
- Change password section
- Save button

### Booking History:
- Timeline view
- Filter by salon, date, status
- Booking cards with details
- Cancel button
- View details modal

### Payment Page:
- Fake card form
- Card number (with formatting)
- Expiry date, CVV
- Cardholder name
- Process payment button
- Success/error messages

### Transaction History:
- List of transactions
- Filter by type, date
- Transaction details
- Download receipt button

### Wallet & Loyalty:
- Wallet balance card
- Top-up button
- Loyalty points display
- Points history
- Redeem button

---

## 🔧 Implementation Plan

### Week 1: Core Features

**Day 1-2: User Profile**
- Backend: Profile APIs
- Frontend: Profile page with photo upload

**Day 3-4: Booking History Enhancement**
- Backend: Enhanced booking APIs
- Frontend: Detailed booking history page

**Day 5: Fake Payment System**
- Backend: Fake payment service
- Frontend: Payment page

### Week 2: Additional Features

**Day 6-7: Transaction History**
- Backend: Transaction APIs
- Frontend: Transaction history page

**Day 8-9: Payment Methods**
- Backend: Payment method APIs
- Frontend: Payment methods page

**Day 10-11: Wallet & Loyalty**
- Backend: Wallet APIs
- Frontend: Wallet page

**Day 12-13: Settings**
- Backend: Settings APIs
- Frontend: Settings page

**Day 14: Testing & Polish**
- Test all features
- Fix bugs
- UI/UX improvements

---

## 📊 Success Criteria

### Functional:
- ✅ User can upload profile photo
- ✅ User can edit profile
- ✅ User can view detailed booking history
- ✅ User can make fake payments
- ✅ User can view transaction history
- ✅ User can manage payment methods
- ✅ User can top-up wallet
- ✅ User can view loyalty points

### Technical:
- ✅ All APIs working
- ✅ Photo upload working
- ✅ Fake payment processing
- ✅ Transaction recording
- ✅ Secure data handling

---

## 🚀 Ready to Start!

**Next Steps:**
1. Start with User Profile (photo upload + edit)
2. Enhance Booking History
3. Build Fake Payment System
4. Add remaining features

**Let's build this, Captain!** 🎯

