# 🛠️ Missing Features Implementation Guide

## Quick Overview

This guide provides step-by-step instructions to add the missing features to your admin dashboard.

---

## 1. 🔴 CRITICAL: Email Notifications for Approvals

### Why It's Important
Tenants need to know if their registration was approved/rejected!

### Implementation (30 mins)

#### Step 1: Check Email Service
```bash
# Check if email service exists
ls server/src/services/ | grep -i email
# Or search for nodemailer/sendgrid setup
```

#### Step 2: Update Admin Tenant Controller
**File**: `server/src/controllers/adminTenantsController.js`

```javascript
const emailService = require('../services/emailService'); // Add this

exports.approveTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // Update tenant status
    const tenant = await Tenant.findByPk(id);
    tenant.status = 'approved';
    await tenant.save();

    // 🆕 SEND EMAIL NOTIFICATION
    await emailService.sendEmail({
      to: tenant.email,
      subject: 'Your Business Registration is Approved!',
      template: 'tenant-approved',
      data: {
        tenantName: tenant.name,
        approvalNotes: notes,
        loginUrl: `${process.env.FRONTEND_URL}/tenant/login`,
        timestamp: new Date().toISOString(),
      }
    });

    // 🆕 LOG ACTIVITY
    await ActivityLog.create({
      action: 'tenant_approved',
      actor: req.admin.id,
      resource: 'tenant',
      resourceId: tenant.id,
      details: { notes },
    });

    return res.json({ success: true, tenant });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.rejectTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const tenant = await Tenant.findByPk(id);
    tenant.status = 'rejected';
    await tenant.save();

    // 🆕 SEND REJECTION EMAIL
    await emailService.sendEmail({
      to: tenant.email,
      subject: 'Your Business Registration - Action Required',
      template: 'tenant-rejected',
      data: {
        tenantName: tenant.name,
        rejectionReason: reason,
        contactEmail: process.env.SUPPORT_EMAIL,
      }
    });

    return res.json({ success: true, tenant });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
```

#### Step 3: Create Email Templates
**File**: `server/src/templates/emails/tenant-approved.html`

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background-color: #4CAF50; color: white; padding: 20px; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .button { background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Congratulations!</h1>
    </div>
    <div class="content">
      <p>Hello {{tenantName}},</p>
      <p>Great news! Your business registration has been approved. You can now login to your dashboard and start managing your services.</p>
      <p><a href="{{loginUrl}}" class="button">Login to Dashboard</a></p>
      <p><strong>Approval Notes:</strong> {{approvalNotes}}</p>
      <p>Questions? Contact us at support@rifah.sa</p>
    </div>
  </div>
</body>
</html>
```

**Cost**: 30 minutes | **Impact**: High ⭐⭐⭐⭐⭐

---

## 2. 🔴 CRITICAL: Tenant Payout System

### Why It's Important
Without this, you can't pay tenants their earnings!

### Phase 1: Database Setup (15 mins)

#### Create Payout Tables
**File**: `server/src/migrations/XXXXXX_create_payouts.js`

```javascript
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Payouts table
    await queryInterface.createTable('payouts', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      tenantId: {
        type: Sequelize.UUID,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      period: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: '{ from: date, to: date }',
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed', 'rejected'),
        defaultValue: 'pending',
      },
      paymentMethod: {
        type: Sequelize.STRING,
        comment: 'bank_transfer, stripe, etc',
      },
      bankDetails: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      transactionId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      failureReason: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      processedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });

    // Payout batches
    await queryInterface.createTable('payout_batches', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      name: Sequelize.STRING,
      totalAmount: Sequelize.DECIMAL(15, 2),
      payoutCount: Sequelize.INTEGER,
      status: {
        type: Sequelize.ENUM('draft', 'scheduled', 'processing', 'completed'),
        defaultValue: 'draft',
      },
      scheduledDate: Sequelize.DATE,
      processedAt: Sequelize.DATE,
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('payout_batches');
    await queryInterface.dropTable('payouts');
  },
};
```

#### Run Migration
```bash
cd server
npx sequelize-cli db:migrate
```

### Phase 2: Backend API (60 mins)

#### Create Payout Service
**File**: `server/src/services/payoutService.js`

```javascript
const { Payout, PayoutBatch, Tenant, Transaction } = require('../models');

class PayoutService {
  // Calculate pending payout amount for a tenant
  static async calculatePendingAmount(tenantId, fromDate, toDate) {
    const transactions = await Transaction.findAll({
      where: {
        tenantId,
        status: 'completed',
        createdAt: { [Op.between]: [fromDate, toDate] },
        payoutStatus: null, // Not yet paid out
      },
    });

    const totalTenantRevenue = transactions.reduce((sum, t) => {
      return sum + parseFloat(t.tenantRevenue || 0);
    }, 0);

    return totalTenantRevenue;
  }

  // Create payout for single tenant
  static async createPayout(tenantId, fromDate, toDate) {
    const amount = await this.calculatePendingAmount(tenantId, fromDate, toDate);

    const payout = await Payout.create({
      tenantId,
      amount,
      period: { from: fromDate, to: toDate },
      status: 'pending',
    });

    return payout;
  }

  // Create batch payout (multiple tenants)
  static async createPayoutBatch(fromDate, toDate) {
    const tenants = await Tenant.findAll({
      where: { status: 'approved' },
    });

    let totalAmount = 0;
    const payouts = [];

    for (const tenant of tenants) {
      const amount = await this.calculatePendingAmount(tenant.id, fromDate, toDate);
      if (amount > 0) {
        payouts.push({
          tenantId: tenant.id,
          amount,
          period: { from: fromDate, to: toDate },
          status: 'pending',
        });
        totalAmount += amount;
      }
    }

    const batch = await PayoutBatch.create({
      name: `Payout ${new Date().toISOString().split('T')[0]}`,
      totalAmount,
      payoutCount: payouts.length,
      status: 'draft',
    });

    // Create all payouts
    await Payout.bulkCreate(payouts);

    return batch;
  }

  // Process payout (send money)
  static async processPayout(payoutId) {
    const payout = await Payout.findByPk(payoutId, {
      include: ['Tenant'],
    });

    payout.status = 'processing';
    await payout.save();

    try {
      // Call payment processor (Stripe, bank transfer, etc)
      const result = await this.processPayment(payout);

      payout.status = 'completed';
      payout.transactionId = result.id;
      payout.processedAt = new Date();
      await payout.save();

      // Mark transactions as paid out
      await Transaction.update(
        { payoutStatus: 'paid' },
        {
          where: {
            tenantId: payout.tenantId,
            createdAt: { [Op.between]: [payout.period.from, payout.period.to] },
          },
        }
      );

      return payout;
    } catch (error) {
      payout.status = 'failed';
      payout.failureReason = error.message;
      await payout.save();
      throw error;
    }
  }

  // Process batch payout
  static async processPayoutBatch(batchId) {
    const batch = await PayoutBatch.findByPk(batchId);
    batch.status = 'processing';
    await batch.save();

    const payouts = await Payout.findAll({
      where: { batchId },
    });

    const results = await Promise.allSettled(
      payouts.map(p => this.processPayout(p.id))
    );

    const completed = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    batch.status = completed === payouts.length ? 'completed' : 'partial';
    batch.processedAt = new Date();
    await batch.save();

    return { batch, completed, failed };
  }
}

module.exports = PayoutService;
```

#### Create Payout Controller
**File**: `server/src/controllers/payoutController.js`

```javascript
const PayoutService = require('../services/payoutService');
const { Payout, PayoutBatch } = require('../models');

exports.listPayouts = async (req, res) => {
  try {
    const { status, tenantId, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (tenantId) where.tenantId = tenantId;

    const payouts = await Payout.findAll({
      where,
      limit,
      offset: (page - 1) * limit,
      include: ['Tenant'],
      order: [['createdAt', 'DESC']],
    });

    const total = await Payout.count({ where });

    res.json({
      success: true,
      payouts,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createPayoutBatch = async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    const batch = await PayoutService.createPayoutBatch(
      new Date(fromDate),
      new Date(toDate)
    );

    res.json({ success: true, batch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.processPayout = async (req, res) => {
  try {
    const { id } = req.params;
    const payout = await PayoutService.processPayout(id);

    res.json({ success: true, payout });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getPayoutBatches = async (req, res) => {
  try {
    const batches = await PayoutBatch.findAll({
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, batches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
```

#### Add Routes
**File**: `server/src/routes/adminRoutes.js`

```javascript
// Add after existing routes:

// ===== PAYOUTS MANAGEMENT =====
router.get('/payouts', requirePermission('payouts', 'view'), payoutController.listPayouts);
router.get('/payouts/batches', requirePermission('payouts', 'view'), payoutController.getPayoutBatches);
router.post('/payouts/batch/create', requirePermission('payouts', 'manage'), payoutController.createPayoutBatch);
router.post('/payouts/:id/process', requirePermission('payouts', 'manage'), payoutController.processPayout);
```

### Phase 3: Frontend UI (120 mins)

#### Create Payout Pages
**Files to Create:**
```
admin/src/app/dashboard/payouts/
├── page.tsx             ← Payouts list
├── batches/
│   └── page.tsx         ← Batch management
└── [id]/
    └── page.tsx         ← Payout details
```

**Example**: `admin/src/app/dashboard/payouts/page.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";

interface Payout {
  id: string;
  tenantId: string;
  Tenant: { name: string };
  amount: number;
  status: string;
  period: { from: string; to: string };
  processedAt: string;
}

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetchPayouts();
  }, [statusFilter]);

  const fetchPayouts = async () => {
    try {
      const response = await adminApi.request(
        `/admin/payouts?status=${statusFilter}`,
        "GET"
      );
      if (response.success) {
        setPayouts(response.payouts);
      }
    } catch (error) {
      console.error("Failed to fetch payouts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayout = async (id: string) => {
    try {
      const response = await adminApi.request(
        `/admin/payouts/${id}/process`,
        "POST"
      );
      if (response.success) {
        fetchPayouts(); // Refresh list
      }
    } catch (error) {
      console.error("Failed to process payout:", error);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Tenant Payouts</h1>

      <div className="flex gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-2 text-left">Tenant</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2 text-left">Period</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((payout) => (
              <tr key={payout.id} className="border-b">
                <td className="px-4 py-3">{payout.Tenant.name}</td>
                <td className="px-4 py-3 text-right">
                  SAR {payout.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {new Date(payout.period.from).toLocaleDateString()} -
                  {new Date(payout.period.to).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge badge-${payout.status}`}>
                    {payout.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {payout.status === "pending" && (
                    <button
                      onClick={() => handleProcessPayout(payout.id)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Process
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Cost**: 2 hours | **Impact**: Critical ⭐⭐⭐⭐⭐

---

## 3. 🟡 MEDIUM: Employee Commission UI

### Implementation

#### Create Employee Pages
```
admin/src/app/dashboard/employees/
├── page.tsx        ← All employees list
└── [id]/
    └── page.tsx    ← Employee detail & commission settings
```

#### Add API Methods
```typescript
// admin/src/lib/api.ts

async getEmployees(tenantId?: string) {
  const query = tenantId ? `?tenantId=${tenantId}` : '';
  return this.request<{ success: boolean; employees: any[] }>(
    `/admin/employees${query}`
  );
}

async getEmployee(id: string) {
  return this.request<{ success: boolean; employee: any }>(
    `/admin/employees/${id}`
  );
}

async updateEmployeeCommission(id: string, commissionRate: number) {
  return this.request<{ success: boolean; employee: any }>(
    `/admin/employees/${id}`,
    'PUT',
    { body: { commissionRate } }
  );
}
```

**Cost**: 2-3 hours | **Impact**: Medium ⭐⭐⭐

---

## 4. 🟢 IMPLEMENTATION PRIORITY

### Week 1:
```
✓ Email notifications (30 mins) - Quick win, huge UX impact
✓ Test full approval flow with emails
```

### Week 2:
```
✓ Payout system database (15 mins)
✓ Payout service & controller (60 mins)
✓ Payout frontend pages (120 mins)
✓ Test payout creation and processing
```

### Week 3:
```
✓ Employee commission UI (3 hours)
✓ Advanced reporting features (4 hours)
```

---

## Quick Start - Do This First

### 1. Email Notifications (Today - 30 mins)
```bash
cd server/src/controllers
# Edit adminTenantsController.js
# Add the email sending code from Section 1
```

### 2. Create Migration Files
```bash
cd server
touch src/migrations/$(date +%s)_create_payouts.js
# Add payout tables code
npx sequelize-cli db:migrate
```

### 3. Test & Deploy
```bash
npm run dev  # Test locally
npm run build  # Build for production
```

---

**Total Implementation Time**: ~8-10 hours
**Priority**: Notifications (high), Payouts (critical), Others (medium)
**Recommendation**: Start with notifications this week, payouts next week!
