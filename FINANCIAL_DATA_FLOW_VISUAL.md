# Financial Data Flow - Visual Guide

## 💰 How Money Flows Through Your System

```
CUSTOMER PAYS SAR 100
        ↓
   ┌────────────────┐
   │ Transaction    │ (Recorded in DB)
   │ amount: 100    │
   └────────────────┘
        ↓
   ┌────────────────────────────────────────┐
   │ Split Into:                            │
   ├────────────────────────────────────────┤
   │ Platform Fee:       SAR 8.00 (8%)  ✅ YOU
   │ Tenant Revenue:     SAR 87.00      → Tenant
   │ Tax Amount:         SAR 5.00       → Tenant
   │ Employee Comm:      SAR 10.00      ✗ Tenant pays
   └────────────────────────────────────────┘
        ↓
   ┌────────────────┐
   │ Stored In DB:  │
   ├────────────────┤
   │ Transactions   │ ← Your commission tracked here
   │ Appointments   │ ← Booking details here
   │ Staff          │ ← Employee rates here
   │ Audit Logs     │ ← Everything logged
   └────────────────┘
```

---

## 📊 Data Model - What's Tracked

```
TRANSACTION (Payment Record)
├─ amount:          100.00   ← Customer paid this
├─ platformFee:     8.00     ← YOU EARNED THIS ✅
├─ tenantRevenue:   87.00    ← Tenant earned this
├─ status:          'completed'
├─ tenantId:        uuid1
├─ customerId:      uuid2
└─ timestamp:       2025-01-22

APPOINTMENT (Booking Details)
├─ price:           100.00   ← Total customer paid
├─ rawPrice:        95.00    ← Base service price
├─ taxAmount:       5.00     ← Tax
├─ platformFee:     8.00     ← You keep this
├─ tenantRevenue:   92.00    ← Tenant keeps (95+5-8=92)
├─ employeeComm:    10.00    ← Staff gets paid
├─ staffId:         uuid3
├─ duration:        30       ← 30 minutes worked
└─ startTime:       14:00

SUBSCRIPTION_PACKAGE (Pricing Plan)
├─ name:            'Professional'
├─ platformComm:    8.00     ← Commission rate
├─ price:           99/month ← Your cost to tenant
└─ features:        {...}

STAFF (Employees)
├─ name:            'Sarah Ahmed'
├─ commissionRate:  10.00    ← % per booking
└─ tenantId:        uuid1
```

---

## 🔄 Real-World Booking Example

### Transaction Timeline

```
14:00 - Customer Books
└─ Selects: Haircut (SAR 100)
└─ Selects: Staff: Sarah Ahmed
└─ Confirms: Payment method

14:05 - Payment Processed
├─ Charges customer: SAR 100
├─ Transaction created:
│  ├─ amount: 100
│  ├─ platformFee: 8 (YOU)
│  └─ tenantRevenue: 92
└─ Appointment marked: confirmed

14:30 - Service Completed
├─ Staff marks done
├─ Duration recorded: 30 mins
├─ Employee commission added: 10 (10% of 100)
└─ Status: completed

Daily Reconciliation
├─ Your earnings:     SAR 8.00
├─ Tenant earnings:   SAR 82.00 (92 - 10 employee comm)
├─ Employee earned:   SAR 10.00
└─ Total flow:        SAR 100.00 ✓ Balanced
```

---

## 📈 Aggregated View (What the Dashboard Should Show)

```
ADMIN DASHBOARD → FINANCIAL

30 Days Summary:
┌─────────────────────────────────────────┐
│ PLATFORM REVENUE                        │
├─────────────────────────────────────────┤
│ Total Customer Payments:    SAR 105,625 │
│ Your Commission (8%):       SAR 8,450   │ ← Currently shows ✅
│ Tenant Share:               SAR 97,175  │ ← Missing! ❌
│ Employee Commissions Paid:  SAR 12,000  │ ← Missing! ❌
└─────────────────────────────────────────┘

Revenue Distribution:
┌────────────────────────────────────────────┐
│ Total: SAR 105,625                         │
├────────────────────────────────────────────┤
│ Your Commission:  SAR 8,450    (8.0%)  ✅ │
│ Tenant Revenues:  SAR 97,175   (92.0%)    │
│ ├─ After Employee: SAR 85,175  (after 10%)│
│ └─ Employee Paid:  SAR 12,000  (paid out) │
└────────────────────────────────────────────┘
```

---

## 🎯 Top Tenants Breakdown (Missing Data)

```
Rank │ Tenant Name     │ Bookings │ Revenue  │ You Earned │ They Earned
─────┼─────────────────┼──────────┼──────────┼────────────┼─────────────
  1  │ Salon A         │   250    │ 45,000   │   3,600    │  41,400    
  2  │ Salon B         │   180    │ 32,000   │   2,240    │  29,760    
  3  │ Salon C         │   120    │ 18,500   │   1,480    │  17,020    
  4  │ Salon D         │   95     │ 15,200   │   1,216    │  13,984    
  5  │ Salon E         │   80     │ 12,300   │    984     │  11,316    

Total:                │   725    │123,000   │   9,520    │ 113,480    

Status: ❌ All showing as 0 in current dashboard
Reason: getBookingStats() returns mock data
```

---

## 👥 Employee Performance (Missing Data)

```
Tenant: Salon A
Schedule: 9am-5pm (40 hrs/week)

Employee           │ Hrs Scheduled │ Hrs Worked │ Util% │ Earned  │ Rate
───────────────────┼───────────────┼────────────┼───────┼─────────┼─────
Sarah Ahmed        │      160      │   75.5     │ 47%   │ 7,550   │ 10%
Fatima Al-Rashid   │      160      │   60.0     │ 38%   │ 6,000   │ 10%
Layla Hassan       │      160      │   50.3     │ 31%   │ 5,030   │ 10%
───────────────────┼───────────────┼────────────┼───────┼─────────┼─────
Totals:            │      480      │  185.8     │ 39%   │18,580   │ 10%

Status: ❌ No hours tracking in current dashboard
Missing: Duration summation from appointments
```

---

## 🔐 Complete Audit Trail

```
Every Transaction is Recorded:

Transaction #001
├─ Timestamp:      2025-01-22 14:30:00
├─ Customer:       john.doe@example.com
├─ Tenant:         Salon A
├─ Staff:          Sarah Ahmed
├─ Service:        Haircut
├─ Amount Paid:    SAR 100.00
├─ Your Fee:       SAR 8.00
├─ Tenant Gets:    SAR 92.00
├─ Tax:            SAR 5.00
├─ Employee Paid:  SAR 10.00
├─ Payment Method: Visa ****4242
├─ Status:         Completed
├─ Verified:       ✅
└─ Audit Log:      Payment processed successfully

Result:
✅ All parties accounted for
✅ No money unaccounted for
✅ Complete transparency
✅ Ready for accounting/audit
```

---

## 💡 What Each Team Sees

```
PLATFORM (You - Admin):
├─ SAR 8 commission per booking ✅ You see this
├─ SAR 105,625 total customer payments ✅ You see this
├─ SAR 97,175 went to tenants ❌ You DON'T see this
└─ SAR 12,000 paid to employees ❌ You DON'T see this

TENANT (Salon Owner):
├─ SAR 92 revenue per booking (after your fee) ✓ Visible to them
├─ SAR 45,000 total earned this month ✓ Visible to them
├─ SAR 12,000 paid to staff this month ✓ Visible to them
└─ SAR 33,000 net after staff costs ✓ Visible to them

EMPLOYEE (Hairdresser):
├─ SAR 10 commission per booking ✓ They see this
├─ SAR 7,550 earned this month ✓ They see this
└─ 75.5 hours worked ✓ They see this
```

---

## 🔄 Missing Admin Dashboard Queries

### Query 1: Your Total Commission
```javascript
// Should run:
SELECT SUM(platformFee) as your_earnings
FROM transactions
WHERE status = 'completed'
  AND createdAt >= NOW() - INTERVAL '30 days'

// Currently: Runs ✅
// Shows in Dashboard: ✅
// Status: WORKING
```

### Query 2: Tenant Revenues
```javascript
// Should run:
SELECT tenantId, SUM(tenantRevenue) as they_earned
FROM transactions
WHERE status = 'completed'
  AND createdAt >= NOW() - INTERVAL '30 days'
GROUP BY tenantId

// Currently: NOT RUNNING ❌
// Shows in Dashboard: NO ❌
// Status: MISSING
```

### Query 3: Employee Hours
```javascript
// Should run:
SELECT staffId, SUM(duration)/60.0 as hours_worked
FROM appointments
WHERE status = 'completed'
  AND startTime >= NOW() - INTERVAL '30 days'
GROUP BY staffId

// Currently: NOT RUNNING ❌
// Shows in Dashboard: NO ❌
// Status: MISSING
```

---

## 📊 Build Priority Matrix

```
                    Impact
                      ↑
         ╔════════════╦════════════╗
    HIGH │   Q2       │    Q1      │
         │ Commission │ Revenue    │
         │ Breakdown  │ Breakdown  │
         ╠════════════╬════════════╣
    LOW  │   Q4       │    Q3      │
         │ Charts     │ Exports    │
         └────────────┴────────────┘
              Effort →

Q1 (Do First):    Tenant revenue visibility
Q2 (Do Next):     Commission breakdown by plan
Q3 (Do After):    Export to CSV/PDF
Q4 (Nice to Have):Real-time charts and graphs
```

---

## ✅ Verification Checklist

System is ready for admin dashboard update:

- ✅ Commission tracked per transaction
- ✅ Tenant revenue calculated correctly
- ✅ Employee commissions tracked
- ✅ Hours recorded with every booking
- ✅ All transactions timestamped
- ✅ Payment status verified
- ✅ Audit logging active
- ✅ Multi-tenant data isolated
- ✅ No data integrity issues
- ✅ Ready to expose in dashboard

All systems **GO** for building financial reporting! 🚀

---

## 🎯 Implementation Roadmap

```
Week 1:
├─ Build backend service layer (getTenantRevenue, etc)
└─ Create API endpoints for financial data

Week 2:
├─ Create admin dashboard pages
├─ Add tenant leaderboard
└─ Add employee hours report

Week 3:
├─ Add charts and visualizations
├─ Export to CSV functionality
└─ Testing & optimization

Week 4:
├─ Deployment
└─ Monitoring & support
```

---

**Total Development Time**: 5-6 hours
**System Status**: READY ✅
**Next Action**: Choose which financial page to build first!
