# Appointment Details Drawer and Customer Data Guide

## Purpose
This guide explains what appears when a tenant admin opens a booked appointment card from the appointments board and the side drawer opens, and it also documents the customer data structure behind that drawer in the database.

The goal is to give the team one clear reference for:
- what the appointment drawer shows
- what data is loaded into it
- where that data comes from in the database
- how the customer record is modeled in Refah

---

## 1) What Happens When an Appointment Card Is Clicked

When the tenant admin clicks a booked appointment card in the appointment board:

1. The side drawer opens.
2. The drawer loads the appointment details.
3. The drawer shows the appointment in the default `Appointment` view.
4. If the admin clicks the customer card, the same drawer switches to the `Customer workspace` view.

The drawer is not a separate page. It is a contextual side panel that can show:
- appointment-level details
- customer-level profile data
- customer appointment history
- customer payment/transaction history

---

## 2) Drawer Modes

The drawer has two main modes:

### A. Appointment View
This is the default mode when the drawer opens.

It focuses on:
- appointment status
- payment status
- time
- service
- staff
- price
- notes
- group guest details
- status actions
- rebook
- reschedule
- open full page

### B. Customer Workspace View
This mode opens when the admin clicks the customer card inside the drawer.

It focuses on:
- customer profile
- customer spending summary
- customer appointment history
- customer transactions
- customer notes and tags

The customer workspace is still inside the same drawer and uses the same underlying customer record.

---

## 3) Appointment Drawer: What It Shows

### Header
The drawer header shows:
- the drawer title, which changes by mode
  - `Appointment Details`
  - `Customer workspace`
- the service name or customer name
- the booking number or booking reference
- the close button

### Status Chips
At the top of the appointment view, the drawer shows:
- appointment status
- payment status
- reschedule marker, if the appointment was rescheduled
- cancellation marker, if the appointment was cancelled

### Core Appointment Fields
The main appointment block shows:
- start time
- end time
- service name
- staff member
- appointment price

### Customer Card
If the appointment has an attached platform user, the drawer shows a customer card with:
- profile image or initials
- first name
- last name
- an `Open profile` button

That button switches the drawer into the customer workspace view.

### Notes
If the appointment contains notes, the drawer shows them in a dedicated notes card.

The notes area may contain:
- free-text booking notes
- structured audit markers for reschedules or cancellations
- group guest metadata

The drawer sanitizes those markers before rendering the human-readable notes.

### Group Guest Details
If the booking contains group guest metadata, the drawer shows:
- guest full name
- guest phone
- guest service name
- whether the guest service is free

### Actions
The appointment drawer includes actions for:
- Rebook
- Reschedule
- Manual status update
- Open full page

### Full Page Link
The drawer also provides a direct link to the full appointment page in the tenant dashboard.

---

## 4) Customer Workspace: What It Shows

The customer workspace is a mini CRM view for the customer attached to the appointment.

### Overview Tab
The overview tab shows:
- total bookings
- total spent
- first visit
- last visit
- email
- phone
- gender
- preferred language
- customer notes
- customer tags

### Appointments Tab
The appointments tab shows the customer’s appointment history:
- service name
- appointment date
- end time
- status
- payment status
- staff member
- variant name, if any
- price

### Transactions Tab
The transactions tab shows the customer’s financial history:
- appointment payments
- order payments
- refunds
- ledger entries
- payment type
- transaction reference
- notes
- processor

It also includes filters for:
- transaction type
- transaction status

---

## 5) Appointment Data Stored in the Database

The appointment drawer is driven by the `appointments` table and related joins.

### Core Appointment Record
The appointment model contains fields such as:
- `id`
- `bookingNumber`
- `bookingReference`
- `serviceId`
- `staffId`
- `requestedStaffId`
- `platformUserId`
- `customerId` for legacy compatibility
- `tenantId`
- `serviceVariantId`
- `serviceVariantName`
- `serviceVariantDescription`
- `serviceVariantDuration`
- `bookingSessionId`
- `bookingItemIndex`
- `startTime`
- `endTime`
- `status`
- `paymentStatus`
- `paymentMethod`
- `price`
- `rawPrice`
- `taxAmount`
- `platformFee`
- `tenantRevenue`
- `employeeCommission`
- `remainderAmount`
- `notes`

### Related Appointment Joins
The appointment drawer can also use:
- `service`
- `staff`
- `user` / `PlatformUser`
- `legacyCustomer`
- payment transactions
- appointment events
- booking session

### Important Customer Link
For modern appointments, the main customer link is:
- `platformUserId`

For backward compatibility, the system can also still reference:
- `customerId`

---

## 6) What Customer Data Means in Refah

In Refah, a customer is primarily represented by the `PlatformUser` model.

That is the main customer record used by:
- appointments
- orders
- wallet balance
- payment methods
- transactions
- gift cards
- push notifications
- reviews

There is also a legacy `Customer` model that remains in the system for older appointment records and migration compatibility.

---

## 7) PlatformUser Model: General Customer Data

The `platform_users` table stores the main customer identity record.

### Identity Fields
- `id`
- `email`
- `phone`
- `password` for local auth
- `authProvider`
- `googleSub`
- `googleEmail`
- `firstName`
- `lastName`

### Personal Profile Fields
- `dateOfBirth`
- `gender`
- `profileImage`

### Address Fields
These are used mainly for delivery and contact flows:
- `addressStreet`
- `addressCity`
- `addressBuilding`
- `addressFloor`
- `addressApartment`
- `addressPhone`
- `addressNotes`

### Preferences
- `preferredLanguage`
- `notificationPreferences`

### Wallet and Loyalty
- `walletBalance`
- `loyaltyPoints`
- `totalSpent`
- `totalBookings`

### Verification and Auth State
- `emailVerified`
- `phoneVerified`
- `emailVerificationToken`
- `passwordResetToken`
- `passwordResetTokenExpiresAt`
- `phoneVerificationCode`
- `lastLogin`
- `refreshToken`
- `isActive`
- `isBanned`
- `banReason`

---

## 8) Legacy Customer Model

The legacy `customers` table still exists for compatibility.

Its main fields are:
- `id`
- `phone`
- `name`
- `email`
- `preferences`
- `totalSpent`
- `loyaltyPoints`
- `totalBookings`

This legacy model is still referenced by older appointment records through:
- `appointment.customerId`

In the current system, new customer flows should use `platformUserId`, but the legacy customer row is still supported while older data exists.

---

## 9) Customer Data That the Drawer Shows in Practice

When the customer workspace opens, the drawer does not just show raw columns.

It also shows customer data that is derived from their history:

- total bookings
- total spent
- first visit
- last visit
- no-show count
- cancellation count
- favorite services
- favorite products
- preferred staff
- preferred time
- loyalty tier
- loyalty points
- tags
- notes

Some of this is stored directly in the customer record.
Some of it is calculated from appointments, orders, transactions, or insights.

---

## 10) Customer-Related Tables in the Database

The customer record is connected to several other tables.

### Appointments
Linked through:
- `platformUserId`
- `customerId` for older records

Appointment history shows:
- service
- staff
- date
- status
- payment status
- price

### Orders
Linked through:
- `platformUserId`

Order history is used for:
- customer spending
- product purchases
- delivery info

### Transactions
Linked through:
- `platformUserId`

Transactions include:
- booking payments
- order payments
- refunds
- wallet movements
- ledger entries

### Payment Methods
Stored against the customer so the system can support saved payment behavior where enabled.

### Wallet Ledger Entries
Used to track wallet movements and balance changes.

### Gift Card Transactions
Used to track:
- sent gift cards
- received gift cards
- redeemed gift cards
- claim flows

### Customer Invoices
Used to track financial history and receivables for appointments and orders.

### Reviews
Linked so the system can show customer feedback history and review behavior.

---

## 11) What the Tenant Admin Can Learn From the Drawer

The drawer is meant to answer these questions quickly:

- Who is this customer?
- What service did they book?
- Is it paid?
- Is anything still due?
- Has this appointment been rescheduled or cancelled?
- Did the customer come before?
- How much have they spent overall?
- What transactions are linked to this customer?
- Is there a guest attached to the booking?
- Can I reschedule, rebook, or open the full page?

That is why the drawer combines both appointment data and customer data in one place.

---

## 12) Summary

When a booked appointment card is opened:

1. The side drawer opens with appointment details.
2. The drawer shows status, timing, service, staff, price, notes, and guest data.
3. The customer card lets the admin switch to the customer workspace.
4. The customer workspace shows profile, appointment history, and transactions.
5. The customer record comes from `PlatformUser` for modern data and `Customer` for legacy compatibility.
6. The drawer is backed by appointments, customer profiles, transactions, orders, wallet entries, gift cards, invoices, and reviews.

This is the current source of truth for how the appointment drawer and customer data work together in Refah.
