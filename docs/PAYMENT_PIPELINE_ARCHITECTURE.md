# Refah Payment Pipeline Architecture

This document serves as the canonical reference for the Refah payment and financial transaction pipeline. All future development involving checkout flows, wallet operations, and gift cards **must** adhere to these architectural principles.

## 1. Core Financial Entities
The payment architecture strictly decouples raw payment processing from commercial tracking and business intelligence. Every purchase generates a cascade of records:

1. **`PaymentTransaction`**
   - **Purpose:** Represents the actual movement of funds (Cash, Credit Card, Wallet, Split).
   - **Relationship:** Belongs to a primary order or appointment entity. Contains metadata about how the user paid.
2. **`Transaction`**
   - **Purpose:** Represents the commercial sale from the Tenant's perspective. Tracks Revenue and Platform Fees.
   - **Relationship:** Associated with `PlatformUser` and `Tenant`. Used for tenant dashboard reporting.
3. **`FinancialLedgerEntry`**
   - **Purpose:** Immutable double-entry bookkeeping ledger. Every `PaymentTransaction` and `Transaction` inserts an entry here.
   - **Relationship:** Used to compute current wallet balances and track granular historical credit/debit flow.
4. **`Wallet` / `TenantWallet`**
   - **Purpose:** The derived total balance available to a `PlatformUser` or `Tenant`. Computed by summing their respective ledger entries.
5. **`Settlement`**
   - **Purpose:** Tracks the status of payouts from the Refah platform to a specific Tenant for a given transaction.

---

## 2. Platform Identity Guidelines
The system relies on a rigid identity boundary. Mixing operator accounts with customer accounts causes data corruption and foreign key violations.

- **`platformUserId` / `customerId`**: Must **always** point to a valid `PlatformUser.id` (Customer).
- **`tenantId`**: Must **always** point to a valid `Tenant.id`.
- **`tenantAccountId` / `operatorAccountId`**: Represents the POS operator (Manager/Staff). This is **never** the customer.
- **`staffId`**: The employee rendering a service. **Not** the financial buyer.

**Critical Rule:** Walk-in or external customers must be explicitly provisioned as Guest `PlatformUser` records (e.g. via `resolveCustomer()`). Never assign a `tenantAccountId` to a `platformUserId` field as a fallback.

---

## 3. Transaction Boundaries & Atomicity
Payment logic frequently spans multiple tables and side effects.
- **Atomicity:** All checkout flows must execute within a unified `Sequelize.transaction()`. If the ledger creation, wallet update, or core record fails, the **entire** transaction must roll back.
- **Model Hooks:** `PaymentTransaction` and `Transaction` utilize `afterCreate` and `afterSave` model hooks to automatically write `FinancialLedgerEntry` records.

### The Golden Rule of Model Hooks
Any `try/catch` block inside a Sequelize model hook (`afterCreate`, `afterSave`, etc.) **MUST** explicitly re-throw the caught exception. Swallowing an error inside a hook breaks Sequelize's transactional integrity, resulting in phantom records and "silent successes" where the API returns 200 OK while failing to credit the ledger.

```javascript
// ✅ CORRECT PATTERN
afterCreate: async (record, options) => {
    try {
        await someAuxiliaryAction(record, options.transaction);
    } catch (error) {
        console.error('Action failed:', error);
        throw error; // Re-throw to trigger parent rollback
    }
}
```

---

## 4. Notification & Side-Effect Sequencing
External side-effects (e.g., sending emails via Resend, SMS, push notifications, or receipt generation) cannot be undone once executed.

**Critical Rule:** Never trigger an external side effect until the database transaction is fully and permanently committed. 

```javascript
// ✅ CORRECT PATTERN
const t = await sequelize.transaction();
try {
    await db.Order.create({...}, { transaction: t });
    await t.commit(); // Transaction ends here
    
    // SAFE: The DB is committed, safe to send email
    await notifyCustomer(); 
} catch (error) {
    await t.rollback();
    throw error;
}
```

---

## 5. Checkout Sequence Flows

### 5.1. Product Checkout Flow
1. **Initialize:** Start `sequelize.transaction()`.
2. **Identity:** Validate or create `PlatformUser` via `resolveCustomer()`.
3. **Core Entities:** Create `Order` and `OrderItems`.
4. **Payment Entities:** 
   - Create `PaymentTransaction` for each payment method used (cash, card, wallet).
   - Hook triggers: Inserts `FinancialLedgerEntry` for wallet payments (debit).
5. **Commercial Entities:** 
   - Create `Transaction` (Sale).
   - Hook triggers: Inserts `FinancialLedgerEntry` for tenant revenue (credit).
   - Create `CustomerInvoice`.
6. **Commit:** `transaction.commit()`.
7. **Side Effects:** Trigger `notifyCustomer()` and push notifications.

### 5.2. Gift Card Checkout Flow
1. **Initialize:** Start `sequelize.transaction()`.
2. **Identity:** Provision Guest `PlatformUser` for recipient if external.
3. **Core Entities:** Create `TenantGiftCardTransaction`.
4. **Payment Entities:** 
   - Create `PaymentTransaction` (cash/card). 
   - Hook triggers: Ledger entry.
5. **Commercial Entities:**
   - Create `Transaction` (Wallet Top-up).
   - Hook triggers: Ledger entry (Customer wallet credit).
   - Create `TenantGiftCardSettlement`.
6. **Commit:** `transaction.commit()`.
7. **Side Effects:** Dispatch Claim Token via email / SMS.

---

## 6. Common Pitfalls for Future Developers

1. **The Phantom Customer Error:**
   *Pitfall:* Assigning `req.userId` (the tenant operator) as the `customerId` during a Walk-in POS checkout because the customer is "unregistered".
   *Solution:* Always use `resolveCustomer()` to provision an anonymous `PlatformUser` record for walk-ins.

2. **The Hook Blackhole:**
   *Pitfall:* Catching an error in `afterCreate` and calling `console.error` but failing to `throw error`. The API returns 200, the POS prints a receipt, but the customer's wallet is not credited.
   *Solution:* Always append `throw error` inside hook `catch` blocks.

3. **The Premature Notification:**
   *Pitfall:* Triggering `resend.emails.send` inside the `try` block before calling `await tx.commit()`. If the commit fails due to a constraint violation, the user still receives an email for a purchase that didn't happen.
   *Solution:* Move all notification and external logging calls below `await tx.commit()`.
