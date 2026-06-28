const aiService = require('../../services/aiService');
const cacheService = require('../../services/cacheService');
const db = require('../../models');
const {
    assertFeatureQuotaAvailable,
    incrementMonthlyFeatureUsage
} = require('../../services/subscriptionConsumptionService');
const { saveConsultantReport } = require('../../services/consultantSnapshotService');
const {
    processConsultantWorkflowForTenant,
    listConsultantBriefings,
    getDefaultConsultantCommunicationPreferences,
    normalizeCommunicationPreferences
} = require('../../services/consultantWorkflowService');
const { getActiveSubscriptionForTenant } = require('../../services/tenantSubscriptionService');
const { normalizePackageEntitlements } = require('../../utils/packageEntitlements');
const { successResponse, errorResponse, paginatedResponse } = require('../../utils/responses');
const crypto = require('crypto');

const AI_FEATURE_KEY = 'aiContentAssistant';
const CONSULTANT_ANALYSIS_VERSION = 'v1';

async function requireAiQuota(req, res) {
    const tenantId = req.tenantId || req.tenant?.id;
    const quotaCheck = await assertFeatureQuotaAvailable(tenantId, AI_FEATURE_KEY, 1);

    if (!quotaCheck.allowed) {
        res.status(quotaCheck.statusCode || 403).json({
            success: false,
            message: quotaCheck.message,
            limit: quotaCheck.limit,
            consumed: quotaCheck.consumed,
            remaining: quotaCheck.remaining,
            code: 'AI_QUOTA_REACHED'
        });
        return false;
    }

    return true;
}

async function recordAiUsage(req) {
    const tenantId = req.tenantId || req.tenant?.id;
    if (!tenantId) return;
    await incrementMonthlyFeatureUsage(tenantId, AI_FEATURE_KEY, 1);
}

async function requireConsultantSubscription(req, res, next) {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        const tenantSettings = await db.TenantSettings.findOne({
            where: { tenantId },
            attributes: ['features']
        });

        const tenantFeatures = normalizePackageEntitlements(tenantSettings?.features || {});
        if (tenantFeatures.aiConsultant) {
            return next();
        }

        const subscription = await getActiveSubscriptionForTenant(tenantId, {
            statuses: ['active', 'trial', 'APPROVED_FREE_ACTIVE']
        });
        const packageFeatures = normalizePackageEntitlements(subscription?.package?.limits || {});
        if (packageFeatures.aiConsultant) {
            return next();
        }

        return res.status(403).json({
            success: false,
            allowed: false,
            reason: 'subscription_required',
            message: 'AI Consultant is not included in your subscription.'
        });
    } catch (error) {
        console.error('Consultant subscription check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify AI Consultant subscription.',
            error: error.message
        });
    }
}

function normalizeConsultantSnapshotInput(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        return null;
    }

    if (snapshot.data && typeof snapshot.data === 'object') {
        return {
            period: snapshot.period || {
                type: snapshot.periodType || 'daily',
                start: snapshot.periodStart || snapshot.period?.start || null,
                end: snapshot.periodEnd || snapshot.period?.end || null,
                generatedAt: snapshot.generatedAt || null
            },
            currency: snapshot.currency || 'SAR',
            summary: snapshot.summary || {},
            financial: snapshot.data.financial || snapshot.financial || {},
            customers: snapshot.data.customers || snapshot.customers || {},
            operations: snapshot.data.operations || snapshot.operations || {},
            employees: snapshot.data.employees || snapshot.employees || [],
            products: snapshot.data.products || snapshot.products || [],
            sourceCounts: snapshot.data.sourceCounts || snapshot.sourceCounts || {},
            metadata: snapshot.data.metadata || snapshot.metadata || {}
        };
    }

    return {
        period: snapshot.period || {
            type: snapshot.periodType || 'daily',
            start: snapshot.periodStart || null,
            end: snapshot.periodEnd || null,
            generatedAt: snapshot.generatedAt || null
        },
        currency: snapshot.currency || 'SAR',
        summary: snapshot.summary || {},
        financial: snapshot.financial || {},
        customers: snapshot.customers || {},
        operations: snapshot.operations || {},
        employees: snapshot.employees || [],
        products: snapshot.products || [],
        sourceCounts: snapshot.sourceCounts || {},
        metadata: snapshot.metadata || {}
    };
}

function buildConsultantSnapshotHash(snapshot) {
    return crypto.createHash('sha256').update(JSON.stringify(snapshot || {})).digest('hex');
}

function buildConsultantAnalysisCacheKey(tenantId, snapshotHash) {
    return `consultant:analysis:${tenantId}:${snapshotHash}:${CONSULTANT_ANALYSIS_VERSION}`;
}

function buildConsultantAnalysisIdentityHash(snapshotHash, communicationPreferences) {
    return crypto.createHash('sha256').update(JSON.stringify({
        snapshotHash,
        communicationPreferences: normalizeCommunicationPreferences(communicationPreferences || {})
    })).digest('hex');
}

function normalizeConsultantList(value) {
    if (Array.isArray(value)) {
        return value;
    }

    return [];
}

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

async function findStoredConsultantAnalysis(tenantId, snapshotHash) {
    return db.ConsultantReport.findOne({
        where: {
            tenantId,
            reportType: 'consultant_analysis',
            analysisVersion: CONSULTANT_ANALYSIS_VERSION,
            snapshotHash
        },
        order: [['createdAt', 'DESC']]
    });
}

async function loadConsultantSnapshotInput(req) {
    const { snapshotId, snapshot } = req.body || {};

    if (snapshotId) {
        const storedSnapshot = await db.ConsultantSnapshot.findOne({
            where: {
                id: snapshotId,
                tenantId: req.tenantId || req.tenant?.id
            }
        });

        if (!storedSnapshot) {
            return { error: { statusCode: 404, message: 'Consultant snapshot not found.' } };
        }

        return {
            snapshotId: storedSnapshot.id,
            snapshotHash: storedSnapshot.snapshotHash,
            snapshotInput: normalizeConsultantSnapshotInput(storedSnapshot.toJSON()),
            periodType: storedSnapshot.periodType,
            periodStart: storedSnapshot.periodStart,
            periodEnd: storedSnapshot.periodEnd,
            storeSnapshot: false
        };
    }

    if (snapshot && typeof snapshot === 'object') {
        const snapshotInput = normalizeConsultantSnapshotInput(snapshot);
        return {
            snapshotId: snapshot.snapshotId || null,
            snapshotHash: buildConsultantSnapshotHash(snapshotInput),
            snapshotInput,
            periodType: snapshot.period?.type || snapshot.periodType || 'daily',
            periodStart: snapshot.period?.start || snapshot.periodStart || null,
            periodEnd: snapshot.period?.end || snapshot.periodEnd || null,
            storeSnapshot: false
        };
    }

    return { error: { statusCode: 400, message: 'snapshot or snapshotId is required.' } };
}

exports.generateProduct = async (req, res) => {
    try {
        if (!(await requireAiQuota(req, res))) return;

        const { name_en, name_ar, brand, category, inputLanguage, mode, existingData } = req.body;
        const productName = name_en || name_ar;

        if (!productName) {
            return res.status(400).json({
                success: false,
                message: 'Product name (English or Arabic) is required for AI generation.'
            });
        }

        const lang = inputLanguage || (name_en ? 'English' : 'Arabic');
        const generatedData = await aiService.generateProductContent(
            productName,
            brand,
            category,
            lang,
            mode || 'search',
            existingData || {}
        );

        await recordAiUsage(req);

        return res.status(200).json({
            success: true,
            data: generatedData
        });
    } catch (error) {
        console.error('AI Generate Product Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate AI content. Ensure the API key is configured and try again.',
            error: error.message
        });
    }
};

exports.generateService = async (req, res) => {
    try {
        if (!(await requireAiQuota(req, res))) return;

        const { name_en, name_ar, category, inputLanguage } = req.body;
        const serviceName = name_en || name_ar;

        if (!serviceName) {
            return res.status(400).json({
                success: false,
                message: 'Service name (English or Arabic) is required for AI generation.'
            });
        }

        const lang = inputLanguage || (name_en ? 'English' : 'Arabic');
        const generatedData = await aiService.generateServiceContent(serviceName, category, lang);

        await recordAiUsage(req);

        return res.status(200).json({
            success: true,
            data: generatedData
        });
    } catch (error) {
        console.error('AI Generate Service Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate AI content. Ensure the API key is configured and try again.',
            error: error.message
        });
    }
};

exports.generateAboutUs = async (req, res) => {
    try {
        if (!(await requireAiQuota(req, res))) return;

        const { storyText, facilitiesText, inputLanguage } = req.body;

        if (!storyText || storyText.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Story text is required for AI enhancement.'
            });
        }

        const generatedData = await aiService.generateAboutUsContent(
            storyText,
            facilitiesText || '',
            inputLanguage || 'English'
        );

        await recordAiUsage(req);

        return res.status(200).json({
            success: true,
            data: generatedData
        });
    } catch (error) {
        console.error('AI Generate About Us Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to enhance About Us content.',
            error: error.message
        });
    }
};

exports.translateText = async (req, res) => {
    try {
        if (!(await requireAiQuota(req, res))) return;

        const { text, targetLanguage } = req.body;

        if (!text || !targetLanguage) {
            return res.status(400).json({
                success: false,
                message: 'Both text and targetLanguage are required.'
            });
        }

        if (!['English', 'Arabic'].includes(targetLanguage)) {
            return res.status(400).json({
                success: false,
                message: 'Target language must be either "English" or "Arabic".'
            });
        }

        const translatedText = await aiService.translateText(text, targetLanguage);

        await recordAiUsage(req);

        return res.status(200).json({
            success: true,
            translatedText
        });
    } catch (error) {
        console.error('AI Translate Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to translate text.',
            error: error.message
        });
    }
};

exports.analyzeConsultantSnapshot = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        const tenant = await db.Tenant.findByPk(tenantId, {
            attributes: ['id', 'country']
        });
        const tenantSettings = await db.TenantSettings.findOne({
            where: { tenantId },
            attributes: ['tenantId', 'notificationSettings', 'defaultLanguage']
        });
        const prepared = await loadConsultantSnapshotInput(req);

        if (prepared.error) {
            return res.status(prepared.error.statusCode || 400).json({
                success: false,
                message: prepared.error.message
            });
        }

        const snapshotHash = prepared.snapshotHash || buildConsultantSnapshotHash(prepared.snapshotInput);
        const communicationPreferences = normalizeCommunicationPreferences(
            tenantSettings?.notificationSettings?.consultantWorkflow?.communicationPreferences || {},
            getDefaultConsultantCommunicationPreferences({
                country: tenant?.country,
                defaultLanguage: tenantSettings?.defaultLanguage
            })
        );
        const analysisIdentityHash = buildConsultantAnalysisIdentityHash(snapshotHash, communicationPreferences);
        const cacheKey = buildConsultantAnalysisCacheKey(tenantId, analysisIdentityHash);

        const cached = await cacheService.get(cacheKey);
        if (cached) {
            const data = enrichConsultantResponseRoutes(cached.data || cached);
            return res.status(200).json({
                success: true,
                source: 'cache',
                data,
                reportId: cached.reportId || null,
                snapshotId: cached.snapshotId || prepared.snapshotId || null,
                snapshotHash: analysisIdentityHash
            });
        }

        const storedReport = await findStoredConsultantAnalysis(tenantId, analysisIdentityHash);
        if (storedReport?.reportData) {
            const data = enrichConsultantResponseRoutes(storedReport.reportData);
            const payload = {
                data,
                reportId: storedReport.id,
                snapshotId: storedReport.snapshotId || prepared.snapshotId || null,
                snapshotHash: analysisIdentityHash
            };
            await cacheService.set(cacheKey, payload, 60 * 60 * 24);
            return res.status(200).json({
                success: true,
                source: 'stored',
                ...payload
            });
        }

        if (!(await requireAiQuota(req, res))) return;

        const analysis = await aiService.generateConsultantAnalysis(prepared.snapshotInput, {
            temperature: 0.2,
            model: 'gpt-4o-mini',
            communicationPreferences
        });

        const normalizedAnalysis = enrichConsultantResponseRoutes(analysis);

        await recordAiUsage(req);

        const report = await saveConsultantReport({
            tenantId,
            snapshotId: prepared.snapshotId || null,
            createdByUserId: req.user?.id || req.tenantUserId || null,
            snapshotHash,
            analysisVersion: CONSULTANT_ANALYSIS_VERSION,
            title: 'Business Snapshot Analysis',
            description: 'AI-generated consultant analysis for a business snapshot.',
            periodType: prepared.periodType || 'daily',
            periodStart: prepared.periodStart || new Date().toISOString(),
            periodEnd: prepared.periodEnd || new Date().toISOString(),
            sections: ['summary', 'healthScore', 'kpis', 'charts', 'tables', 'alerts', 'recommendations', 'actions'],
            outputFormat: 'json',
            reportData: normalizedAnalysis,
            metadata: {
            snapshotHash,
            analysisVersion: CONSULTANT_ANALYSIS_VERSION,
            model: 'gpt-4o-mini',
            temperature: 0.2,
            source: 'openai',
            communicationPreferences,
            analysisIdentityHash
        }
        });

        const responsePayload = {
            data: normalizedAnalysis,
            reportId: report.id,
            snapshotId: prepared.snapshotId || null,
            snapshotHash: analysisIdentityHash
        };

        await cacheService.set(
            buildConsultantAnalysisCacheKey(tenantId, analysisIdentityHash),
            responsePayload,
            60 * 60 * 24
        );

        return res.status(200).json({
            success: true,
            source: 'openai',
            ...responsePayload
        });
    } catch (error) {
        console.error('Consultant analysis error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to analyze consultant snapshot.',
            error: error.message
        });
    }
};

exports.getConsultantReports = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '20', 10), 1), 100);
        const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
        const offset = (page - 1) * limit;
        const { count, rows } = await db.ConsultantReport.findAndCountAll({
            where: {
                tenantId,
                reportType: 'consultant_analysis'
            },
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        return res.status(200).json(paginatedResponse(
            rows.map((row) => row.toJSON()),
            count,
            page,
            limit
        ));
    } catch (error) {
        console.error('Get consultant reports error:', error);
        return res.status(500).json(errorResponse('Failed to load consultant reports', error.message));
    }
};

exports.getConsultantReport = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        const report = await db.ConsultantReport.findOne({
            where: {
                id: req.params.id,
                tenantId,
                reportType: 'consultant_analysis'
            }
        });

        if (!report) {
            return res.status(404).json(errorResponse('Consultant report not found'));
        }

        return res.status(200).json(successResponse('Consultant report retrieved', report.toJSON()));
    } catch (error) {
        console.error('Get consultant report error:', error);
        return res.status(500).json(errorResponse('Failed to load consultant report', error.message));
    }
};

exports.getConsultantBriefings = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '20', 10), 1), 100);
        const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
        const { count, rows } = await listConsultantBriefings({
            tenantId,
            limit,
            page
        });

        return res.status(200).json(paginatedResponse(
            rows.map((row) => row.toJSON()),
            count,
            page,
            limit
        ));
    } catch (error) {
        console.error('Get consultant briefings error:', error);
        return res.status(500).json(errorResponse('Failed to load consultant briefings', error.message));
    }
};

exports.getConsultantBriefing = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        const briefing = await db.ConsultantReport.findOne({
            where: {
                id: req.params.id,
                tenantId,
                reportType: 'consultant_briefing'
            }
        });

        if (!briefing) {
            return res.status(404).json(errorResponse('Consultant briefing not found'));
        }

        return res.status(200).json(successResponse('Consultant briefing retrieved', briefing.toJSON()));
    } catch (error) {
        console.error('Get consultant briefing error:', error);
        return res.status(500).json(errorResponse('Failed to load consultant briefing', error.message));
    }
};

exports.runConsultantWorkflow = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.tenant?.id;
        const result = await processConsultantWorkflowForTenant({
            tenantId,
            now: new Date(),
            force: Boolean(req.body?.force),
            bypassAutomationGate: true
        });

        return res.status(200).json(successResponse('Consultant workflow processed', result));
    } catch (error) {
        console.error('Run consultant workflow error:', error);
        return res.status(500).json(errorResponse('Failed to process consultant workflow', error.message));
    }
};

exports.__consultantFormatter = {
    normalizeConsultantStructuredResponse,
    enrichConsultantResponseRoutes,
    inferConsultantActionRoute
};

exports.requireConsultantSubscription = requireConsultantSubscription;
