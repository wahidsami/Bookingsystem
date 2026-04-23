# Comprehensive Business Requirements Document

**Refah / Rifah Booking System**

This document captures the current product scope from a business and operational point of view. It covers the three core applications:

1. **Tenant Dashboard**
2. **Customer App**
3. **Staff App**

The goal is to give owners and stakeholders one clear reference for what the system does today, how the major sections are grouped, and how the apps connect to each other.

---

## 1) System Overview

The platform serves three main user groups:

- **Tenant owner / admin**: manages services, staff, appointments, collections, marketing, reports, and settings.
- **Customer**: discovers tenants, books, pays, and tracks bookings, purchases, and notifications.
- **Staff member**: manages the daily work queue, starts and completes appointments, and reviews assigned tasks based on permissions.

### Applications

| App | Purpose |
|---|---|
| Tenant Dashboard | Day-to-day operational and financial management of the center |
| Customer App | Discovery, booking, ordering, payments, and account tracking |
| Staff App | Daily work execution, appointment handling, and communication |

---

## 2) Tenant Dashboard: Current Business Scope

The tenant dashboard is the center’s operating system. It is not only a reporting layer; it is the place where the business is managed.

### 2.1 Home / Command Center

The home page is a compact launchpad and currently includes:

- `Open POS`
- `Appointments`
- a default landing page toggle
- outstanding payment summary
- urgent collection alerts
- today’s KPI cards
- a staff snapshot
- today-vs-yesterday comparison
- a short list of appointments that need attention

### 2.2 Services

Service management includes:

- create service
- edit service
- hide / archive / remove according to policy
- bilingual content
- pricing, duration, commission, and margin configuration
- service-to-staff mapping

### 2.3 Catalog

The catalog is grouped into:

- Services
- Products
- Orders

### 2.4 Staff

Staff management includes:

- create staff member
- edit staff member
- profile image
- skills and bio
- employment and availability setup
- permissions and visible roles

### 2.5 Schedules

The scheduling area includes:

- shifts
- breaks
- time off
- schedule overrides
- daily and weekly availability

### 2.6 Appointments

This is one of the most important sections and includes:

- list view
- calendar / board view
- drag and drop between staff columns
- right-click actions to add appointments or blocked time
- appointment drawer with details
- customer data inside the same drawer
- rebook
- reschedule
- status updates
- payment updates

### 2.7 POS / Collections

This section focuses on immediate money movement:

- open POS
- receive payment
- review due balances
- handle walk-in or on-arrival collections

### 2.8 Customers

Customer management includes:

- customer list
- customer detail
- bookings history
- financial history
- notes
- total bookings and spending

### 2.9 Marketing

The marketing group contains:

- hot deals
- customer push notifications
- reviews

### 2.10 Billing & Finance

This group includes:

- My Bills
- My Subscription
- Financial

And shows:

- invoices
- subscription status
- revenue
- collections
- due balances
- financial reports

### 2.11 Reports

Reporting includes:

- summary dashboards
- revenue views
- staff performance
- service performance
- peak-time analysis
- customer analytics

### 2.12 Settings

Settings include:

- business information
- working hours
- booking rules
- notifications
- payment settings
- language
- appearance
- default landing page

### 2.13 My Page / Public Presence

This area contains the tenant’s public-facing identity and account-oriented pages.

### 2.14 Subscription

The subscription controls:

- access to features
- staff limits
- hot-deal limits
- feature entitlement availability

---

## 3) Customer App: Current Business Scope

The customer app is the end-user experience from discovery to booking and after-sales tracking.

### 3.1 Home Screen

The home screen includes:

- hot deals
- newly added tenants
- categories
- trending tenants
- top service providers

### 3.2 Browse Tenants

Customers can:

- search tenants
- open tenant pages
- view services
- view staff
- view ratings and summary data

### 3.3 Booking Flow

The booking flow includes:

- choose service
- choose staff or center
- choose time
- confirm the booking
- continue to payment if needed

### 3.4 Cart and Purchases

This area supports:

- service or product cart
- checkout
- payment retry
- purchase tracking

### 3.5 Bookings

The bookings area shows:

- upcoming bookings
- past bookings
- booking status
- booking details

### 3.6 Notifications

The customer receives:

- booking notifications
- payment notifications
- marketing notifications
- internal app alerts

### 3.7 Profile

The profile area covers:

- personal information
- avatar
- language
- notification preferences
- password updates

### 3.8 Wallet and Payment Methods

This area includes:

- saved payment methods
- wallet
- payment history

### 3.9 More / Support Pages

The app also includes:

- support
- about
- privacy and terms
- social links

---

## 4) Staff App: Current Business Scope

The staff app focuses on daily execution.

### 4.1 Today / Home Tab

This tab shows:

- today’s appointments
- current status
- start service
- complete service
- no-show handling
- search and filtering

### 4.2 Schedule Tab

This tab shows:

- weekly schedule
- appointments
- availability

### 4.3 Messages Tab

This tab shows:

- internal messages
- message details
- staff communication

### 4.4 Earnings Tab

This tab shows:

- earnings
- performance snapshot
- income summary where allowed

### 4.5 Reviews Tab

This tab shows:

- customer reviews
- rating feedback

### 4.6 Profile Tab

This tab contains:

- staff profile
- account settings
- personal preferences

---

## 5) Business Rules

### 5.1 Entitlement-Based Access

Some features depend on the subscription package, such as:

- hot deals
- internal messaging
- payroll
- reports
- public page customization
- push notifications

### 5.2 Permissions

Not every section is visible to every role. The system uses:

- tenant permissions
- staff permissions
- admin permissions

### 5.3 Localization

The platform supports:

- Arabic
- English

### 5.4 Appointment and Payment Context

Appointments can carry:

- appointment status
- payment status
- customer details
- staff details
- service details
- notes
- rebooking and rescheduling actions

---

## 6) Executive Summary

The system covers the full operating cycle of a center:

1. customer discovery
2. booking
3. appointment execution
4. payment collection
5. financial tracking
6. marketing
7. reporting
8. team management

This is a complete operating platform, not just a booking tool.

---

## 7) Full Tenant Feature Set When All Entitlements Are Enabled

This section lists the tenant-facing modules available when the admin grants the tenant every supported feature.

### 7.1 Command Center

- Home page
- `Open POS`
- `Appointments`
- default landing page switch
- KPI tiles
- collection alerts
- staff snapshot
- comparison strip

### 7.2 Catalog

- Services
- Products
- Orders

**Subpages:**

- list page
- create page
- edit page
- detail page

### 7.3 Operations

- Staff
- Schedules
- Appointments
- POS / Collections
- Customers

**Important subpages:**

- add staff
- edit staff
- appointment board
- appointment detail drawer
- customer workspace drawer
- blocked time creation
- daily schedule view

### 7.4 Marketing

- Hot Deals
- Customer Push
- Reviews

**Subpages:**

- create hot deal
- edit hot deal
- hot deal detail
- new push notification
- reviews list

### 7.5 Billing and Finance

- My Bills
- My Subscription
- Financial
- Payroll

**Subpages:**

- bill detail
- subscription detail
- upgrade flow
- payroll summary

### 7.6 Analytics and Reporting

- Reports
- report generation
- report preview

### 7.7 Public Presence

- My Page / public page
- branding customization
- hero and cover assets
- public page settings

### 7.8 Communication and Support

- Messages
- Notifications
- support-related communication

### 7.9 Operational Settings

- booking rules
- working hours
- notifications
- language
- payments
- appearance
- default landing page

