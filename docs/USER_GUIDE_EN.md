# Complete User Guide

This guide explains the main pages and subpages for:

1. **Tenant Dashboard**
2. **Customer App**
3. **Staff App**

It is written as a practical tutorial, so a user can understand not only what each page does, but also how to complete the most important tasks.

---

## 1) Tenant Dashboard Tutorial

### 1.1 Home / Command Center

This is the first page a tenant may see after login, depending on the default landing page setting.

#### What you see

- `Open POS`
- `Appointments`
- default landing page selector
- payments due
- urgent alerts
- today’s KPI tiles
- staff snapshot
- today-vs-yesterday comparison
- appointments that need attention

#### What to do here

1. Review the due amount.
2. Check urgent alerts.
3. Open POS if you need to collect money immediately.
4. Open Appointments if you need to manage the schedule.
5. Choose the default landing page if your center wants a different starting point.

---

### 1.2 Services

#### Main page

This page lists all services with their status, price, duration, and actions.

#### Subpages

- `services/new`
- `services/[id]`

#### How to use it

1. Open **Services**.
2. Click **Add New** to create a service.
3. Fill in the Arabic and English names.
4. Add the description, price, duration, and image.
5. Save the service.
6. Open an existing service to edit it when the price or details change.

#### What to check before publishing a service

- Is the name correct in both languages?
- Is the price correct?
- Is the duration realistic?
- Is the service active?

---

### 1.3 Staff

#### Main page

The staff list shows all employees and their current status.

#### Subpages

- `employees/new`
- `employees/[id]`

#### How to use it

1. Open **Employees**.
2. Add a new staff member if the center hires someone new.
3. Upload the photo.
4. Fill in the profile, skills, and job title.
5. Save the staff member.
6. Open the staff detail page to edit the profile or permissions later.

#### Important note

For the appointments board, only staff members with the proper service-provider role should appear.

---

### 1.4 Schedules

#### Main page

This page manages shifts, breaks, time off, and overrides.

#### How to use it

1. Open **Schedules**.
2. Choose the staff member.
3. Add a shift for the day or week.
4. Add breaks if needed.
5. Mark time off or exceptions when the staff member is unavailable.

#### Why this matters

The appointment board uses this data to decide who can be booked and when.

---

### 1.5 Appointments

#### Main page

The appointments page is the center’s live work board.

#### Subpages

- `appointments/new`
- `appointments/[id]`

#### How to use the board

1. Open **Appointments**.
2. Use the slider to change the grid size.
3. Right-click inside a staff column to add a new appointment or blocked time.
4. Drag an appointment card from one staff column to another to reassign the provider.
5. Click a card to open the details drawer.

#### Appointment details drawer

Inside the drawer you can:

- read the appointment summary
- open the customer workspace
- rebook
- reschedule
- check payment state

#### Customer workspace inside the drawer

When you open the customer profile from the drawer:

1. Use **Back** to return to the appointment details.
2. Check **Overview** for basic information.
3. Open **Appointments** to see the booking history.
4. Open **Transactions** to see payments, refunds, and appointment-derived payment records.

#### Best practice

Use the board for operational work, and use the drawer for detail work.

---

### 1.6 POS / Collections

#### Main page

This is where the tenant handles due balances and immediate collections.

#### How to use it

1. Open **POS / Collections**.
2. Search the customer or due item.
3. Select the amount to collect.
4. Record the payment method.
5. Save the transaction.

#### What it is for

- cash collection
- payment follow-up
- due balance clearance
- manual recording when no gateway is used

---

### 1.7 Customers

#### Main page

This page lists all customers for the tenant.

#### Subpages

- `customers/[id]`

#### How to use it

1. Open **Customers**.
2. Select a customer to open the workspace drawer.
3. Review **Overview**, **Appointments**, and **Transactions**.
4. Use the transaction list to understand what the customer has paid, refunded, or still owes.

#### What the customer workspace is for

- quick customer review
- payment checking
- booking history review
- notes and account context

---

### 1.8 Hot Deals

#### Main page

Lists all hot deals created by the tenant.

#### Subpages

- `hot-deals/new`
- `hot-deals/[id]`

#### How to use it

1. Open **Hot Deals**.
2. Create a deal only if the package allows it.
3. Fill in the service, price, dates, and discount.
4. Check the validity range carefully.
5. Save the deal.
6. If a deal is wrong after it goes live, pause it first, edit it, then republish it.

#### Important note

The customer app only shows deals that are within the valid date range and active state.

---

### 1.9 Marketing / Push Notifications / Reviews

#### Customer Push

Use this to send notifications to app users.

Steps:

1. Open **Customer push**.
2. Create the message.
3. Choose the audience.
4. Send or schedule it.

#### Reviews

Use this to read customer feedback and monitor service quality.

---

### 1.10 Billing & Finance

#### Main pages

- My Bills
- My Subscription
- Financial
- Payroll

#### How to use them

1. Open **My Bills** to review invoices.
2. Open **My Subscription** to see the current plan and upgrade options.
3. Open **Financial** to review revenue, collections, and balances.
4. Open **Payroll** if your package includes payroll visibility.

---

### 1.11 Reports

#### Main page

This area gives business summaries and analytics.

#### Subpages

- `reports/generate`
- `reports/preview`

#### How to use it

1. Open **Reports**.
2. Choose the report type.
3. Generate the report.
4. Preview the result.
5. Use the summary to understand service, staff, and booking performance.

---

### 1.12 Settings

#### What you can change

- business details
- working hours
- booking settings
- notifications
- payment settings
- localization
- appearance
- default landing page

#### How to use it

1. Open **Settings**.
2. Review each section before changing it.
3. Save business or booking changes carefully.
4. Set the default landing page if the center wants to open on Appointments or POS instead of Home.

---

### 1.13 My Page

Use this section to manage the tenant’s public-facing presence and branding.

---

### 1.14 Subscription

Use this section to review the current plan, limits, and upgrade path.

---

## 2) Customer App Tutorial

### 2.1 Home Screen

This is the customer discovery page.

#### What you see

- hot deals
- new tenants
- categories
- trending tenants
- top providers

#### What to do

1. Browse the categories.
2. Open a tenant you like.
3. Check current hot deals before booking.

---

### 2.2 Browse and Tenant Detail

#### How to use it

1. Search for a tenant.
2. Open the tenant profile.
3. Review services, staff, ratings, and the public page.
4. Continue into booking when you are ready.

---

### 2.3 Booking Flow

#### Steps

1. Choose a service.
2. Choose a staff member if needed.
3. Pick the date and time.
4. Confirm the booking.
5. Continue to payment when required.

#### What happens after booking

- the booking is saved
- the customer can track it in the bookings tab
- payment records appear in purchases or transactions depending on the flow

---

### 2.4 Cart and Purchases

Use these pages to:

- review items before checkout
- complete payment
- retry failed payment
- see order history

---

### 2.5 Bookings

The bookings tab shows:

- upcoming appointments
- past appointments
- booking status
- booking details

#### What to do here

1. Open a booking to read the details.
2. Check the status and payment state.
3. Use it to confirm your upcoming visit.

---

### 2.6 Notifications

Use notifications to stay informed about:

- appointment updates
- payment changes
- promotions
- internal system alerts

---

### 2.7 Profile

Use the profile area to:

- update personal data
- change avatar
- adjust language
- edit notification preferences
- change password

---

### 2.8 Wallet and Payment Methods

Use these pages to:

- review saved payment methods
- inspect wallet balances
- check payment history

---

### 2.9 More / Support

The More screen includes:

- profile
- my appointments
- browse salons
- my purchases
- notifications
- settings
- help
- about
- privacy and terms

---

## 3) Staff App Tutorial

### 3.1 Today / Home Tab

This is the operational home for a staff member.

#### What you see

- today’s appointments
- status badges
- search bar
- status filters
- revenue summary

#### How to use it

1. Open today’s list.
2. Filter by appointment state.
3. Search by customer, service, or booking number.
4. Open an appointment to review the details.

#### Main actions

- Start service
- Complete service
- Mark no-show

---

### 3.2 Schedule Tab

Use this tab to:

- review your schedule
- see upcoming work
- understand availability

---

### 3.3 Messages Tab

Use this tab to:

- read internal messages
- open a message
- respond according to center policy

#### Message detail page

Steps:

1. Open a message.
2. Read the subject and body.
3. Go back to the message list when done.

---

### 3.4 Earnings Tab

Use this tab to:

- see earnings
- understand performance
- review income where the role allows it

---

### 3.5 Reviews Tab

Use this tab to:

- see customer reviews
- understand service feedback

---

### 3.6 Profile Tab

Use this tab to:

- review your information
- update personal preferences
- manage account settings

---

## 4) Complete Workflow Tutorials

### 4.1 Create a Service

1. Open **Services**.
2. Click **Add New**.
3. Enter English and Arabic names.
4. Add the description.
5. Set price and duration.
6. Upload the image.
7. Save.

### 4.2 Add a Staff Member

1. Open **Employees**.
2. Click **Add New**.
3. Enter the staff profile.
4. Upload the photo.
5. Set the role and availability.
6. Save.

### 4.3 Create an Appointment from the Board

1. Open **Appointments**.
2. Right-click inside the staff column.
3. Choose **Add new appointment**.
4. Fill in the drawer form.
5. Save the appointment.

### 4.4 Collect Payment

1. Open **POS / Collections**.
2. Find the due appointment or customer.
3. Open the payment action.
4. Record the paid amount and method.
5. Save.

### 4.5 Publish a Hot Deal Safely

1. Open **Hot Deals**.
2. Create or edit the deal.
3. Check the validity dates.
4. Pause it if it is already live and needs fixing.
5. Edit the paused deal.
6. Republish after verification.

### 4.6 Review a Customer in the Appointment Drawer

1. Open an appointment card.
2. Open the customer workspace.
3. Check **Overview**.
4. Check **Appointments**.
5. Check **Transactions**.
6. Go back to the appointment when finished.

