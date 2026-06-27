const { Op } = require('sequelize');
const db = require('../models');
const {
    DIMENSIONS,
    METRICS,
    GROUPINGS,
    OUTPUT_TYPES,
    normalizeReportConfig,
    calcNextRunAt,
    previewReport,
    listSavedReports,
    serializeSavedReport
} = require('../services/adminReportBuilderService');
const { successResponse, errorResponse } = require('../utils/responses');

function normalizeScheduleConfig(scheduleConfig = {}) {
    return {
        enabled: Boolean(scheduleConfig.enabled),
        cadence: `${scheduleConfig.cadence || 'daily'}`.trim(),
        timeOfDay: `${scheduleConfig.timeOfDay || '09:00'}`.trim(),
        dayOfWeek: Number.isInteger(scheduleConfig.dayOfWeek) ? scheduleConfig.dayOfWeek : null,
        dayOfMonth: Number.isInteger(scheduleConfig.dayOfMonth) ? scheduleConfig.dayOfMonth : null,
        recipients: Array.isArray(scheduleConfig.recipients) ? scheduleConfig.recipients.filter(Boolean) : []
    };
}

function buildSavedReportPayload(body = {}, fallback = {}) {
    const normalized = normalizeReportConfig({ ...fallback, ...body });
    const title = `${body.title || fallback.title || normalized.title || ''}`.trim();

    return {
        title,
        description: body.description ?? fallback.description ?? normalized.description ?? null,
        reportType: normalized.reportType,
        dimensions: normalized.dimensions,
        metrics: normalized.metrics,
        grouping: normalized.grouping,
        filters: normalized.filters,
        outputType: normalized.outputType,
        chartType: normalized.chartType,
        reportConfig: {
            ...normalized,
            title,
            description: body.description ?? fallback.description ?? normalized.description ?? null
        },
        scheduleConfig: normalizeScheduleConfig(body.scheduleConfig || fallback.scheduleConfig || {}),
        isFavorite: Boolean(body.isFavorite ?? fallback.isFavorite ?? false)
    };
}

async function findAdminSavedReport(reportId) {
    return db.AdminSavedReport.findByPk(reportId, {
        include: [
            {
                model: db.SuperAdmin,
                as: 'creator',
                attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
                required: false
            }
        ]
    });
}

exports.getReportBuilderOptions = async (req, res) => {
    try {
        const [employees, services, customers, products] = await Promise.all([
            db.Staff.findAll({
                attributes: ['id', 'name', 'email', 'position', 'tenantId'],
                include: [{ model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar'], required: false }],
                order: [['name', 'ASC']],
                limit: 100
            }),
            db.Service.findAll({
                attributes: ['id', 'name_en', 'name_ar', 'category', 'tenantId'],
                include: [{ model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar'], required: false }],
                order: [['name_en', 'ASC']],
                limit: 100
            }),
            db.PlatformUser.findAll({
                attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
                order: [['createdAt', 'DESC']],
                limit: 100
            }),
            db.Product.findAll({
                attributes: ['id', 'name_en', 'name_ar', 'sku', 'category', 'tenantId'],
                include: [{ model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar'], required: false }],
                order: [['name_en', 'ASC']],
                limit: 100
            })
        ]);

        res.json(successResponse('Report builder options retrieved', {
            dimensions: DIMENSIONS,
            metrics: METRICS,
            groupings: GROUPINGS,
            outputTypes: OUTPUT_TYPES,
            employees: employees.map((employee) => ({
                id: employee.id,
                name: employee.name,
                label: employee.name,
                tenantName: employee.tenant?.name || employee.tenant?.name_en || employee.tenant?.name_ar || '-'
            })),
            services: services.map((service) => ({
                id: service.id,
                name: service.name_en || service.name_ar || 'Service',
                label: service.name_en || service.name_ar || 'Service',
                category: service.category || '-',
                tenantName: service.tenant?.name || service.tenant?.name_en || service.tenant?.name_ar || '-'
            })),
            customers: customers.map((customer) => ({
                id: customer.id,
                name: [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || customer.email || '-',
                label: [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || customer.email || '-',
                email: customer.email || '-'
            })),
            products: products.map((product) => ({
                id: product.id,
                name: product.name_en || product.name_ar || 'Product',
                label: product.name_en || product.name_ar || 'Product',
                category: product.category || '-',
                tenantName: product.tenant?.name || product.tenant?.name_en || product.tenant?.name_ar || '-'
            }))
        }));
    } catch (error) {
        console.error('Get report builder options error:', error);
        res.status(500).json(errorResponse('Failed to fetch report builder options', error.message));
    }
};

exports.previewReport = async (req, res) => {
    try {
        const preview = await previewReport(req.body || {});
        res.json(successResponse('Report preview generated', preview));
    } catch (error) {
        console.error('Preview report error:', error);
        res.status(500).json(errorResponse('Failed to preview report', error.message));
    }
};

exports.getSavedReports = async (req, res) => {
    try {
        const reports = await listSavedReports();
        res.json(successResponse('Saved reports retrieved', reports.map(serializeSavedReport)));
    } catch (error) {
        console.error('Get saved reports error:', error);
        res.status(500).json(errorResponse('Failed to load saved reports', error.message));
    }
};

exports.getSavedReport = async (req, res) => {
    try {
        const savedReport = await findAdminSavedReport(req.params.id);
        if (!savedReport) {
            return res.status(404).json(errorResponse('Saved report not found'));
        }

        res.json(successResponse('Saved report retrieved', serializeSavedReport(savedReport)));
    } catch (error) {
        console.error('Get saved report error:', error);
        res.status(500).json(errorResponse('Failed to load saved report', error.message));
    }
};

exports.createSavedReport = async (req, res) => {
    try {
        const duplicatedFromId = req.body?.duplicatedFromId || null;
        let fallback = {};

        if (duplicatedFromId) {
            const source = await findAdminSavedReport(duplicatedFromId);
            if (!source) {
                return res.status(404).json(errorResponse('Source report not found'));
            }

            fallback = {
                title: `${source.title} Copy`,
                description: source.description,
                reportType: source.reportType,
                dimensions: source.dimensions,
                metrics: source.metrics,
                grouping: source.grouping,
                filters: source.filters,
                outputType: source.outputType,
                chartType: source.chartType,
                scheduleConfig: source.scheduleConfig,
                isFavorite: source.isFavorite
            };
        }

        const payload = buildSavedReportPayload(req.body || {}, fallback);

        if (!payload.title) {
            return res.status(400).json(errorResponse('title is required'));
        }

        const savedReport = await db.AdminSavedReport.create({
            createdByAdminId: req.adminId || null,
            reportType: payload.reportType,
            title: payload.title,
            description: payload.description,
            dimensions: payload.dimensions,
            metrics: payload.metrics,
            grouping: payload.grouping,
            filters: payload.filters,
            outputType: payload.outputType,
            chartType: payload.chartType,
            reportConfig: payload.reportConfig,
            scheduleConfig: payload.scheduleConfig,
            isFavorite: payload.isFavorite,
            duplicatedFromId,
            nextRunAt: calcNextRunAt(payload.scheduleConfig)
        });

        const withCreator = await findAdminSavedReport(savedReport.id);
        res.status(201).json(successResponse('Saved report created', serializeSavedReport(withCreator || savedReport)));
    } catch (error) {
        console.error('Create saved report error:', error);
        res.status(500).json(errorResponse('Failed to save report', error.message));
    }
};

exports.updateSavedReport = async (req, res) => {
    try {
        const savedReport = await findAdminSavedReport(req.params.id);
        if (!savedReport) {
            return res.status(404).json(errorResponse('Saved report not found'));
        }

        const payload = buildSavedReportPayload(req.body || {}, savedReport.get({ plain: true }));
        savedReport.title = payload.title || savedReport.title;
        savedReport.description = payload.description;
        savedReport.reportType = payload.reportType;
        savedReport.dimensions = payload.dimensions;
        savedReport.metrics = payload.metrics;
        savedReport.grouping = payload.grouping;
        savedReport.filters = payload.filters;
        savedReport.outputType = payload.outputType;
        savedReport.chartType = payload.chartType;
        savedReport.reportConfig = payload.reportConfig;
        savedReport.scheduleConfig = payload.scheduleConfig;
        savedReport.isFavorite = payload.isFavorite;
        if (req.body?.lastRunResult) {
            savedReport.lastRunResult = req.body.lastRunResult;
        }
        savedReport.nextRunAt = payload.scheduleConfig.enabled ? calcNextRunAt(payload.scheduleConfig) : null;

        await savedReport.save();

        const withCreator = await findAdminSavedReport(savedReport.id);
        res.json(successResponse('Saved report updated', serializeSavedReport(withCreator || savedReport)));
    } catch (error) {
        console.error('Update saved report error:', error);
        res.status(500).json(errorResponse('Failed to update saved report', error.message));
    }
};

exports.deleteSavedReport = async (req, res) => {
    try {
        const deleted = await db.AdminSavedReport.destroy({
            where: { id: req.params.id }
        });

        if (!deleted) {
            return res.status(404).json(errorResponse('Saved report not found'));
        }

        res.json(successResponse('Saved report deleted', { id: req.params.id }));
    } catch (error) {
        console.error('Delete saved report error:', error);
        res.status(500).json(errorResponse('Failed to delete saved report', error.message));
    }
};

exports.runSavedReport = async (req, res) => {
    try {
        const savedReport = await findAdminSavedReport(req.params.id);
        if (!savedReport) {
            return res.status(404).json(errorResponse('Saved report not found'));
        }

        const preview = await previewReport(savedReport.reportConfig || {
            title: savedReport.title,
            description: savedReport.description,
            dimensions: savedReport.dimensions,
            metrics: savedReport.metrics,
            grouping: savedReport.grouping,
            filters: savedReport.filters,
            outputType: savedReport.outputType,
            chartType: savedReport.chartType,
            scheduleConfig: savedReport.scheduleConfig,
            reportType: savedReport.reportType
        });

        savedReport.lastRunAt = new Date();
        savedReport.lastRunResult = preview;
        if (savedReport.scheduleConfig?.enabled) {
            savedReport.nextRunAt = calcNextRunAt(savedReport.scheduleConfig, new Date());
        }
        await savedReport.save();

        res.json(successResponse('Saved report run completed', {
            report: serializeSavedReport(savedReport),
            preview
        }));
    } catch (error) {
        console.error('Run saved report error:', error);
        res.status(500).json(errorResponse('Failed to run saved report', error.message));
    }
};

exports.previewSavedReport = async (req, res) => {
    try {
        const savedReport = await findAdminSavedReport(req.params.id);
        if (!savedReport) {
            return res.status(404).json(errorResponse('Saved report not found'));
        }

        const preview = await previewReport(savedReport.reportConfig || {});
        res.json(successResponse('Saved report preview generated', preview));
    } catch (error) {
        console.error('Preview saved report error:', error);
        res.status(500).json(errorResponse('Failed to preview saved report', error.message));
    }
};

exports.runScheduledReports = async () => {
    const dueReports = await db.AdminSavedReport.findAll({
        where: {
            nextRunAt: { [Op.lte]: new Date() }
        }
    });

    for (const report of dueReports || []) {
        if (!report.scheduleConfig?.enabled) continue;
        try {
            const preview = await previewReport(report.reportConfig || {});
            report.lastRunAt = new Date();
            report.lastRunResult = preview;
            report.nextRunAt = calcNextRunAt(report.scheduleConfig, new Date());
            await report.save();
        } catch (error) {
            console.error(`Scheduled report run failed for ${report.id}:`, error);
        }
    }
};
