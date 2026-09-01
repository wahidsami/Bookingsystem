const db = require('../models');
const notificationOrchestrator = require('../services/notificationOrchestratorService');

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
};

const recalculateStaffRating = async (staffId) => {
    if (!staffId) return;

    const reviews = await db.Review.findAll({
        where: { staffId, isVisible: true },
        attributes: ['rating']
    });

    const avg = reviews.length > 0
        ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
        : 5;

    await db.Staff.update(
        { rating: Number(avg.toFixed(2)) },
        { where: { id: staffId } }
    );
};

exports.createCustomerReview = async (req, res) => {
    try {
        const platformUserId = req.userId;
        const {
            tenantId,
            appointmentId,
            staffId = null,
            rating,
            comment = '',
            customerName
        } = req.body || {};

        if (!tenantId || !appointmentId || !rating) {
            return res.status(400).json({
                success: false,
                message: 'tenantId, appointmentId and rating are required'
            });
        }

        const parsedRating = toNumber(rating);
        if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be a number between 1 and 5'
            });
        }

        const appointment = await db.Appointment.findOne({
            where: {
                id: appointmentId,
                tenantId,
                platformUserId
            }
        });

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found for this account'
            });
        }

        if (appointment.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Only completed appointments can be reviewed'
            });
        }

        const existingReview = await db.Review.findOne({
            where: {
                appointmentId,
                platformUserId
            }
        });

        if (existingReview) {
            return res.status(409).json({
                success: false,
                message: 'You already submitted a review for this appointment'
            });
        }

        let resolvedStaffId = staffId || appointment.staffId || null;
        if (resolvedStaffId) {
            const staff = await db.Staff.findOne({
                where: {
                    id: resolvedStaffId,
                    tenantId
                }
            });
            if (!staff) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected staff member does not belong to this tenant'
                });
            }
        }

        const user = await db.PlatformUser.findByPk(platformUserId);
        const fallbackCustomerName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.email || 'Customer';

        const review = await db.Review.create({
            tenantId,
            appointmentId,
            staffId: resolvedStaffId,
            platformUserId,
            customerName: (typeof customerName === 'string' && customerName.trim()) ? customerName.trim() : fallbackCustomerName,
            rating: Math.round(parsedRating),
            comment: typeof comment === 'string' ? comment.trim() : null,
            isVisible: true
        });

        await recalculateStaffRating(resolvedStaffId);
        if (resolvedStaffId) {
            try {
                await notificationOrchestrator.notifyStaff({
                    tenantId,
                    staffId: resolvedStaffId,
                    eventType: 'staff_new_review',
                    title: 'New customer review',
                    body: `You received a ${Math.round(parsedRating)}/5 review.`,
                    data: {
                        type: 'staff_new_review',
                        reviewId: review.id,
                        appointmentId,
                        tenantId
                    }
                });
            } catch (pushError) {
                console.warn('Staff review push warning:', pushError.message);
            }
        }

        return res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            review
        });
    } catch (error) {
        console.error('Create customer review error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to submit review',
            error: error.message
        });
    }
};

exports.getCustomerReviews = async (req, res) => {
    try {
        const platformUserId = req.userId;
        const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 100);

        const reviews = await db.Review.findAll({
            where: { platformUserId },
            include: [
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'slug', 'logo'],
                    required: false
                },
                {
                    model: db.Staff,
                    as: 'staff',
                    attributes: ['id', 'name', 'photo'],
                    required: false
                },
                {
                    model: db.Appointment,
                    as: 'appointment',
                    attributes: ['id', 'status', 'startTime', 'serviceVariantName'],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']],
            limit
        });

        return res.json({
            success: true,
            reviews
        });
    } catch (error) {
        console.error('Get customer reviews error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch customer reviews',
            error: error.message
        });
    }
};

exports.getTenantPublicReviews = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);

        const reviews = await db.Review.findAll({
            where: {
                tenantId,
                isVisible: true
            },
            include: [
                {
                    model: db.Staff,
                    as: 'staff',
                    attributes: ['id', 'name', 'photo'],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']],
            limit
        });

        const total = reviews.length;
        const avgRating = total > 0
            ? Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / total).toFixed(1))
            : null;

        return res.json({
            success: true,
            reviews,
            summary: {
                total,
                avgRating
            }
        });
    } catch (error) {
        console.error('Get tenant public reviews error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch reviews',
            error: error.message
        });
    }
};

exports.getStaffPublicReviews = async (req, res) => {
    try {
        const { staffId } = req.params;
        const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);

        const reviews = await db.Review.findAll({
            where: {
                staffId,
                isVisible: true
            },
            order: [['createdAt', 'DESC']],
            limit
        });

        const total = reviews.length;
        const avgRating = total > 0
            ? Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / total).toFixed(1))
            : null;

        return res.json({
            success: true,
            reviews,
            summary: {
                total,
                avgRating
            }
        });
    } catch (error) {
        console.error('Get staff public reviews error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch staff reviews',
            error: error.message
        });
    }
};
