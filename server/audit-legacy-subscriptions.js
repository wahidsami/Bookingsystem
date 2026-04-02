const { Client } = require('pg');
const crypto = require('crypto');

const DATABASE_URL = process.env.DATABASE_URL;
const APPLY_FIXES = process.env.APPLY_FIXES === 'true';

if (!DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
}

function getExpectedPeriodEnd(startDate, billingCycle) {
    const periodEnd = new Date(startDate);

    if (billingCycle === 'annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else if (billingCycle === 'sixMonth') {
        periodEnd.setMonth(periodEnd.getMonth() + 6);
    } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    return periodEnd;
}

function getCyclePrice(row) {
    if (row.billingCycle === 'annual') return Number(row.packageAnnualPrice || 0);
    if (row.billingCycle === 'sixMonth') return Number(row.packageSixMonthPrice || 0);
    return Number(row.packageMonthlyPrice || 0);
}

async function generateBillNumber(client) {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const { rows } = await client.query(
        `
        SELECT billNumber
        FROM public.bills
        WHERE "billNumber" LIKE $1
        ORDER BY "createdAt" DESC, "billNumber" DESC
        LIMIT 1
        `,
        [`${prefix}%`]
    );

    let nextSequence = 1;
    if (rows[0]?.billnumber) {
        const suffix = rows[0].billnumber.replace(prefix, '');
        const parsed = Number.parseInt(suffix, 10);
        if (Number.isFinite(parsed)) {
            nextSequence = parsed + 1;
        }
    }

    return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

async function loadAuditData(client) {
    const paymentPending = await client.query(`
        WITH latest_subscriptions AS (
            SELECT DISTINCT ON (ts."tenantId")
                ts.id,
                ts."tenantId",
                ts."packageId",
                ts."billingCycle",
                ts.amount,
                ts.status,
                ts."currentPeriodStart",
                ts."currentPeriodEnd",
                ts."nextBillingDate",
                ts."createdAt"
            FROM public.tenant_subscriptions ts
            ORDER BY ts."tenantId", ts."createdAt" DESC
        ),
        unpaid_initial_bills AS (
            SELECT
                b."tenantId",
                COUNT(*) FILTER (WHERE b.type = 'initial' AND b.status = 'UNPAID') AS unpaid_initial_bill_count,
                MAX(b."paymentTokenExpiresAt") FILTER (WHERE b.type = 'initial' AND b.status = 'UNPAID') AS latest_unpaid_initial_expiry
            FROM public.bills b
            GROUP BY b."tenantId"
        )
        SELECT
            t.id AS "tenantId",
            t.email,
            t.slug,
            t.name,
            t.name_en AS "nameEn",
            t.name_ar AS "nameAr",
            t.status AS "tenantStatus",
            t."paymentDueAt",
            ls.id AS "subscriptionId",
            ls."packageId",
            ls."billingCycle",
            ls.amount,
            ls.status AS "subscriptionStatus",
            ls."currentPeriodStart",
            ls."currentPeriodEnd",
            ls."nextBillingDate",
            sp.name AS "packageName",
            sp.name_ar AS "packageNameAr",
            sp."monthlyPrice" AS "packageMonthlyPrice",
            sp."sixMonthPrice" AS "packageSixMonthPrice",
            sp."annualPrice" AS "packageAnnualPrice",
            COALESCE(uib.unpaid_initial_bill_count, 0) AS "unpaidInitialBillCount",
            uib.latest_unpaid_initial_expiry AS "latestUnpaidInitialExpiry"
        FROM public.tenants t
        LEFT JOIN latest_subscriptions ls ON ls."tenantId" = t.id
        LEFT JOIN public.subscription_packages sp ON sp.id = ls."packageId"
        LEFT JOIN unpaid_initial_bills uib ON uib."tenantId" = t.id
        WHERE t.status = 'payment_pending'
        ORDER BY t."createdAt" ASC
    `);

    const pendingApprovalMissingSubscription = await client.query(`
        SELECT
            t.id AS "tenantId",
            t.email,
            t.slug,
            t.name,
            t.name_en AS "nameEn",
            t.name_ar AS "nameAr",
            t.status AS "tenantStatus"
        FROM public.tenants t
        LEFT JOIN public.tenant_subscriptions ts ON ts."tenantId" = t.id
        WHERE t.status = 'pending_approval'
        GROUP BY t.id
        HAVING COUNT(ts.id) = 0
        ORDER BY t."createdAt" ASC
    `);

    const wrongBillingPeriods = await client.query(`
        SELECT
            ts.id AS "subscriptionId",
            ts."tenantId",
            ts."packageId",
            ts."billingCycle",
            ts.amount,
            ts.status AS "subscriptionStatus",
            ts."currentPeriodStart",
            ts."currentPeriodEnd",
            ts."nextBillingDate",
            t.email,
            t.slug,
            t.name,
            t.name_en AS "nameEn",
            t.name_ar AS "nameAr",
            sp.name AS "packageName",
            sp.name_ar AS "packageNameAr",
            sp."monthlyPrice" AS "packageMonthlyPrice",
            sp."sixMonthPrice" AS "packageSixMonthPrice",
            sp."annualPrice" AS "packageAnnualPrice",
            EXTRACT(EPOCH FROM (ts."currentPeriodEnd" - ts."currentPeriodStart")) / 86400 AS "actualDays"
        FROM public.tenant_subscriptions ts
        JOIN public.tenants t ON t.id = ts."tenantId"
        JOIN public.subscription_packages sp ON sp.id = ts."packageId"
        WHERE ts.status = 'active'
          AND ts."billingCycle" IN ('sixMonth', 'annual')
        ORDER BY ts."createdAt" ASC
    `);

    const amountMismatches = await client.query(`
        SELECT
            ts.id AS "subscriptionId",
            ts."tenantId",
            ts."packageId",
            ts."billingCycle",
            ts.amount,
            ts.status AS "subscriptionStatus",
            t.email,
            t.slug,
            t.name,
            t.name_en AS "nameEn",
            t.name_ar AS "nameAr",
            sp.name AS "packageName",
            sp.name_ar AS "packageNameAr",
            sp."monthlyPrice" AS "packageMonthlyPrice",
            sp."sixMonthPrice" AS "packageSixMonthPrice",
            sp."annualPrice" AS "packageAnnualPrice"
        FROM public.tenant_subscriptions ts
        JOIN public.tenants t ON t.id = ts."tenantId"
        JOIN public.subscription_packages sp ON sp.id = ts."packageId"
        WHERE ts.status IN ('trial', 'active', 'past_due')
        ORDER BY ts."createdAt" ASC
    `);

    return {
        paymentPending: paymentPending.rows,
        pendingApprovalMissingSubscription: pendingApprovalMissingSubscription.rows,
        wrongBillingPeriods: wrongBillingPeriods.rows,
        amountMismatches: amountMismatches.rows
    };
}

function classifyPaymentPending(rows) {
    const now = Date.now();

    return rows.map((row) => {
        let issue = 'ok';

        if (!row.subscriptionId) {
            issue = 'missing_subscription';
        } else if (!row.packageId || !row.packageName) {
            issue = 'missing_package';
        } else if (Number(row.unpaidInitialBillCount || 0) === 0) {
            issue = 'missing_initial_bill';
        } else if (row.paymentDueAt && new Date(row.paymentDueAt).getTime() < now) {
            issue = 'payment_window_expired_but_still_pending';
        }

        return {
            ...row,
            issue,
            expectedAmount: row.subscriptionId ? getCyclePrice(row) : 0
        };
    });
}

function classifyWrongBillingPeriods(rows) {
    return rows
        .map((row) => {
            const expectedEnd = getExpectedPeriodEnd(row.currentPeriodStart, row.billingCycle);
            const expectedDays = Math.round((expectedEnd.getTime() - new Date(row.currentPeriodStart).getTime()) / 86400000);
            const actualDays = Math.round(Number(row.actualDays || 0));
            const threshold = row.billingCycle === 'annual' ? 300 : 150;

            return {
                ...row,
                actualDays,
                expectedDays,
                expectedPeriodEnd: expectedEnd.toISOString(),
                needsFix: actualDays < threshold
            };
        })
        .filter((row) => row.needsFix);
}

function classifyAmountMismatches(rows) {
    return rows
        .map((row) => {
            const expectedAmount = getCyclePrice(row);
            const actualAmount = Number(row.amount || 0);
            return {
                ...row,
                expectedAmount,
                actualAmount,
                difference: Number((actualAmount - expectedAmount).toFixed(2))
            };
        })
        .filter((row) => Math.abs(row.difference) > 0.01);
}

async function repairMissingInitialBills(client, rows) {
    const repaired = [];

    for (const row of rows) {
        const dueAt = row.paymentDueAt && new Date(row.paymentDueAt) > new Date()
            ? new Date(row.paymentDueAt)
            : new Date(Date.now() + 48 * 60 * 60 * 1000);

        await client.query('BEGIN');
        try {
            if (!row.paymentDueAt || new Date(row.paymentDueAt) <= new Date()) {
                await client.query(
                    `
                    UPDATE public.tenants
                    SET "paymentDueAt" = $2
                    WHERE id = $1
                    `,
                    [row.tenantId, dueAt]
                );
            }

            const billNumber = await generateBillNumber(client);
            const paymentToken = crypto.randomBytes(32).toString('hex');
            const billId = crypto.randomUUID();

            await client.query(
                `
                INSERT INTO public.bills (
                    id,
                    "tenantId",
                    "tenantSubscriptionId",
                    "billNumber",
                    amount,
                    currency,
                    "dueDate",
                    status,
                    "paymentToken",
                    "paymentTokenExpiresAt",
                    "planSnapshot",
                    type,
                    metadata,
                    "createdAt",
                    "updatedAt"
                )
                VALUES (
                    $10,
                    $1,
                    $2,
                    $3,
                    $4,
                    'SAR',
                    $5,
                    'UNPAID',
                    $6,
                    $7,
                    $8::jsonb,
                    'initial',
                    $9::jsonb,
                    NOW(),
                    NOW()
                )
                `,
                [
                    row.tenantId,
                    row.subscriptionId,
                    billNumber,
                    Number(row.amount || 0),
                    dueAt.toISOString().slice(0, 10),
                    paymentToken,
                    dueAt.toISOString(),
                    JSON.stringify({
                        packageId: row.packageId,
                        packageName: row.packageName,
                        packageNameAr: row.packageNameAr,
                        billingCycle: row.billingCycle
                    }),
                    JSON.stringify({
                        createdFrom: 'legacy_repair_script',
                        repairedAt: new Date().toISOString()
                    }),
                    billId
                ]
            );

            await client.query('COMMIT');
            repaired.push({
                tenantId: row.tenantId,
                email: row.email,
                billNumber,
                billingCycle: row.billingCycle,
                amount: Number(row.amount || 0)
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
    }

    return repaired;
}

async function repairWrongBillingPeriods(client, rows) {
    const repaired = [];

    for (const row of rows) {
        const expectedEnd = new Date(row.expectedPeriodEnd);

        const result = await client.query(
            `
            UPDATE public.tenant_subscriptions
            SET "currentPeriodEnd" = $2,
                "nextBillingDate" = $2,
                "updatedAt" = NOW()
            WHERE id = $1
            RETURNING id
            `,
            [row.subscriptionId, expectedEnd.toISOString()]
        );

        if (result.rowCount > 0) {
            repaired.push({
                subscriptionId: row.subscriptionId,
                tenantId: row.tenantId,
                email: row.email,
                billingCycle: row.billingCycle,
                previousDays: row.actualDays,
                newPeriodEnd: expectedEnd.toISOString()
            });
        }
    }

    return repaired;
}

async function main() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: false
    });

    await client.connect();

    try {
        const rawAudit = await loadAuditData(client);
        const paymentPending = classifyPaymentPending(rawAudit.paymentPending);
        const wrongBillingPeriods = classifyWrongBillingPeriods(rawAudit.wrongBillingPeriods);
        const amountMismatches = classifyAmountMismatches(rawAudit.amountMismatches);

        const report = {
            paymentPending: {
                total: paymentPending.length,
                missingSubscription: paymentPending.filter((row) => row.issue === 'missing_subscription'),
                missingPackage: paymentPending.filter((row) => row.issue === 'missing_package'),
                missingInitialBill: paymentPending.filter((row) => row.issue === 'missing_initial_bill'),
                expiredButStillPending: paymentPending.filter((row) => row.issue === 'payment_window_expired_but_still_pending'),
                healthy: paymentPending.filter((row) => row.issue === 'ok')
            },
            pendingApprovalMissingSubscription: rawAudit.pendingApprovalMissingSubscription,
            wrongBillingPeriods,
            amountMismatches
        };

        console.log(JSON.stringify({
            applyFixes: APPLY_FIXES,
            summary: {
                paymentPendingTotal: report.paymentPending.total,
                paymentPendingMissingSubscription: report.paymentPending.missingSubscription.length,
                paymentPendingMissingPackage: report.paymentPending.missingPackage.length,
                paymentPendingMissingInitialBill: report.paymentPending.missingInitialBill.length,
                paymentPendingExpiredButStillPending: report.paymentPending.expiredButStillPending.length,
                pendingApprovalMissingSubscription: report.pendingApprovalMissingSubscription.length,
                wrongBillingPeriods: report.wrongBillingPeriods.length,
                amountMismatches: report.amountMismatches.length
            },
            details: report
        }, null, 2));

        if (!APPLY_FIXES) {
            return;
        }

        const repairedMissingBills = await repairMissingInitialBills(client, report.paymentPending.missingInitialBill);
        const repairedBillingPeriods = await repairWrongBillingPeriods(client, report.wrongBillingPeriods);

        console.log(JSON.stringify({
            repairedMissingBills,
            repairedBillingPeriods
        }, null, 2));
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
