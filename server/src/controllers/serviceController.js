const db = require('../models');

/**
 * Get all services
 */
const getServices = async (req, res) => {
    try {
        const { category, isActive } = req.query;

        const where = {};
        if (category) where.category = category;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const services = await db.Service.findAll({ where });

        res.json({ services, count: services.length });
    } catch (error) {
        console.error('Get services error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create a new service
 */
const createService = async (req, res) => {
    try {
        const service = await db.Service.create(req.body);
        res.status(201).json({ message: 'Service created', service });
    } catch (error) {
        console.error('Create service error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getServices,
    createService
};
