'use strict';

const crypto = require('crypto');
const db = require('../models');
const cacheService = require('./cacheService');
const aiService = require('./aiService');
const {
    buildBusinessSnapshot,
    saveConsultantReport,
    saveConsultantConversation
} = require('./consultantSnapshotService');
const { sendEmail } = require('../utils/emailService');
const { notifyStaff } = require('./notificationOrchestratorService');
const {
    enrichConsultantResponseRoutes
} = require('./consultantAnalysisFormatter');

const CONSULTANT_WORKFLOW_VERSION = 'wf-v1';
const CONSULTANT_WORKFLOW_CACHE_TTL_SECONDS = 60 * 60 * 6;

const DEFAULT_CONSULTANT_WORKFLOW_SETTINGS = Object.freeze({
    enabled: false,
    frequency: 'daily',
    channels: ['dashboard'],
    thresholds: {
        revenueDropPercent: 10,
        retentionDropPercent: 5,
        noShowIncreasePercent: 10,
        refundIncreasePercent: 10
    }
});

const SUPPORTED_CHANNELS = new Set(['dashboard', 'email', 'push']);
const SUPPORTED_FREQUENCIES = new Set(['daily', 'weekly', 'monthly']);

const toNumber = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const clampPercent = (value, fallback) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(0, Math.min(100, Number(parsed.toFixed(2))));
};

const toSafeText = (value, fallback = '') => {
    const candidate = `${value || ''}`.trim();
    return candidate || fallback;
};

const escapeHtml = (value) => `${value ?? ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeChannels = (value) => {
    const channels = Array.isArray(value) ? value : [];
    const normalized = channels
        .map((item) => `${item || ''}`.trim().toLowerCase())
        .filter((item) => SUPPORTED_CHANNELS.has(item));

    return normalized.length > 0 ? [...new Set(normalized)] : [...DEFAULT_CONSULTANT_WORKFLOW_SETTINGS.channels];
};

const normalizeThresholds = (value = {}) => ({
    revenueDropPercent: clampPercent(value?.revenueDropPercent, DEFAULT_CONSULTANT_WORKFLOW_SETTINGS.thresholds.revenueDropPercent),
    retentionDropPercent: clampPercent(value?.retentionDropPercent, DEFAULT_CONSULTANT_WORKFLOW_SETTINGS.thresholds.retentionDropPercent),
    noShowIncreasePercent: clampPercent(value?.noShowIncreasePercent, DEFAULT_CONSULTANT_WORKFLOW_SETTINGS.thresholds.noShowIncreasePercent),
    refundIncreasePercent: clampPercent(value?.refundIncreasePercent, DEFAULT_CONSULTANT_WORKFLOW_SETTINGS.thresholds.refundIncreasePercent)
});

const normalizeConsultantWorkflowSettings = (value = {}) => ({
    enabled: Boolean(value?.enabled),
    frequency: SUPPORTED_FREQUENCIES.has(`${value?.frequency || ''}`.trim().toLowerCase())
        ? `${value.frequency}`.trim().toLowerCase()
        : DEFAULT_CONSULTANT_WORKFLOW_SETTINGS.frequency,
    channels: normalizeChannels(value?.channels),
    thresholds: normalizeThresholds(value?.thresholds || {}),
    lastRunAt: value?.lastRunAt || null,
    lastReportId: value?.lastReportId || null,
    lastWorkflowHash: value?.lastWorkflowHash || null
});

const normalizeFrequency = (value) => {
    const candidate = `${value || ''}`.trim().toLowerCase();
    return SUPPORTED_FREQUENCIES.has(candidate) ? candidate : DEFAULT_CONSULTANT_WORKFLOW_SETTINGS.frequency;
};

const workflowPeriodTitle = (frequency) => {
    const normalized = normalizeFrequency(frequency);
    if (normalized === 'weekly') return 'Weekly Executive Report';
    if (normalized === 'monthly') return 'Monthly Business Review';
    return 'Daily Briefing';
};

const workflowSubject = (frequency, tenantName = '') => {
    const title = workflowPeriodTitle(frequency);
    return tenantName ? `${title} - ${tenantName}` : title;
};

const buildWorkflowCacheKey = (tenantId, frequency, workflowHash) =>
    `consultant:workflow:${tenantId}:${normalizeFrequency(frequency)}:${workflowHash}:${CONSULTANT_WORKFLOW_VERSION}`;

const buildWorkflowHash = ({
    tenantId,
    frequency,
    thresholds,
    currentSnapshotHash,
    previousSnapshotHash
}) => crypto.createHash('sha256').update(JSON.stringify({
    tenantId,
    frequency: normalizeFrequency(frequency),
    thresholds: normalizeThresholds(thresholds),
    currentSnapshotHash,
    previousSnapshotHash,
    version: CONSULTANT_WORKFLOW_VERSION
})).digest('hex');

const safeSummaryText = (value) => toSafeText(value, 'No summary available.');

const buildPeriodWindowLabel = (snapshot) => {
    const start = snapshot?.data?.period?.start || snapshot?.periodStart || null;
    const end = snapshot?.data?.period?.end || snapshot?.periodEnd || null;

    if (!start || !end) {
        return '-';
    }

    return `${new Date(start).toLocaleDateString('en-GB')} - ${new Date(end).toLocaleDateString('en-GB')}`;
};

const buildMetricChange = (current, previous) => {
    const curr = toNumber(current);
    const prev = toNumber(previous);
    const delta = curr - prev;
    const percentage = prev === 0 ? (curr === 0 ? 0 : 100) : (delta / Math.abs(prev)) * 100;

    return {
        current: Number(curr.toFixed(2)),
        previous: Number(prev.toFixed(2)),
        delta: Number(delta.toFixed(2)),
        percentage: Number(percentage.toFixed(1))
    };
};

const buildThresholdAlerts = (currentSnapshot, previousSnapshot, thresholds = {}) => {
    const current = currentSnapshot?.data || {};
    const previous = previousSnapshot?.data || {};

    const currentRevenue = toNumber(current?.financial?.revenue?.net);
    const previousRevenue = toNumber(previous?.financial?.revenue?.net);
    const currentRetention = toNumber(current?.customers?.retentionRate);
    const previousRetention = toNumber(previous?.customers?.retentionRate);
    const currentNoShows = toNumber(current?.operations?.noShows);
    const previousNoShows = toNumber(previous?.operations?.noShows);
    const currentRefunds = toNumber(current?.financial?.refunds?.total);
    const previousRefunds = toNumber(previous?.financial?.refunds?.total);

    const revenueDrop = previousRevenue > 0 ? ((previousRevenue - currentRevenue) / previousRevenue) * 100 : (currentRevenue > 0 ? 0 : 100);
    const retentionDrop = previousRetention - currentRetention;
    const noShowIncrease = previousNoShows > 0 ? ((currentNoShows - previousNoShows) / previousNoShows) * 100 : (currentNoShows > 0 ? 100 : 0);
    const refundIncrease = previousRefunds > 0 ? ((currentRefunds - previousRefunds) / previousRefunds) * 100 : (currentRefunds > 0 ? 100 : 0);

    const alerts = [];

    if (revenueDrop >= toNumber(thresholds.revenueDropPercent)) {
        alerts.push({
            severity: revenueDrop >= 20 ? 'high' : 'medium',
            title: 'Revenue drop detected',
            detail: `Net revenue is down ${revenueDrop.toFixed(1)}% versus the previous period.`,
            deepLink: '/dashboard/financial/ledger'
        });
    }

    if (retentionDrop >= toNumber(thresholds.retentionDropPercent)) {
        alerts.push({
            severity: retentionDrop >= 10 ? 'high' : 'medium',
            title: 'Retention is declining',
            detail: `Retention dropped by ${retentionDrop.toFixed(1)} points versus the previous period.`,
            deepLink: '/dashboard/customers'
        });
    }

    if (noShowIncrease >= toNumber(thresholds.noShowIncreasePercent)) {
        alerts.push({
            severity: noShowIncrease >= 20 ? 'high' : 'medium',
            title: 'No-show rate is increasing',
            detail: `No-shows increased by ${noShowIncrease.toFixed(1)}% versus the previous period.`,
            deepLink: '/dashboard/appointments'
        });
    }

    if (refundIncrease >= toNumber(thresholds.refundIncreasePercent)) {
        alerts.push({
            severity: refundIncrease >= 20 ? 'high' : 'medium',
            title: 'Refund volume is increasing',
            detail: `Refunds increased by ${refundIncrease.toFixed(1)}% versus the previous period.`,
            deepLink: '/dashboard/financial/ledger'
        });
    }

    return alerts;
};

const buildThresholdRecommendations = (alerts = []) => {
    const recommendations = [];

    alerts.forEach((alert) => {
        const title = `${alert.title} response`;
        if (alert.title === 'Revenue drop detected') {
            recommendations.push({
                priority: 'high',
                title,
                detail: 'Review the daily ledger, activate promotional campaigns, and re-balance staff coverage.',
                deepLink: '/dashboard/financial/ledger'
            });
        }

        if (alert.title === 'Retention is declining') {
            recommendations.push({
                priority: 'high',
                title,
                detail: 'Contact inactive customers, review repeat booking offers, and segment returning clients.',
                deepLink: '/dashboard/customers'
            });
        }

        if (alert.title === 'No-show rate is increasing') {
            recommendations.push({
                priority: 'high',
                title,
                detail: 'Tighten reminder cadence, review deposit policy, and open the schedule for better slot control.',
                deepLink: '/dashboard/appointments'
            });
        }

        if (alert.title === 'Refund volume is increasing') {
            recommendations.push({
                priority: 'high',
                title,
                detail: 'Audit recent refunds, inspect service quality signals, and review payment reconciliation.',
                deepLink: '/dashboard/financial/ledger'
            });
        }
    });

    return recommendations;
};

const buildThresholdActions = (alerts = []) => {
    const actions = [];

    alerts.forEach((alert) => {
        if (alert.title === 'Revenue drop detected') {
            actions.push({
                title: 'Review financial ledger',
                detail: 'Open the revenue ledger and inspect low-performing days and services.',
                module: 'financial',
                deepLink: '/dashboard/financial/ledger',
                priority: 'high'
            });
        }

        if (alert.title === 'Retention is declining') {
            actions.push({
                title: 'Contact inactive customers',
                detail: 'Reach out to inactive customers and review retention campaigns.',
                module: 'notifications',
                deepLink: '/dashboard/notifications',
                priority: 'high'
            });
        }

        if (alert.title === 'No-show rate is increasing') {
            actions.push({
                title: 'Increase employee coverage',
                detail: 'Open schedule management and add coverage for the most affected time slots.',
                module: 'schedule',
                deepLink: '/dashboard/schedules',
                priority: 'high'
            });
        }

        if (alert.title === 'Refund volume is increasing') {
            actions.push({
                title: 'Inspect refund cases',
                detail: 'Review the refund ledger and map the issue to services or employees.',
                module: 'financial',
                deepLink: '/dashboard/financial/ledger',
                priority: 'high'
            });
        }
    });

    return actions;
};

const renderList = (title, items, itemRenderer) => {
    if (!Array.isArray(items) || items.length === 0) {
        return `<p style="color:#64748B;margin:0 0 16px;">No ${title.toLowerCase()} available.</p>`;
    }

    return `
        <div style="margin-bottom:16px;">
            <h3 style="font-size:16px;margin:0 0 8px;color:#0F172A;">${escapeHtml(title)}</h3>
            <ul style="margin:0;padding-left:18px;color:#334155;line-height:1.55;">
                ${items.map((item) => `<li>${itemRenderer(item)}</li>`).join('')}
            </ul>
        </div>
    `;
};

const renderKpiCards = (kpis = []) => {
    if (!Array.isArray(kpis) || kpis.length === 0) {
        return '<p style="color:#64748B;margin:0;">No KPI cards available.</p>';
    }

    return `
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
            ${kpis.map((kpi) => `
                <div style="border:1px solid #E2E8F0;border-radius:12px;padding:12px;background:#F8FAFC;">
                    <div style="font-size:12px;color:#64748B;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(kpi.label || kpi.type || 'KPI')}</div>
                    <div style="font-size:22px;font-weight:700;color:#0F172A;margin-top:6px;">${escapeHtml(`${kpi.value ?? 0}`)} ${escapeHtml(kpi.unit || '')}</div>
                    <div style="font-size:12px;color:#475569;margin-top:4px;">Delta ${escapeHtml(`${kpi.delta ?? 0}`)} (${escapeHtml(kpi.direction || 'flat')})</div>
                </div>
            `).join('')}
        </div>
    `;
};

const renderCharts = (charts = []) => {
    if (!Array.isArray(charts) || charts.length === 0) {
        return '<p style="color:#64748B;margin:0;">No charts available.</p>';
    }

    return charts.map((chart) => `
        <div style="margin-bottom:14px;">
            <div style="font-size:14px;font-weight:700;color:#0F172A;">${escapeHtml(chart.title || 'Chart')}</div>
            <div style="font-size:12px;color:#64748B;margin-bottom:8px;">${escapeHtml(chart.description || '')}</div>
            <div style="font-size:12px;color:#334155;">Type: ${escapeHtml(chart.type || 'line')} | Labels: ${escapeHtml(Array.isArray(chart.labels) ? chart.labels.length : 0)}</div>
        </div>
    `).join('');
};

const renderTablePreview = (tables = []) => {
    if (!Array.isArray(tables) || tables.length === 0) {
        return '<p style="color:#64748B;margin:0;">No tables available.</p>';
    }

    return tables.map((table) => `
        <div style="margin-bottom:16px;">
            <div style="font-size:14px;font-weight:700;color:#0F172A;">${escapeHtml(table.title || 'Table')}</div>
            <div style="font-size:12px;color:#64748B;margin-bottom:8px;">${escapeHtml(table.description || '')}</div>
            <div style="font-size:12px;color:#334155;">Source: ${escapeHtml(table.source || '-')}</div>
        </div>
    `).join('');
};

const renderBriefingHtml = ({
    title,
    summary,
    healthScore,
    kpis,
    alerts,
    recommendations,
    actions,
    tenantName,
    periodLabel,
    dashboardUrl
}) => {
    const alertContent = renderList('Alerts', alerts, (item) => `<strong>${escapeHtml(item.title || 'Alert')}</strong>: ${escapeHtml(item.detail || '')}`);
    const recommendationContent = renderList('Recommendations', recommendations, (item) => `<strong>${escapeHtml(item.title || 'Recommendation')}</strong>: ${escapeHtml(item.detail || '')}`);
    const actionContent = renderList('Actions', actions, (item) => `<strong>${escapeHtml(item.title || 'Action')}</strong>: ${escapeHtml(item.detail || '')} <span style="color:#64748B;">(${escapeHtml(item.module || 'consultant')})</span>`);

    return {
        summaryHtml: `<p style="margin:0;color:#334155;line-height:1.7;">${escapeHtml(summary)}</p>`,
        kpiHtml: renderKpiCards(kpis),
        alertsHtml: alertContent,
        recommendationsHtml: recommendationContent,
        actionsHtml: actionContent,
        emailSubject: `${title}${tenantName ? ` - ${tenantName}` : ''}`,
        heroLine: `Period: ${periodLabel} | Health score: ${healthScore}`,
        dashboardUrl
    };
};

async function buildConsultantWorkflowSnapshots(tenantId, frequency, now = new Date()) {
    const currentSnapshot = await buildBusinessSnapshot({
        tenantId,
        periodType: frequency,
        referenceDate: now,
        includeHistory: true
    });

    const previousSnapshot = await buildBusinessSnapshot({
        tenantId,
        periodType: frequency,
        referenceDate: currentSnapshot.previousWindow.periodStart,
        includeHistory: true
    });

    return { currentSnapshot, previousSnapshot };
}

async function loadTenantConsultantWorkflowContext(tenantId) {
    const [tenant, settings, dashboardAccounts, activeStaff] = await Promise.all([
        db.Tenant.findByPk(tenantId, {
            attributes: ['id', 'name', 'name_en', 'name_ar', 'email', 'phone']
        }),
        db.TenantSettings.findOne({
            where: { tenantId },
            attributes: ['tenantId', 'notificationSettings']
        }),
        db.TenantDashboardAccount.findAll({
            where: { tenantId, isActive: true },
            attributes: ['id', 'email', 'displayName']
        }),
        db.Staff.findAll({
            where: { tenantId, isActive: true },
            attributes: ['id', 'name', 'email']
        })
    ]);

    const workflowSettings = normalizeConsultantWorkflowSettings(settings?.notificationSettings?.consultantWorkflow || {});

    return {
        tenant,
        settings,
        workflowSettings,
        dashboardAccountEmails: dashboardAccounts
            .map((account) => `${account.email || ''}`.trim().toLowerCase())
            .filter(Boolean),
        activeStaffIds: activeStaff.map((staff) => staff.id).filter(Boolean)
    };
}

async function findExistingWorkflowReport({ tenantId, workflowHash }) {
    return db.ConsultantReport.findOne({
        where: {
            tenantId,
            reportType: 'consultant_briefing',
            analysisVersion: CONSULTANT_WORKFLOW_VERSION,
            snapshotHash: workflowHash
        },
        order: [['createdAt', 'DESC']]
    });
}

async function loadWorkflowCache(cacheKey) {
    const cached = await cacheService.get(cacheKey);
    return cached || null;
}

async function storeWorkflowCache(cacheKey, value) {
    await cacheService.set(cacheKey, value, CONSULTANT_WORKFLOW_CACHE_TTL_SECONDS);
}

async function createWorkflowDashboardRecord({
    tenantId,
    report,
    analysis,
    periodType,
    periodLabel,
    dashboardUrl,
    workflowHash
}) {
    const existingSummary = report.metadata?.workflowDelivery?.dashboard || null;
    if (existingSummary?.conversationId) {
        return { skipped: true, reason: 'already_delivered', conversationId: existingSummary.conversationId };
    }

    const conversationTitle = `${workflowPeriodTitle(periodType)} ready`;
    const conversation = await saveConsultantConversation({
        tenantId,
        snapshotId: report.snapshotId || null,
        reportId: report.id,
        title: conversationTitle,
        topic: periodType,
        messages: [
            {
                role: 'assistant',
                content: `${conversationTitle}: ${analysis.summary || 'Consultant briefing ready.'}`
            }
        ],
        summary: {
            healthScore: analysis.healthScore,
            periodType,
            periodLabel
        },
        metadata: {
            workflowHash,
            channel: 'dashboard',
            dashboardUrl
        },
        status: 'open'
    });

    const metadata = {
        ...(report.metadata || {}),
        workflowDelivery: {
            ...(report.metadata?.workflowDelivery || {}),
            dashboard: {
                deliveredAt: new Date().toISOString(),
                conversationId: conversation.id
            }
        }
    };

    await report.update({ metadata });

    return { skipped: false, conversationId: conversation.id };
}

async function sendWorkflowEmail({
    tenant,
    report,
    analysis,
    periodType,
    periodLabel,
    dashboardUrl,
    dashboardAccountEmails = [],
    workflowHash
}) {
    const deliveryState = report.metadata?.workflowDelivery?.email || null;
    if (deliveryState?.sentAt) {
        return { skipped: true, reason: 'already_delivered', messageId: deliveryState.messageId || null };
    }

    const recipients = [...new Set([
        `${tenant?.email || ''}`.trim().toLowerCase(),
        ...dashboardAccountEmails
    ])].filter(Boolean);

    if (recipients.length === 0) {
        return { skipped: true, reason: 'no_recipients' };
    }

    const title = workflowPeriodTitle(periodType);
    const briefing = renderBriefingHtml({
        title,
        summary: safeSummaryText(analysis.summary),
        healthScore: analysis.healthScore || 0,
        kpis: analysis.kpis || [],
        alerts: analysis.alerts || [],
        recommendations: analysis.recommendations || [],
        actions: analysis.actions || [],
        tenantName: tenant?.name || tenant?.name_en || tenant?.name_ar || '',
        periodLabel,
        dashboardUrl
    });

    const result = await sendEmail({
        to: recipients,
        subject: briefing.emailSubject,
        template: 'consultant_briefing',
        data: {
            briefingTitle: briefing.emailSubject,
            summaryHtml: briefing.summaryHtml,
            kpiHtml: briefing.kpiHtml,
            alertsHtml: briefing.alertsHtml,
            recommendationsHtml: briefing.recommendationsHtml,
            actionsHtml: briefing.actionsHtml,
            generatedAt: new Date().toLocaleString('en-GB'),
            periodLine: briefing.heroLine,
            dashboardUrl
        }
    });

    const metadata = {
        ...(report.metadata || {}),
        workflowDelivery: {
            ...(report.metadata?.workflowDelivery || {}),
            email: {
                deliveredAt: new Date().toISOString(),
                recipients,
                success: Boolean(result?.success),
                messageId: result?.messageId || null,
                error: result?.error || null
            }
        }
    };

    await report.update({ metadata });

    return {
        skipped: false,
        success: Boolean(result?.success),
        messageId: result?.messageId || null,
        recipients
    };
}

async function sendWorkflowPush({
    tenantId,
    tenant,
    report,
    analysis,
    periodType,
    dashboardUrl,
    workflowHash
}) {
    const deliveryState = report.metadata?.workflowDelivery?.push || null;
    if (deliveryState?.sentAt) {
        return { skipped: true, reason: 'already_delivered' };
    }

    const activeStaff = await db.Staff.findAll({
        where: { tenantId, isActive: true },
        attributes: ['id', 'name']
    });

    if (!Array.isArray(activeStaff) || activeStaff.length === 0) {
        return { skipped: true, reason: 'no_staff_recipients' };
    }

    const title = workflowPeriodTitle(periodType);
    const body = `${safeSummaryText(analysis.summary)} Open the consultant workspace for the full briefing.`;
    const data = {
        type: 'consultant_briefing',
        reportId: report.id,
        snapshotId: report.snapshotId || null,
        workflowHash,
        dashboardUrl,
        tenantId
    };

    const results = [];
    for (const staff of activeStaff) {
        const result = await notifyStaff({
            tenantId,
            staffId: staff.id,
            eventType: 'consultant_briefing',
            title,
            body,
            data
        });
        results.push({ staffId: staff.id, ...result });
    }

    const metadata = {
        ...(report.metadata || {}),
        workflowDelivery: {
            ...(report.metadata?.workflowDelivery || {}),
            push: {
                deliveredAt: new Date().toISOString(),
                recipients: activeStaff.map((staff) => staff.id),
                results
            }
        }
    };

    await report.update({ metadata });

    return {
        skipped: false,
        recipients: activeStaff.map((staff) => staff.id),
        results
    };
}

async function generateWorkflowReport({
    tenantId,
    tenant,
    workflowSettings,
    currentSnapshot,
    previousSnapshot
}) {
    const workflowHash = buildWorkflowHash({
        tenantId,
        frequency: workflowSettings.frequency,
        thresholds: workflowSettings.thresholds,
        currentSnapshotHash: currentSnapshot.snapshotHash,
        previousSnapshotHash: previousSnapshot.snapshotHash
    });

    const cacheKey = buildWorkflowCacheKey(tenantId, workflowSettings.frequency, workflowHash);
    const cached = await loadWorkflowCache(cacheKey);
    if (cached) {
        return cached;
    }

    const existingReport = await findExistingWorkflowReport({
        tenantId,
        workflowHash
    });

    const comparison = {
        revenue: buildMetricChange(currentSnapshot.data?.financial?.revenue?.net, previousSnapshot.data?.financial?.revenue?.net),
        retention: buildMetricChange(currentSnapshot.data?.customers?.retentionRate, previousSnapshot.data?.customers?.retentionRate),
        noShows: buildMetricChange(currentSnapshot.data?.operations?.noShows, previousSnapshot.data?.operations?.noShows),
        refunds: buildMetricChange(currentSnapshot.data?.financial?.refunds?.total, previousSnapshot.data?.financial?.refunds?.total)
    };

    if (existingReport?.reportData) {
        const normalized = enrichConsultantResponseRoutes(existingReport.reportData);
        const response = {
            reportId: existingReport.id,
            analysis: normalized,
            workflowHash,
            comparison,
            periodLabel: buildPeriodWindowLabel(currentSnapshot),
            source: 'stored'
        };
        await storeWorkflowCache(cacheKey, response);
        return response;
    }

    const aiInput = {
        snapshot: currentSnapshot.data,
        previousSnapshot: previousSnapshot.data,
        workflow: {
            frequency: workflowSettings.frequency,
            periodType: workflowSettings.frequency,
            thresholds: workflowSettings.thresholds,
            channels: workflowSettings.channels
        },
        comparison
    };

    const analysis = enrichConsultantResponseRoutes(
        await aiService.generateConsultantAnalysis(aiInput, {
            temperature: 0.2,
            model: 'gpt-4o-mini'
        })
    );

    const thresholdAlerts = buildThresholdAlerts(currentSnapshot, previousSnapshot, workflowSettings.thresholds);
    const alerts = [...analysis.alerts, ...thresholdAlerts];
    const uniqueAlerts = [];
    const seenAlertTitles = new Set();
    alerts.forEach((alert) => {
        const key = `${alert.title || ''}`.trim().toLowerCase();
        if (!key || seenAlertTitles.has(key)) return;
        seenAlertTitles.add(key);
        uniqueAlerts.push(alert);
    });

    const thresholdRecommendations = buildThresholdRecommendations(thresholdAlerts);
    const thresholdActions = buildThresholdActions(thresholdAlerts);

    const finalAnalysis = {
        ...analysis,
        alerts: uniqueAlerts,
        recommendations: [...analysis.recommendations, ...thresholdRecommendations],
        actions: [...analysis.actions, ...thresholdActions]
    };

    const title = workflowPeriodTitle(workflowSettings.frequency);
    const periodLabel = buildPeriodWindowLabel(currentSnapshot);
    const dashboardUrl = '/dashboard/consultant';
    const briefing = renderBriefingHtml({
        title,
        summary: safeSummaryText(finalAnalysis.summary),
        healthScore: finalAnalysis.healthScore || 0,
        kpis: finalAnalysis.kpis || [],
        alerts: finalAnalysis.alerts || [],
        recommendations: finalAnalysis.recommendations || [],
        actions: finalAnalysis.actions || [],
        tenantName: tenant?.name || tenant?.name_en || tenant?.name_ar || '',
        periodLabel,
        dashboardUrl
    });

    const report = await saveConsultantReport({
        tenantId,
        snapshotId: null,
        createdByUserId: null,
        snapshotHash: workflowHash,
        analysisVersion: CONSULTANT_WORKFLOW_VERSION,
        title,
        description: `Automated ${workflowSettings.frequency} consultant briefing.`,
        periodType: workflowSettings.frequency,
        periodStart: currentSnapshot.periodStart,
        periodEnd: currentSnapshot.periodEnd,
        sections: ['summary', 'healthScore', 'kpis', 'charts', 'tables', 'alerts', 'recommendations', 'actions'],
        outputFormat: 'json',
        reportData: finalAnalysis,
        metadata: {
            workflowType: workflowSettings.frequency,
            workflowHash,
            thresholds: workflowSettings.thresholds,
            channels: workflowSettings.channels,
            comparison,
            periodLabel,
            dashboardUrl,
            generatedBy: 'consultant_workflow',
            source: 'openai',
            model: 'gpt-4o-mini',
            temperature: 0.2,
            briefingHtml: briefing.summaryHtml
        }
    });

    const response = {
        reportId: report.id,
        analysis: finalAnalysis,
        workflowHash,
        comparison,
        periodLabel,
        source: 'openai'
    };

    await storeWorkflowCache(cacheKey, response);
    return response;
}

async function deliverWorkflowChannels({
    tenantId,
    tenant,
    workflowSettings,
    report,
    analysis,
    workflowHash,
    periodLabel
}) {
    const dashboardUrl = '/dashboard/consultant';
    const deliveryResults = {
        dashboard: { skipped: true, reason: 'not_requested' },
        email: { skipped: true, reason: 'not_requested' },
        push: { skipped: true, reason: 'not_requested' }
    };

    if (!report?.id) {
        return {
            dashboard: { skipped: true, reason: 'missing_report' },
            email: { skipped: true, reason: 'missing_report' },
            push: { skipped: true, reason: 'missing_report' }
        };
    }

    if (workflowSettings.channels.includes('dashboard')) {
        deliveryResults.dashboard = await createWorkflowDashboardRecord({
            tenantId,
            report,
            analysis,
            periodType: workflowSettings.frequency,
            periodLabel,
            dashboardUrl,
            workflowHash
        });
    }

    if (workflowSettings.channels.includes('email')) {
        deliveryResults.email = await sendWorkflowEmail({
            tenant,
            report,
            analysis,
            periodType: workflowSettings.frequency,
            periodLabel,
            dashboardUrl,
            dashboardAccountEmails: tenant?.dashboardAccountEmails || [],
            workflowHash
        });
    }

    if (workflowSettings.channels.includes('push')) {
        deliveryResults.push = await sendWorkflowPush({
            tenantId,
            tenant,
            report,
            analysis,
            periodType: workflowSettings.frequency,
            dashboardUrl,
            workflowHash
        });
    }

    const metadata = {
        ...(report.metadata || {}),
        workflowDelivery: {
            ...(report.metadata?.workflowDelivery || {}),
            deliveryResults,
            lastDeliveredAt: new Date().toISOString()
        },
        workflowSettings
    };

    await report.update({
        metadata
    });

    return deliveryResults;
}

async function processConsultantWorkflowForTenant({
    tenantId,
    now = new Date(),
    force = false
} = {}) {
    if (!tenantId) {
        throw new Error('tenantId is required to process consultant workflows');
    }

    const context = await loadTenantConsultantWorkflowContext(tenantId);
    if (!context.workflowSettings.enabled) {
        return { skipped: true, reason: 'workflow_disabled' };
    }

    const { currentSnapshot, previousSnapshot } = await buildConsultantWorkflowSnapshots(
        tenantId,
        context.workflowSettings.frequency,
        now
    );

    const workflowHash = buildWorkflowHash({
        tenantId,
        frequency: context.workflowSettings.frequency,
        thresholds: context.workflowSettings.thresholds,
        currentSnapshotHash: currentSnapshot.snapshotHash,
        previousSnapshotHash: previousSnapshot.snapshotHash
    });

    const cacheKey = buildWorkflowCacheKey(tenantId, context.workflowSettings.frequency, workflowHash);
    const cached = !force ? await loadWorkflowCache(cacheKey) : null;

    let outcome = cached;
    if (!outcome) {
        outcome = await generateWorkflowReport({
            tenantId,
            tenant: {
                ...context.tenant?.toJSON?.(),
                dashboardAccountEmails: context.dashboardAccountEmails
            },
            workflowSettings: context.workflowSettings,
            currentSnapshot,
            previousSnapshot
        });
    }

    const report = await db.ConsultantReport.findByPk(outcome.reportId);
    if (!report) {
        throw new Error('Consultant briefing report not found');
    }

    const deliveryResults = await deliverWorkflowChannels({
        tenantId,
        tenant: {
            ...context.tenant?.toJSON?.(),
            dashboardAccountEmails: context.dashboardAccountEmails
        },
        workflowSettings: context.workflowSettings,
        report,
        analysis: outcome.analysis,
        workflowHash: outcome.workflowHash,
        periodLabel: outcome.periodLabel
    });

    const updatedWorkflowSettings = {
        ...context.workflowSettings,
        lastRunAt: now.toISOString(),
        lastReportId: outcome.reportId,
        lastWorkflowHash: outcome.workflowHash
    };

    await db.TenantSettings.update({
        notificationSettings: {
            ...(context.settings?.notificationSettings || {}),
            consultantWorkflow: updatedWorkflowSettings
        }
    }, {
        where: { tenantId }
    }).catch(() => {});

    return {
        skipped: false,
        tenantId,
        reportId: outcome.reportId,
        workflowHash: outcome.workflowHash,
        periodLabel: outcome.periodLabel,
        comparison: outcome.comparison,
        deliveryResults,
        analysis: outcome.analysis
    };
}

async function processConsultantWorkflows({ now = new Date(), force = false } = {}) {
    const tenantSettings = await db.TenantSettings.findAll({
        attributes: ['tenantId', 'notificationSettings']
    });

    const results = [];
    for (const row of tenantSettings) {
        const workflow = normalizeConsultantWorkflowSettings(row.notificationSettings?.consultantWorkflow || {});
        if (!workflow.enabled) {
            continue;
        }

        try {
            const result = await processConsultantWorkflowForTenant({
                tenantId: row.tenantId,
                now,
                force
            });
            results.push(result);
        } catch (error) {
            results.push({
                tenantId: row.tenantId,
                skipped: false,
                error: error.message
            });
        }
    }

    return results;
}

async function listConsultantBriefings({ tenantId, limit = 20, page = 1 } = {}) {
    const offset = (Math.max(page, 1) - 1) * Math.max(limit, 1);
    const { count, rows } = await db.ConsultantReport.findAndCountAll({
        where: {
            tenantId,
            reportType: 'consultant_briefing',
            analysisVersion: CONSULTANT_WORKFLOW_VERSION
        },
        order: [['createdAt', 'DESC']],
        limit: Math.max(limit, 1),
        offset
    });

    return {
        count,
        rows
    };
}

module.exports = {
    CONSULTANT_WORKFLOW_VERSION,
    DEFAULT_CONSULTANT_WORKFLOW_SETTINGS,
    normalizeConsultantWorkflowSettings,
    processConsultantWorkflows,
    processConsultantWorkflowForTenant,
    listConsultantBriefings,
    buildWorkflowHash,
    buildWorkflowCacheKey
};
