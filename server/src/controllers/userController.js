const db = require('../models');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads (profile photos)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/profiles');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `profile-${req.userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
        }
    }
});

/**
 * Get user profile
 * GET /api/v1/users/profile
 */
const getProfile = async (req, res) => {
    try {
        const user = await db.PlatformUser.findByPk(req.userId, {
            attributes: { exclude: ['password', 'refreshToken'] }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: user.toSafeObject()
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Update user profile
 * PUT /api/v1/users/profile
 */
const updateProfile = async (req, res) => {
    try {
        const { 
            firstName, 
            lastName, 
            dateOfBirth, 
            gender, 
            preferredLanguage, 
            notificationPreferences,
            // Address fields
            addressStreet,
            addressCity,
            addressBuilding,
            addressFloor,
            addressApartment,
            addressPhone,
            addressNotes
        } = req.body;

        const user = await db.PlatformUser.findByPk(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update allowed fields
        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
        if (gender !== undefined) user.gender = gender;
        if (preferredLanguage !== undefined) user.preferredLanguage = preferredLanguage;
        if (notificationPreferences) {
            user.notificationPreferences = {
                ...user.notificationPreferences,
                ...notificationPreferences
            };
        }

        // Update address fields
        if (addressStreet !== undefined) user.addressStreet = addressStreet;
        if (addressCity !== undefined) user.addressCity = addressCity;
        if (addressBuilding !== undefined) user.addressBuilding = addressBuilding;
        if (addressFloor !== undefined) user.addressFloor = addressFloor;
        if (addressApartment !== undefined) user.addressApartment = addressApartment;
        if (addressPhone !== undefined) user.addressPhone = addressPhone;
        if (addressNotes !== undefined) user.addressNotes = addressNotes;

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: user.toSafeObject()
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Upload profile photo
 * POST /api/v1/users/profile/photo
 */
const uploadPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const user = await db.PlatformUser.findByPk(req.userId);
        if (!user) {
            // Delete uploaded file if user not found
            fs.unlinkSync(req.file.path);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Delete old photo if exists
        if (user.profileImage) {
            const oldPhotoPath = path.join(__dirname, '../../uploads/profiles', path.basename(user.profileImage));
            if (fs.existsSync(oldPhotoPath)) {
                fs.unlinkSync(oldPhotoPath);
            }
        }

        // Save photo path (relative to uploads folder)
        const photoPath = `/uploads/profiles/${req.file.filename}`;
        user.profileImage = photoPath;
        await user.save();

        res.json({
            success: true,
            message: 'Profile photo uploaded successfully',
            profileImage: photoPath
        });
    } catch (error) {
        console.error('Upload photo error:', error);
        // Delete uploaded file on error
        if (req.file && req.file.path) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Change password
 * PUT /api/v1/users/password
 */
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters long'
            });
        }

        const user = await db.PlatformUser.findByPk(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isValidPassword = await user.validatePassword(currentPassword);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password (will be hashed by model hook)
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get user bookings (all salons)
 * GET /api/v1/users/bookings
 */
const getUserBookings = async (req, res) => {
    try {
        const { status, startDate, endDate, tenantId } = req.query;

        const where = {
            platformUserId: req.userId
        };

        if (status) where.status = status;
        if (tenantId) where.tenantId = tenantId;

        if (startDate || endDate) {
            where.startTime = {};
            if (startDate) where.startTime[Op.gte] = new Date(startDate);
            if (endDate) where.startTime[Op.lte] = new Date(endDate);
        }

        const bookings = await db.Appointment.findAll({
            where,
            include: [
                { model: db.Service, as: 'service' },
                { model: db.Staff, as: 'staff' },
                { model: db.Tenant, as: 'tenant', required: false }
            ],
            order: [['startTime', 'DESC']]
        });

        res.json({
            success: true,
            bookings: bookings,
            appointments: bookings, // Also include as 'appointments' for compatibility
            count: bookings.length
        });
    } catch (error) {
        console.error('Get user bookings error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get services history (services user has booked)
 * GET /api/v1/users/services-history
 */
const getServicesHistory = async (req, res) => {
    try {
        const bookings = await db.Appointment.findAll({
            where: {
                platformUserId: req.userId,
                status: { [Op.in]: ['completed', 'confirmed'] }
            },
            include: [
                { model: db.Service, as: 'service' },
                { model: db.Tenant, as: 'tenant', required: false }
            ],
            order: [['startTime', 'DESC']]
        });

        // Group by service
        const serviceMap = new Map();
        bookings.forEach(booking => {
            if (booking.Service) {
                const serviceId = booking.Service.id;
                if (!serviceMap.has(serviceId)) {
                    serviceMap.set(serviceId, {
                        service: booking.Service,
                        count: 0,
                        totalSpent: 0,
                        lastBooked: null,
                        salons: new Set()
                    });
                }
                const entry = serviceMap.get(serviceId);
                entry.count++;
                entry.totalSpent += parseFloat(booking.price);
                if (!entry.lastBooked || booking.startTime > entry.lastBooked) {
                    entry.lastBooked = booking.startTime;
                }
                if (booking.tenant) {
                    entry.salons.add(booking.tenant.name);
                }
            }
        });

        const servicesHistory = Array.from(serviceMap.values()).map(entry => ({
            service: entry.service,
            count: entry.count,
            totalSpent: entry.totalSpent,
            lastBooked: entry.lastBooked,
            salons: Array.from(entry.salons)
        }));

        res.json({
            success: true,
            servicesHistory,
            count: servicesHistory.length
        });
    } catch (error) {
        console.error('Get services history error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    uploadPhoto,
    changePassword,
    getUserBookings,
    getServicesHistory,
    uploadMiddleware: upload.single('photo')
};

