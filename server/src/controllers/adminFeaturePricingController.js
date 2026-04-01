const db = require('../models');
const { FeaturePricing } = db;

exports.getFeaturePricings = async (req, res) => {
    try {
        const features = await FeaturePricing.findAll({
            order: [['label', 'ASC']]
        });

        res.status(200).json({
            success: true,
            count: features.length,
            features
        });
    } catch (error) {
        console.error('Error fetching feature pricings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch feature pricings',
            error: error.message
        });
    }
};

exports.updateFeaturePricing = async (req, res) => {
    try {
        const { key } = req.params;
        const { unitPrice } = req.body;

        if (unitPrice === undefined || Number.isNaN(parseFloat(unitPrice))) {
            return res.status(400).json({
                success: false,
                message: 'Valid unitPrice is required'
            });
        }

        const feature = await FeaturePricing.findOne({
            where: { featureKey: key }
        });

        if (!feature) {
            return res.status(404).json({
                success: false,
                message: `Feature pricing with key ${key} not found`
            });
        }

        feature.unitPrice = parseFloat(unitPrice);
        await feature.save();

        res.status(200).json({
            success: true,
            message: 'Feature pricing updated successfully',
            feature
        });
    } catch (error) {
        console.error('Error updating feature pricing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update feature pricing',
            error: error.message
        });
    }
};
