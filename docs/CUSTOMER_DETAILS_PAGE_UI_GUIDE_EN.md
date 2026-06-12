# Customer Details Page UI Guide

## Purpose
This guide documents the tenant dashboard customer details page UI, including the page layout, major cards, and the history tabs.

It is meant to be a visual and functional reference for:
- the customer profile header
- the editable profile card
- notes and tags
- wallet and gift card summary
- statistics and preferences
- the complete history section with tabs

---

## 1) Page Entry Point

The customer details page opens from the tenant Customers area.

It is used to inspect and update one customer record at a time.

The page supports:
- viewing customer profile data
- editing profile fields
- adding notes and tags
- checking wallet and gift card activity
- browsing history across appointments and purchases

---

## 2) Page Layout

The page is split into two main areas:

### Left Column
The left column focuses on the customer identity and account-side information.

It contains:
- profile card
- notes and tags card
- wallet and gifts card

### Right Column
The right column focuses on customer behavior and history.

It contains:
- statistics card
- preferences card
- complete history section

---

## 3) Header Area

At the top of the page, the UI shows:
- a back button
- the customer name
- a walk-in badge when the customer is a placeholder walk-in record
- the subtitle `Customer Details`

The header is the main anchor for the page and helps the admin quickly confirm who the record belongs to.

---

## 4) Profile Card

The profile card is the main editable customer card.

### What It Shows
- profile image or initials
- customer first name and last name
- loyalty tier badge
- loyalty points
- customer type badge, if available

### Profile Fields
The editable form can include:
- first name
- last name
- email
- phone
- date of birth
- gender
- preferred language

### Actions
- Edit profile
- Save
- Cancel

The card switches between view mode and edit mode without leaving the page.

---

## 5) Notes and Tags Card

This card is used to store freeform customer context.

### Notes Area
The admin can:
- read the current note
- edit the note
- save updates

### Tags Area
The admin can:
- add tags
- remove tags while editing
- save tag changes together with notes

This card is useful for internal customer context that should not be mixed with profile fields.

---

## 6) Wallet and Gifts Card

This card summarizes the customer's wallet and gift card activity.

### Summary Blocks
The UI shows:
- wallet live balance
- wallet ledger entry count
- gift cards sent
- gift cards received

### Links
The page includes a clickable entry point to the wallet history view.

### Wallet History Preview
If available, the card shows a short preview of recent wallet ledger entries.

### Gift Card History Preview
If available, the card shows a short preview of gift card transactions.

This area is the main bridge between customer profile data and financial customer activity.

---

## 7) Statistics Card

The statistics card shows customer lifetime metrics.

### Main Metrics
- total bookings
- total orders
- total spent
- completed bookings

### Purpose
This card gives the tenant a quick summary of customer value and engagement.

---

## 8) Preferences Card

The preferences card highlights repeated behavior patterns.

### Possible Data
- favorite services
- favorite products
- preferred staff
- preferred delivery type

### Purpose
This card helps the admin understand what the customer tends to book, buy, or prefer.

If there is no data, the page shows a no-data state instead of empty placeholders.

---

## 9) Complete History Section

This section is the main timeline area on the page.

It combines:
- appointment history
- purchase history

The history section has its own tabs and filters so the admin can move between record types without leaving the page.

### Tabs
The visible tabs are:
- All
- Appointments
- Purchases

### Status Filters
The page also supports status filters such as:
- All
- Completed
- Pending
- Cancelled

These filters apply to the currently selected history tab.

---

## 10) All Tab

The All tab is a combined timeline.

It merges:
- customer appointments
- customer purchases

This is useful when the admin wants one consolidated view of the customer's full activity.

The tab shows:
- item type icon
- service or order title
- staff for appointments
- date and time
- status badge
- amount

---

## 11) Appointments Tab

The Appointments tab shows appointment-only history.

### Each Row May Include
- service name
- staff member
- appointment date and time
- appointment status
- payment status context
- price

### Behavior
Clicking an appointment row opens the appointment details page for that booking.

The tab is ideal for:
- spotting repeat visits
- reviewing appointment status patterns
- jumping back into the booking record

---

## 12) Purchases Tab

The Purchases tab shows purchase-only history.

### Each Row May Include
- order number
- item count
- item preview chips
- order date and time
- delivery type
- status badge
- total amount

### Behavior
Clicking an order row currently shows a placeholder action in the UI.

The tab is useful for:
- reviewing spend history
- checking product purchases
- understanding order frequency

---

## 13) Empty States

The page uses friendly empty states when data is missing.

### Examples
- no notes added
- no wallet history yet
- no gift cards yet
- no appointments yet
- no purchases yet
- no history found

These states keep the page readable even for new or low-activity customers.

---

## 14) Walk-In Customer Handling

If the record is a walk-in or placeholder customer, the UI shows a special badge.

The page treats walk-in customers as normal customer records, but visually marks them so the admin can tell they were created without a fully known profile.

This is important because walk-in records can later be updated with:
- proper name
- email
- phone
- date of birth

---

## 15) UI Summary

The customer details page is structured as:

1. Header with back navigation and customer identity
2. Profile card for editable personal information
3. Notes and tags card for internal CRM context
4. Wallet and gifts card for balance and gift activity
5. Statistics card for lifetime metrics
6. Preferences card for repeated behavior signals
7. Complete history section with All, Appointments, and Purchases tabs

This makes the page a combined profile, CRM, wallet, and history view for the tenant admin.

