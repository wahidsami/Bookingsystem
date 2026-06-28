'use strict';

const normalizeConsultantList = (value) => (Array.isArray(value) ? value : []);

function normalizeConsultantStructuredResponse(raw = {}) {
    const summary = `${raw.summary || raw.executiveSummary || ''}`.trim();
    const healthScore = Number.isFinite(Number(raw.healthScore))
        ? Math.max(0, Math.min(100, Math.round(Number(raw.healthScore))))
        : 0;

    const kpis = normalizeConsultantList(raw.kpis).map((item) => ({
        type: `${item?.type || 'revenue'}`.trim(),
        label: `${item?.label || ''}`.trim(),
        value: Number.isFinite(Number(item?.value)) ? Number(item.value) : 0,
        unit: `${item?.unit || ''}`.trim() || 'count',
        delta: Number.isFinite(Number(item?.delta)) ? Number(item.delta) : 0,
        direction: ['up', 'down', 'flat'].includes(item?.direction) ? item.direction : 'flat',
        trend: ['positive', 'negative', 'neutral'].includes(item?.trend) ? item.trend : 'neutral'
    }));

    const charts = normalizeConsultantList(raw.charts).map((chart) => ({
        type: ['line', 'bar', 'pie'].includes(chart?.type) ? chart.type : 'line',
        title: `${chart?.title || ''}`.trim(),
        description: `${chart?.description || ''}`.trim(),
        labels: Array.isArray(chart?.labels) ? chart.labels : [],
        series: Array.isArray(chart?.series)
            ? chart.series.map((serie) => ({
                name: `${serie?.name || ''}`.trim(),
                data: Array.isArray(serie?.data) ? serie.data : []
            }))
            : []
    }));

    const tables = normalizeConsultantList(raw.tables).map((table) => ({
        title: `${table?.title || ''}`.trim(),
        description: `${table?.description || ''}`.trim(),
        columns: Array.isArray(table?.columns) ? table.columns : [],
        rows: Array.isArray(table?.rows) ? table.rows : [],
        source: `${table?.source || ''}`.trim()
    }));

    const alerts = normalizeConsultantList(raw.alerts).map((alert) => ({
        severity: ['low', 'medium', 'high'].includes(alert?.severity) ? alert.severity : 'medium',
        title: `${alert?.title || ''}`.trim(),
        detail: `${alert?.detail || ''}`.trim(),
        deepLink: `${alert?.deepLink || ''}`.trim() || null
    }));

    const recommendations = normalizeConsultantList(raw.recommendations).map((item) => ({
        priority: ['low', 'medium', 'high'].includes(item?.priority) ? item.priority : 'medium',
        title: `${item?.title || ''}`.trim(),
        detail: `${item?.detail || ''}`.trim(),
        deepLink: `${item?.deepLink || ''}`.trim() || null
    }));

    const actions = normalizeConsultantList(raw.actions).map((item) => ({
        title: `${item?.title || ''}`.trim(),
        detail: `${item?.detail || ''}`.trim(),
        module: `${item?.module || ''}`.trim() || 'consultant',
        deepLink: `${item?.deepLink || ''}`.trim() || null,
        priority: ['low', 'medium', 'high'].includes(item?.priority) ? item.priority : 'medium'
    }));

    return {
        summary,
        healthScore,
        kpis,
        charts,
        tables,
        alerts,
        recommendations,
        actions
    };
}

function inferConsultantActionRoute(title = '', detail = '', module = '') {
    const text = `${title} ${detail} ${module}`.toLowerCase();

    if (text.includes('inactive customer') || text.includes('inactive customers') || text.includes('contact customer') || text.includes('customer outreach')) {
        return { module: 'notifications', deepLink: '/dashboard/notifications' };
    }

    if (text.includes('employee hour') || text.includes('employee hours') || text.includes('schedule')) {
        return { module: 'schedule', deepLink: '/dashboard/schedules' };
    }

    if (text.includes('revenue') || text.includes('refund') || text.includes('ledger') || text.includes('settlement') || text.includes('payment')) {
        return { module: 'financial', deepLink: '/dashboard/financial/ledger' };
    }

    if (text.includes('appointment') || text.includes('no-show') || text.includes('cancellation') || text.includes('booking')) {
        return { module: 'appointments', deepLink: '/dashboard/appointments' };
    }

    if (text.includes('customer sales') || text.includes('customer')) {
        return { module: 'customers', deepLink: '/dashboard/customers' };
    }

    if (text.includes('employee') || text.includes('staff')) {
        return { module: 'employees', deepLink: '/dashboard/employees' };
    }

    if (text.includes('service')) {
        return { module: 'services', deepLink: '/dashboard/services' };
    }

    if (text.includes('product')) {
        return { module: 'products', deepLink: '/dashboard/products' };
    }

    if (text.includes('report')) {
        return { module: 'reports', deepLink: '/dashboard/reports' };
    }

    return { module: module || 'consultant', deepLink: '/dashboard/consultant' };
}

function enrichConsultantResponseRoutes(response) {
    const next = normalizeConsultantStructuredResponse(response);

    next.alerts = next.alerts.map((alert) => {
        const inferred = inferConsultantActionRoute(alert.title, alert.detail, 'alerts');
        return {
            ...alert,
            deepLink: alert.deepLink || inferred.deepLink
        };
    });

    next.recommendations = next.recommendations.map((item) => {
        const inferred = inferConsultantActionRoute(item.title, item.detail, 'reports');
        return {
            ...item,
            deepLink: item.deepLink || inferred.deepLink
        };
    });

    next.actions = next.actions.map((item) => {
        const inferred = inferConsultantActionRoute(item.title, item.detail, item.module);
        return {
            ...item,
            module: item.module || inferred.module,
            deepLink: item.deepLink || inferred.deepLink
        };
    });

    if (!next.healthScore) {
        const revenueKpi = next.kpis.find((item) => item.type === 'revenue');
        const retentionKpi = next.kpis.find((item) => item.type === 'retention');
        const noShowKpi = next.kpis.find((item) => item.type === 'no-show');
        const refundKpi = next.kpis.find((item) => item.type === 'refunds');
        const scoreBase = [
            revenueKpi ? 25 : 0,
            retentionKpi ? 25 : 0,
            noShowKpi ? 20 : 0,
            refundKpi ? 10 : 0,
            next.alerts.length > 0 ? 20 : 0
        ].reduce((sum, value) => sum + value, 0);
        next.healthScore = Math.max(40, Math.min(95, scoreBase || 70));
    }

    return next;
}

module.exports = {
    normalizeConsultantStructuredResponse,
    inferConsultantActionRoute,
    enrichConsultantResponseRoutes
};
