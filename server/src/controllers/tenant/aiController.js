const aiService = require('../../services/aiService');
const {
    assertFeatureQuotaAvailable,
    incrementMonthlyFeatureUsage
} = require('../../services/subscriptionConsumptionService');

const AI_FEATURE_KEY = 'aiContentAssistant';

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
