const aiService = require('../../services/aiService');
const cacheService = require('../../services/cacheService');
const db = require('../../models');
const {
    assertFeatureQuotaAvailable,
    incrementMonthlyFeatureUsage
} = require('../../services/subscriptionConsumptionService');
const { saveConsultantReport } = require('../../services/consultantSnapshotService');
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
        const prepared = await loadConsultantSnapshotInput(req);

        if (prepared.error) {
            return res.status(prepared.error.statusCode || 400).json({
                success: false,
                message: prepared.error.message
            });
        }

        const snapshotHash = prepared.snapshotHash || buildConsultantSnapshotHash(prepared.snapshotInput);
        const cacheKey = buildConsultantAnalysisCacheKey(tenantId, snapshotHash);

        const cached = await cacheService.get(cacheKey);
        if (cached) {
            return res.status(200).json({
                success: true,
                source: 'cache',
                data: cached.data || cached,
                reportId: cached.reportId || null,
                snapshotId: cached.snapshotId || prepared.snapshotId || null,
                snapshotHash
            });
        }

        const storedReport = await findStoredConsultantAnalysis(tenantId, snapshotHash);
        if (storedReport?.reportData) {
            const payload = {
                data: storedReport.reportData,
                reportId: storedReport.id,
                snapshotId: storedReport.snapshotId || prepared.snapshotId || null,
                snapshotHash
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
            model: 'gpt-4o-mini'
        });

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
            sections: ['executiveSummary', 'healthScore', 'observations', 'risks', 'opportunities', 'recommendations', 'suggestedActions'],
            outputFormat: 'json',
            reportData: analysis,
            metadata: {
                snapshotHash,
                analysisVersion: CONSULTANT_ANALYSIS_VERSION,
                model: 'gpt-4o-mini',
                temperature: 0.2,
                source: 'openai'
            }
        });

        const responsePayload = {
            data: analysis,
            reportId: report.id,
            snapshotId: prepared.snapshotId || null,
            snapshotHash
        };

        await cacheService.set(cacheKey, responsePayload, 60 * 60 * 24);

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
