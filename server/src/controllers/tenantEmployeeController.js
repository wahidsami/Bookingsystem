/**
 * Tenant Employee Controller
 * Handles employee (staff) management for authenticated tenants
 */

const db = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { normalizeEmployeePosition, VALID_EMPLOYEE_POSITIONS } = require('../utils/employeePositions');
const { normalizeEmployeeGender, VALID_EMPLOYEE_GENDERS } = require('../utils/employeeGenders');
const { normalizeDashboardPermissions, ROLE_PRESETS } = require('../utils/tenantDashboardPermissions');

const normalizeEmail = (value) => value.trim().toLowerCase();
const DEFAULT_STAFF_PERMISSIONS = {
    view_earnings: false,
    view_reviews: true,
    reply_reviews: false,
    view_clients: false,
    view_booking_notes: false,
    can_start_service: true,
    can_mark_no_show: true
};
const VALID_SCHEDULE_VISIBILITY_WEEKS = [1, 2, 3, 4];
const DEFAULT_EMPLOYEE_LIMIT = 12;
const MAX_EMPLOYEE_LIMIT = 100;

const EMPLOYEE_GENDER_SORT_ORDER = {
    male: 1,
    female: 2,
    other: 3,
    prefer_not_to_say: 4
};

const parseScheduleVisibilityWeeks = (value, fallback = 1) => {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || !VALID_SCHEDULE_VISIBILITY_WEEKS.includes(parsed)) {
        return null;
    }

    return parsed;
};

const parsePaginationValue = (value, fallback, min, max) => {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
        return null;
    }

    return Math.min(Math.max(parsed, min), max);
};

const parseBooleanField = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    const normalized = `${value}`.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
        return false;
    }

    return fallback;
};

const parseStringArrayField = (value, fallback = []) => {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    if (Array.isArray(value)) {
        return value.map((item) => `${item || ''}`.trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return fallback;
        }

        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => `${item || ''}`.trim()).filter(Boolean);
            }

            if (typeof parsed === 'string') {
                return parseStringArrayField(parsed, fallback);
            }
        } catch (parseError) {
            // Fall through to comma-separated parsing below.
        }

        return trimmed.split(',').map((item) => `${item || ''}`.trim()).filter(Boolean);
    }

    if (typeof value === 'object') {
        return Object.values(value).map((item) => `${item || ''}`.trim()).filter(Boolean);
    }

    return fallback;
};

const getEmployeeSortOrder = (sortBy) => {
    const normalizedSortBy = `${sortBy || 'alphabetical'}`.trim().toLowerCase();

    if (normalizedSortBy === 'gender') {
        return [
            [
                db.sequelize.literal(`CASE
                    WHEN "gender" = 'male' THEN ${EMPLOYEE_GENDER_SORT_ORDER.male}
                    WHEN "gender" = 'female' THEN ${EMPLOYEE_GENDER_SORT_ORDER.female}
                    WHEN "gender" = 'other' THEN ${EMPLOYEE_GENDER_SORT_ORDER.other}
                    WHEN "gender" = 'prefer_not_to_say' THEN ${EMPLOYEE_GENDER_SORT_ORDER.prefer_not_to_say}
                    ELSE 99
                END`),
                'ASC'
            ],
            ['name', 'ASC']
        ];
    }

    if (normalizedSortBy === 'alphabetical_desc' || normalizedSortBy === 'name_desc') {
        return [
            ['name', 'DESC'],
            ['createdAt', 'DESC']
        ];
    }

    if (normalizedSortBy === 'created_at' || normalizedSortBy === 'created') {
        return [
            ['createdAt', 'DESC'],
            ['name', 'ASC']
        ];
    }

    return [
        ['name', 'ASC'],
        ['createdAt', 'DESC']
    ];
};

const normalizeStoredDashboardPermissions = (permissions, position) => {
    const normalizedPosition = normalizeEmployeePosition(position);
    const roleKey = normalizedPosition && Object.prototype.hasOwnProperty.call(ROLE_PRESETS, normalizedPosition)
        ? normalizedPosition
        : 'custom';

    return normalizeDashboardPermissions(permissions || {}, roleKey);
};

const generateTemporaryStaffPassword = () => {
    const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `Rifah!${suffix}`;
};

const buildStaffAppAccessPayload = ({ email, hasAccount, temporaryPassword = null, passwordUpdated = false, accountRemoved = false }) => ({
    email,
    hasAccount,
    temporaryPassword,
    passwordUpdated,
    accountRemoved
});

const getOrCreateStaffPermissionRecord = async (staffId, tenantId, transaction = null) => {
    const [record] = await db.StaffPermission.findOrCreate({
        where: { staffId },
        defaults: {
            staffId,
            tenantId,
            permissions: DEFAULT_STAFF_PERMISSIONS
        },
        transaction
    });

    if (!record.tenantId || record.tenantId !== tenantId) {
        await record.update({ tenantId }, { transaction });
    }

    return record;
};

const syncStaffAuthAccount = async ({
    tenantId,
    previousEmail = null,
    nextEmail = null,
    password = null,
    transaction
}) => {
    const previousNormalized = previousEmail ? normalizeEmail(previousEmail) : null;
    const nextNormalized = nextEmail ? normalizeEmail(nextEmail) : null;

    if (!previousNormalized && !nextNormalized) {
        return buildStaffAppAccessPayload({
            email: null,
            hasAccount: false
        });
    }

    const findStaffUserByEmail = async (email) => db.User.findOne({
        where: {
            email: {
                [Op.iLike]: email
            },
            tenantId,
            role: 'staff'
        },
        transaction
    });

    const ensureEmailIsAvailable = async (email, currentUserId = null) => {
        const conflictingUser = await db.User.findOne({
            where: { email },
            transaction
        });

        if (!conflictingUser) {
            return;
        }

        if (currentUserId && conflictingUser.id === currentUserId) {
            return;
        }

        if (conflictingUser.role !== 'staff' || conflictingUser.tenantId !== tenantId) {
            throw new Error('This email is already used by another account');
        }
    };

    const previousUser = previousNormalized ? await findStaffUserByEmail(previousNormalized) : null;

    if (!nextNormalized) {
        if (previousUser) {
            await previousUser.destroy({ transaction });
        }

        return buildStaffAppAccessPayload({
            email: null,
            hasAccount: false,
            accountRemoved: Boolean(previousUser)
        });
    }

    await ensureEmailIsAvailable(nextNormalized, previousUser?.id || null);

    if (previousUser) {
        const updates = {};
        if (previousUser.email !== nextNormalized) {
            updates.email = nextNormalized;
        }
        if (password) {
            updates.password = password;
        }

        if (Object.keys(updates).length > 0) {
            await previousUser.update(updates, { transaction });
        }

        return buildStaffAppAccessPayload({
            email: nextNormalized,
            hasAccount: true,
            passwordUpdated: Boolean(password)
        });
    }

    const finalPassword = password || generateTemporaryStaffPassword();
    await db.User.create({
        email: nextNormalized,
        password: finalPassword,
        role: 'staff',
        tenantId
    }, { transaction });

    return buildStaffAppAccessPayload({
        email: nextNormalized,
        hasAccount: true,
        temporaryPassword: finalPassword,
        passwordUpdated: Boolean(password)
    });
};

const buildDashboardAccountPayload = ({ accountId = null, email, hasAccount, temporaryPassword = null, passwordUpdated = false, accountRemoved = false, needsEmail = false }) => ({
    accountId,
    email,
    hasAccount,
    temporaryPassword,
    passwordUpdated,
    accountRemoved,
    needsEmail
});

const syncTenantDashboardAccount = async ({
    tenantId,
    previousEmail = null,
    nextEmail = null,
    displayName = '',
    position = null,
    permissions = null,
    password = null,
    transaction
}) => {
    const previousNormalized = previousEmail ? normalizeEmail(previousEmail) : null;
    const nextNormalized = nextEmail ? normalizeEmail(nextEmail) : null;
    const normalizedPosition = normalizeEmployeePosition(position);
    const isDashboardManaged = Boolean(normalizedPosition && normalizedPosition !== 'service_provider');

    const findDashboardAccountByEmail = async (email) => db.TenantDashboardAccount.findOne({
        where: {
            tenantId,
            email: {
                [Op.iLike]: email
            }
        },
        transaction
    });

    const previousAccount = previousNormalized
        ? await findDashboardAccountByEmail(previousNormalized)
        : null;
    const nextAccount = nextNormalized
        ? await findDashboardAccountByEmail(nextNormalized)
        : null;
    const existingAccount = previousAccount || nextAccount;

    if (!isDashboardManaged) {
        if (existingAccount) {
            await existingAccount.destroy({ transaction });
        }

        return buildDashboardAccountPayload({
            accountId: previousAccount?.id || nextAccount?.id || null,
            email: null,
            hasAccount: false,
            accountRemoved: Boolean(existingAccount)
        });
    }

    if (!nextNormalized) {
        if (existingAccount) {
            await existingAccount.destroy({ transaction });
        }

        return buildDashboardAccountPayload({
            accountId: previousAccount?.id || nextAccount?.id || null,
            email: null,
            hasAccount: false,
            accountRemoved: Boolean(existingAccount),
            needsEmail: true
        });
    }

    const roleKey = normalizedPosition && Object.prototype.hasOwnProperty.call(ROLE_PRESETS, normalizedPosition)
        ? normalizedPosition
        : 'custom';
    const normalizedPermissions = normalizeDashboardPermissions(permissions || {}, roleKey);
    const finalDisplayName = String(displayName || '').trim() || nextNormalized;
    const temporaryPassword = !existingAccount && !password ? generateTemporaryStaffPassword() : null;
    const finalPassword = password || temporaryPassword;

    if (existingAccount) {
        const updates = {
            displayName: finalDisplayName,
            roleKey,
            permissions: normalizedPermissions,
            isActive: true,
            passwordResetRequired: !password
        };

        if (existingAccount.email !== nextNormalized) {
            updates.email = nextNormalized;
        }

        if (password) {
            updates.password = password;
        }

        await existingAccount.update(updates, { transaction });

        return buildDashboardAccountPayload({
            accountId: existingAccount.id,
            email: nextNormalized,
            hasAccount: true,
            passwordUpdated: Boolean(password),
            needsEmail: false
        });
    }

    const createdAccount = await db.TenantDashboardAccount.create({
        tenantId,
        email: nextNormalized,
        password: finalPassword,
        displayName: finalDisplayName,
        roleKey,
        permissions: normalizedPermissions,
        isActive: true,
        passwordResetRequired: true
    }, { transaction });

    return buildDashboardAccountPayload({
        accountId: createdAccount.id,
        email: nextNormalized,
        hasAccount: true,
        temporaryPassword,
        passwordUpdated: Boolean(password),
        needsEmail: false
    });
};

// Configure multer for employee photo uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../../uploads/tenants/employees');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'employee-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Accept images only
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'image/webp';

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed!'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
    fileFilter: fileFilter
});

// Middleware for handling employee photo upload
exports.uploadPhoto = upload.single('photo');

/**
 * Get all employees for the authenticated tenant
 * GET /api/v1/tenant/employees
 */
exports.getEmployees = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { isActive, search, gender, position, page, limit, sortBy } = req.query;

        const where = { tenantId };
        
        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        const normalizedGender = normalizeEmployeeGender(gender);
        if (gender !== undefined && gender !== '' && !normalizedGender) {
            return res.status(400).json({
                success: false,
                message: `Invalid gender. Allowed values: ${VALID_EMPLOYEE_GENDERS.join(', ')}`
            });
        }

        if (normalizedGender) {
            where.gender = normalizedGender;
        }

        const normalizedPosition = normalizeEmployeePosition(position);
        if (position !== undefined && position !== '' && !normalizedPosition) {
            return res.status(400).json({
                success: false,
                message: `Invalid position. Allowed values: ${VALID_EMPLOYEE_POSITIONS.join(', ')}`
            });
        }

        if (normalizedPosition) {
            where.position = normalizedPosition;
        }

        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
                { phone: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const employeeAttributes = [
            'id',
            'name',
            'email',
            'phone',
            'nationality',
            'gender',
            'position',
            'bio',
            'experience',
            'skills',
            'dashboardPermissions',
            'photo',
            'rating',
            'totalBookings',
            'salary',
            'commissionRate',
            'workingHours',
            'scheduleVisibilityWeeks',
            'isActive',
            'createdAt',
            'updatedAt'
        ];

        const shouldPaginate = page !== undefined || limit !== undefined;
        let employees;
        let count;

        if (shouldPaginate) {
            const pageNumber = parsePaginationValue(page, 1, 1, Number.MAX_SAFE_INTEGER);
            const pageLimit = parsePaginationValue(limit, DEFAULT_EMPLOYEE_LIMIT, 1, MAX_EMPLOYEE_LIMIT);

            if (pageNumber === null || pageLimit === null) {
                return res.status(400).json({
                    success: false,
                    message: 'page and limit must be valid positive integers'
                });
            }

            const offset = (pageNumber - 1) * pageLimit;
            const result = await db.Staff.findAndCountAll({
                where,
                limit: pageLimit,
                offset,
                order: getEmployeeSortOrder(sortBy),
                attributes: employeeAttributes
            });

            employees = result.rows;
            count = result.count;

            return res.json({
                success: true,
                employees,
                count,
                page: pageNumber,
                limit: pageLimit,
                totalPages: Math.max(1, Math.ceil(count / pageLimit)),
                totalItems: count
            });
        }

        employees = await db.Staff.findAll({
            where,
            order: [['name', 'ASC']],
            attributes: employeeAttributes
        });

        res.json({
            success: true,
            employees,
            count: employees.length,
            page: 1,
            limit: employees.length,
            totalPages: 1,
            totalItems: employees.length
        });
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employees',
            error: error.message
        });
    }
};

/**
 * Get a single employee by ID
 * GET /api/v1/tenant/employees/:id
 */
exports.getEmployee = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;

        const employee = await db.Staff.findOne({
            where: {
                id,
                tenantId
            },
            attributes: [
                'id',
                'name',
                'email',
                'phone',
                'nationality',
                'gender',
                'position',
                'bio',
                'experience',
                'skills',
                'dashboardPermissions',
                'photo',
                'rating',
                'totalBookings',
                'salary',
                'commissionRate',
                'workingHours',
                'scheduleVisibilityWeeks',
                'isActive',
                'createdAt',
                'updatedAt'
            ]
            // Removed Service include for now - can add back if needed
            // The association might be causing issues
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        let staffAppAccess = buildStaffAppAccessPayload({
            email: employee.email || null,
            hasAccount: false
        });

        if (employee.email) {
            const existingStaffUser = await db.User.findOne({
                where: {
                    email: normalizeEmail(employee.email),
                    tenantId,
                    role: 'staff'
                },
                attributes: ['id', 'email']
            });

            if (existingStaffUser) {
                staffAppAccess = buildStaffAppAccessPayload({
                    email: existingStaffUser.email,
                    hasAccount: true
                });
            }
        }

        res.json({
            success: true,
            employee: {
                ...employee.toJSON(),
                app_enabled: staffAppAccess.hasAccount
            },
            staffAppAccess
        });
    } catch (error) {
        console.error('❌ Get employee error:', {
            error: error.message,
            stack: error.stack,
            id: req.params.id,
            tenantId: req.tenantId
        });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employee',
            error: error.message
        });
    }
};

/**
 * Get staff permissions and app-access state
 * GET /api/v1/tenant/employees/:id/permissions
 */
exports.getEmployeePermissions = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;

        const employee = await db.Staff.findOne({
            where: { id, tenantId },
            attributes: ['id', 'email']
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const permissionRecord = await getOrCreateStaffPermissionRecord(employee.id, tenantId);
        const staffUser = employee.email
            ? await db.User.findOne({
                where: {
                    email: normalizeEmail(employee.email),
                    tenantId,
                    role: 'staff'
                },
                attributes: ['id']
            })
            : null;

        res.json({
            success: true,
            permissions: {
                ...DEFAULT_STAFF_PERMISSIONS,
                ...(permissionRecord.permissions || {})
            },
            appEnabled: Boolean(staffUser)
        });
    } catch (error) {
        console.error('Get employee permissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employee permissions',
            error: error.message
        });
    }
};

/**
 * Update staff permissions
 * PUT /api/v1/tenant/employees/:id/permissions
 */
exports.updateEmployeePermissions = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;
        const allowedKeys = Object.keys(DEFAULT_STAFF_PERMISSIONS);

        const employee = await db.Staff.findOne({
            where: { id, tenantId },
            attributes: ['id']
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const updates = {};
        for (const key of allowedKeys) {
            if (Object.prototype.hasOwnProperty.call(req.body, key)) {
                updates[key] = req.body[key] === true || req.body[key] === 'true';
            }
        }

        const permissionRecord = await getOrCreateStaffPermissionRecord(employee.id, tenantId);
        const nextPermissions = {
            ...DEFAULT_STAFF_PERMISSIONS,
            ...(permissionRecord.permissions || {}),
            ...updates
        };

        await permissionRecord.update({ permissions: nextPermissions });

        res.json({
            success: true,
            message: 'Employee permissions updated successfully',
            permissions: nextPermissions
        });
    } catch (error) {
        console.error('Update employee permissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update employee permissions',
            error: error.message
        });
    }
};

/**
 * Enable or disable staff app access
 * PUT /api/v1/tenant/employees/:id/app-access
 */
exports.updateEmployeeAppAccess = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;
        const hasAppAccess = req.body.hasAppAccess === true || req.body.hasAppAccess === 'true';

        const employee = await db.Staff.findOne({
            where: { id, tenantId },
            transaction
        });

        if (!employee) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        if (hasAppAccess && !employee.email) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Employee email is required before enabling app access'
            });
        }

        const staffAppAccess = hasAppAccess
            ? await syncStaffAuthAccount({
                tenantId,
                previousEmail: employee.email,
                nextEmail: employee.email,
                transaction
            })
            : await syncStaffAuthAccount({
                tenantId,
                previousEmail: employee.email,
                nextEmail: null,
                transaction
            });

        await transaction.commit();

        res.json({
            success: true,
            message: hasAppAccess ? 'Staff app access enabled' : 'Staff app access disabled',
            staffAppAccess
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Update employee app access error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update employee app access',
            error: error.message
        });
    }
};

/**
 * Send staff app invite email
 * POST /api/v1/tenant/employees/:id/send-invite
 */
exports.sendEmployeeInvite = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;

        const employee = await db.Staff.findOne({
            where: { id, tenantId },
            attributes: ['id', 'name', 'email'],
            transaction
        });

        if (!employee) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        if (!employee.email) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Employee email is required to send an invite'
            });
        }

        const staffAppAccess = await syncStaffAuthAccount({
            tenantId,
            previousEmail: employee.email,
            nextEmail: employee.email,
            transaction
        });

        const tenant = await db.Tenant.findByPk(tenantId, {
            attributes: ['name', 'name_en', 'name_ar'],
            transaction
        });

        await transaction.commit();

        const { sendStaffInviteEmail } = require('../utils/emailService');
        const emailResult = await sendStaffInviteEmail({
            email: employee.email,
            staffName: employee.name,
            tenantName: tenant?.name_ar || tenant?.name_en || tenant?.name || 'Rifah',
            temporaryPassword: staffAppAccess.temporaryPassword || 'Use your existing password'
        });

        res.json({
            success: true,
            message: emailResult.success
                ? 'Staff invite sent successfully'
                : 'Staff access was enabled, but invite email could not be sent',
            staffAppAccess,
            emailSent: emailResult.success,
            emailError: emailResult.success ? null : emailResult.error
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Send employee invite error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send employee invite',
            error: error.message
        });
    }
};

/**
 * Reset staff app password and email a temporary password
 * POST /api/v1/tenant/employees/:id/reset-password
 */
exports.resetEmployeePassword = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;

        const employee = await db.Staff.findOne({
            where: { id, tenantId },
            attributes: ['id', 'name', 'email'],
            transaction
        });

        if (!employee) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        if (!employee.email) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Employee email is required to reset password'
            });
        }

        const staffUser = await db.User.findOne({
            where: {
                email: normalizeEmail(employee.email),
                tenantId,
                role: 'staff'
            },
            transaction
        });

        if (!staffUser) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Staff app access is not enabled for this employee'
            });
        }

        const temporaryPassword = generateTemporaryStaffPassword();
        await staffUser.update({ password: temporaryPassword }, { transaction });

        const tenant = await db.Tenant.findByPk(tenantId, {
            attributes: ['name', 'name_en', 'name_ar'],
            transaction
        });

        await transaction.commit();

        const { sendStaffPasswordResetEmail } = require('../utils/emailService');
        const emailResult = await sendStaffPasswordResetEmail({
            email: employee.email,
            staffName: employee.name,
            tenantName: tenant?.name_ar || tenant?.name_en || tenant?.name || 'Rifah',
            temporaryPassword
        });

        res.json({
            success: true,
            message: emailResult.success
                ? 'Password reset email sent successfully'
                : 'Password was reset, but reset email could not be sent',
            emailSent: emailResult.success,
            emailError: emailResult.success ? null : emailResult.error
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Reset employee password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset employee password',
            error: error.message
        });
    }
};

/**
 * Create a new employee
 * POST /api/v1/tenant/employees
 */
exports.createEmployee = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        
        // Check if tenantId exists (authentication check)
        if (!tenantId) {
            await transaction.rollback();
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please login again.'
            });
        }
        
        // Log raw request data FIRST - CRITICAL for debugging
        console.log('=== RAW REQUEST DATA ===');
        console.log('req.body.skills:', req.body.skills);
        console.log('req.body.skills type:', typeof req.body.skills);
        // Note: workingHours is deprecated - use Schedules section instead
        // Still accept it for backward compatibility but don't use it
        
        let {
            name,
            email,
            phone,
            nationality,
            gender,
            position,
            bio,
            experience,
            skills,
            spokenLanguages,
            salary,
            commissionRate,
            serviceCommissionEnabled,
            productCommissionEnabled,
            scheduleVisibilityWeeks,
            staffAppPassword,
            dashboardPermissions,
            workingHours, // Deprecated - kept for backward compatibility
            isActive = true
        } = req.body;
        
        console.log('=== EXTRACTED VALUES ===');
        console.log('skills variable:', skills);
        console.log('skills variable type:', typeof skills);
        
        // Debug log in development
        if (process.env.NODE_ENV === 'development') {
            console.log('Create employee request:', {
                tenantId,
                bodyKeys: Object.keys(req.body || {}),
                hasFile: !!req.file,
                name,
                salary
            });
        }

        // Validation
        if (!name || name.trim() === '') {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Employee name is required'
            });
        }

        const normalizedEmail = email && email.trim() ? normalizeEmail(email) : null;
        const positionValue = `${position ?? ''}`.trim();
        const normalizedPosition = normalizeEmployeePosition(positionValue);
        const genderValue = `${gender ?? ''}`.trim();
        const normalizedGender = normalizeEmployeeGender(genderValue);
        let parsedDashboardPermissions = null;
        if (dashboardPermissions !== undefined) {
            if (typeof dashboardPermissions === 'string' && dashboardPermissions.trim()) {
                try {
                    parsedDashboardPermissions = JSON.parse(dashboardPermissions);
                } catch (parseError) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: 'dashboardPermissions must be valid JSON'
                    });
                }
            } else if (dashboardPermissions && typeof dashboardPermissions === 'object') {
                parsedDashboardPermissions = dashboardPermissions;
            }
        }
        const parsedScheduleVisibilityWeeks = parseScheduleVisibilityWeeks(scheduleVisibilityWeeks, 1);
        if (!positionValue) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Employee position is required'
            });
        }
        if (!normalizedPosition) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Invalid employee position. Allowed values: ${VALID_EMPLOYEE_POSITIONS.join(', ')}`
            });
        }
        if (genderValue && !normalizedGender) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Invalid gender. Allowed values: ${VALID_EMPLOYEE_GENDERS.join(', ')}`
            });
        }
        if (staffAppPassword && staffAppPassword.length < 8) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Staff app password must be at least 8 characters long'
            });
        }

        if (parsedScheduleVisibilityWeeks === null) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'scheduleVisibilityWeeks must be one of: 1, 2, 3, 4'
            });
        }

        // Parse salary - allow drafts to save without finance completed yet
        const hasSalaryValue = salary !== undefined && salary !== null && `${salary}`.trim() !== '';
        const salaryNum = hasSalaryValue ? parseFloat(salary) : 0;
        if (hasSalaryValue && (isNaN(salaryNum) || salaryNum < 0)) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Valid salary is required'
            });
        }

        // Parse skills if it's a JSON string from FormData
        let skillsArray = [];
        if (skills) {
            if (typeof skills === 'string') {
                console.log('🔍 Parsing skills string:', skills);
                // The string comes as: "[\"sdsd\",\"sdsdsd\"]" from FormData
                // We need to parse it to get: ["sdsd","sdsdsd"]
                try {
                    // Try direct JSON parse first
                    let parsed = JSON.parse(skills);
                    console.log('✅ First parse attempt result:', parsed, 'Type:', typeof parsed, 'IsArray:', Array.isArray(parsed));
                    
                    // If parsed result is still a string, parse again (double-encoded)
                    if (typeof parsed === 'string') {
                        console.log('⚠️ Parsed result is still a string, parsing again...');
                        parsed = JSON.parse(parsed);
                        console.log('✅ Second parse result:', parsed, 'Type:', typeof parsed, 'IsArray:', Array.isArray(parsed));
                    }
                    
                    if (Array.isArray(parsed)) {
                        skillsArray = parsed;
                        console.log('✅ Successfully parsed to array:', skillsArray);
                    } else {
                        console.warn('⚠️ Parsed value is not an array, using fallback');
                        // Fallback: treat as comma-separated
                        skillsArray = skills.split(',').map(s => s.trim().replace(/^["'\[\]]+|["'\[\]]+$/g, '')).filter(s => s);
                    }
                } catch (e) {
                    console.error('❌ JSON parse failed:', e.message);
                    // If JSON parse fails, try removing outer quotes first
                    try {
                        let cleaned = skills.trim();
                        // Remove outer quotes if present
                        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
                            (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
                            cleaned = cleaned.slice(1, -1);
                            console.log('🔍 Removed outer quotes, cleaned:', cleaned);
                        }
                        const parsed = JSON.parse(cleaned);
                        if (Array.isArray(parsed)) {
                            skillsArray = parsed;
                            console.log('✅ Successfully parsed after cleaning:', skillsArray);
                        } else {
                            throw new Error('Parsed value is not an array');
                        }
                    } catch (e2) {
                        // Last resort: treat as comma-separated string
                        console.warn('⚠️ All parsing failed, using comma-separated fallback:', e2.message);
                        skillsArray = skills.split(',').map(s => s.trim().replace(/^["'\[\]]+|["'\[\]]+$/g, '')).filter(s => s);
                    }
                }
            } else if (Array.isArray(skills)) {
                skillsArray = skills;
                console.log('✅ Skills already an array:', skillsArray);
            }
        }
        
        // Final validation - ensure it's a proper JavaScript array
        if (!Array.isArray(skillsArray)) {
            console.error('❌ CRITICAL: skillsArray is not an array! Type:', typeof skillsArray, 'Value:', skillsArray);
            skillsArray = [];
        }

        const spokenLanguagesArray = parseStringArrayField(spokenLanguages, []);
        const serviceCommissionEnabledBool = parseBooleanField(serviceCommissionEnabled, false);
        const productCommissionEnabledBool = parseBooleanField(productCommissionEnabled, false);
        
        // Debug log - ALWAYS show this
        console.log('📊 FINAL Skills parsing result:', {
            original: skills,
            originalType: typeof skills,
            parsed: skillsArray,
            parsedType: typeof skillsArray,
            isArray: Array.isArray(skillsArray),
            length: skillsArray.length,
            stringified: JSON.stringify(skillsArray)
        });

        // Note: workingHours is deprecated - not used by booking system
        // Set to empty object (schedules are managed via Schedules section)
        let workingHoursObj = {};

        // Parse isActive - handle string from FormData
        let isActiveBool = true;
        if (typeof isActive === 'string') {
            isActiveBool = isActive === 'true' || isActive === '1';
        } else {
            isActiveBool = Boolean(isActive);
        }

        // Get photo path if uploaded
        let photoPath = null;
        if (req.file) {
            photoPath = req.file.path.replace(/\\/g, '/').split('uploads/')[1];
        }

        // CRITICAL: Ensure skillsArray is a proper JavaScript array (not a string)
        // Sequelize JSON type expects a JavaScript array/object, not a JSON string
        if (typeof skillsArray === 'string') {
            console.error('ERROR: skillsArray is still a string! Attempting to parse again...');
            try {
                skillsArray = JSON.parse(skillsArray);
            } catch (e) {
                console.error('Failed to parse skillsArray string:', e);
                skillsArray = [];
            }
        }
        
        // Ensure workingHours is an object, not a string
        if (typeof workingHoursObj === 'string') {
            console.error('ERROR: workingHoursObj is still a string! Attempting to parse again...');
            try {
                workingHoursObj = JSON.parse(workingHoursObj);
            } catch (e) {
                console.error('Failed to parse workingHoursObj string:', e);
                workingHoursObj = {};
            }
        }
        
        // Final validation before creating
        if (!Array.isArray(skillsArray)) {
            console.error('FATAL: skillsArray is not an array before create! Type:', typeof skillsArray, 'Value:', skillsArray);
            throw new Error('Invalid skills format: must be an array');
        }
        
        if (typeof workingHoursObj !== 'object' || workingHoursObj === null || Array.isArray(workingHoursObj)) {
            console.error('FATAL: workingHoursObj is not an object before create! Type:', typeof workingHoursObj, 'Value:', workingHoursObj);
            workingHoursObj = {};
        }
        
        // Debug: Log what we're about to create
        console.log('=== CREATING EMPLOYEE ===');
        console.log('Skills:', {
            value: skillsArray,
            type: typeof skillsArray,
            isArray: Array.isArray(skillsArray),
            stringified: JSON.stringify(skillsArray)
        });
        console.log('Working Hours:', {
            value: workingHoursObj,
            type: typeof workingHoursObj,
            isObject: typeof workingHoursObj === 'object' && !Array.isArray(workingHoursObj),
            stringified: JSON.stringify(workingHoursObj)
        });
        
        // CRITICAL: Create a fresh array/object to ensure no string contamination
        // Sequelize JSON type requires pure JavaScript arrays/objects, not JSON strings
        const finalSkills = Array.isArray(skillsArray) ? [...skillsArray] : [];
        const finalWorkingHours = (typeof workingHoursObj === 'object' && workingHoursObj !== null && !Array.isArray(workingHoursObj)) 
            ? { ...workingHoursObj } 
            : {};
        
        console.log('🔧 FINAL VALUES BEFORE CREATE:');
        console.log('  Skills:', {
            value: finalSkills,
            type: typeof finalSkills,
            isArray: Array.isArray(finalSkills),
            constructor: finalSkills.constructor.name,
            stringified: JSON.stringify(finalSkills)
        });
        console.log('  WorkingHours:', {
            value: finalWorkingHours,
            type: typeof finalWorkingHours,
            isObject: typeof finalWorkingHours === 'object' && !Array.isArray(finalWorkingHours),
            constructor: finalWorkingHours.constructor.name,
            stringified: JSON.stringify(finalWorkingHours)
        });
        
        // CRITICAL: Final validation and explicit type checking
        // Double-check: If finalSkills is somehow still a string, parse it one more time
        let skillsForDB = finalSkills;
        if (typeof finalSkills === 'string') {
            console.error('🚨 CRITICAL: finalSkills is still a string! Parsing again...');
            try {
                skillsForDB = JSON.parse(finalSkills);
            } catch (e) {
                console.error('Failed to parse finalSkills:', e);
                skillsForDB = [];
            }
        }
        
        // Ensure it's an array - create a completely fresh array
        if (!Array.isArray(skillsForDB)) {
            console.error('🚨 CRITICAL: skillsForDB is not an array! Type:', typeof skillsForDB, 'Value:', skillsForDB);
            skillsForDB = [];
        } else {
            // Create a completely fresh array to avoid any reference issues
            skillsForDB = JSON.parse(JSON.stringify(skillsForDB));
        }
        
        // Same for workingHours
        let workingHoursForDB = finalWorkingHours;
        if (typeof finalWorkingHours === 'string') {
            console.error('🚨 CRITICAL: finalWorkingHours is still a string! Parsing again...');
            try {
                workingHoursForDB = JSON.parse(finalWorkingHours);
            } catch (e) {
                console.error('Failed to parse finalWorkingHours:', e);
                workingHoursForDB = {};
            }
        }
        
        // Ensure it's an object - create a completely fresh object
        if (typeof workingHoursForDB !== 'object' || workingHoursForDB === null || Array.isArray(workingHoursForDB)) {
            console.error('🚨 CRITICAL: workingHoursForDB is not an object! Type:', typeof workingHoursForDB, 'Value:', workingHoursForDB);
            workingHoursForDB = {};
        } else {
            // Create a completely fresh object to avoid any reference issues
            workingHoursForDB = JSON.parse(JSON.stringify(workingHoursForDB));
        }
        
        console.log('🎯 FINAL VALUES GOING TO SEQUELIZE:');
        console.log('  skillsForDB:', skillsForDB);
        console.log('  skillsForDB type:', typeof skillsForDB);
        console.log('  skillsForDB isArray:', Array.isArray(skillsForDB));
        console.log('  skillsForDB constructor:', skillsForDB.constructor.name);
        console.log('  skillsForDB stringified:', JSON.stringify(skillsForDB));
        console.log('  workingHoursForDB:', workingHoursForDB);
        console.log('  workingHoursForDB type:', typeof workingHoursForDB);
        console.log('  workingHoursForDB stringified:', JSON.stringify(workingHoursForDB));
        
        // Create employee - JSONB type should handle arrays/objects correctly
        // Changed model from JSON to JSONB for better Sequelize support
        const employee = await db.Staff.create({
            tenantId,
            name: name.trim(),
            email: normalizedEmail,
            phone: phone && phone.trim() ? phone.trim() : null,
            nationality: nationality && nationality.trim() ? nationality.trim() : null,
            gender: normalizedGender,
            position: normalizedPosition,
            bio: bio && bio.trim() ? bio.trim() : null,
            experience: experience && experience.trim() ? experience.trim() : null,
            skills: skillsForDB, // JavaScript array - JSONB should handle this correctly
            spokenLanguages: spokenLanguagesArray,
            serviceCommissionEnabled: serviceCommissionEnabledBool,
            productCommissionEnabled: productCommissionEnabledBool,
            dashboardPermissions: normalizeStoredDashboardPermissions(parsedDashboardPermissions, normalizedPosition),
            photo: photoPath,
            salary: salaryNum,
            commissionRate: commissionRate ? parseFloat(commissionRate) : 0.00,
            workingHours: workingHoursForDB, // JavaScript object - JSONB should handle this correctly
            scheduleVisibilityWeeks: parsedScheduleVisibilityWeeks,
            isActive: isActiveBool
        }, { transaction });

        const isServiceProvider = normalizedPosition === 'service_provider';
        const accessPassword = staffAppPassword && staffAppPassword.trim() ? staffAppPassword.trim() : null;
        let staffAppAccess = null;

        await transaction.commit();

        if (isServiceProvider) {
            const staffTransaction = await db.sequelize.transaction();
            try {
                staffAppAccess = await syncStaffAuthAccount({
                    tenantId,
                    nextEmail: normalizedEmail,
                    password: accessPassword,
                    transaction: staffTransaction
                });
                await staffTransaction.commit();
            } catch (staffError) {
                await staffTransaction.rollback();
                console.error('Staff app sync error (create employee):', staffError);
            }
        }

        let dashboardAccess = null;
        if (!isServiceProvider) {
            const dashboardTransaction = await db.sequelize.transaction();
            try {
                dashboardAccess = await syncTenantDashboardAccount({
                    tenantId,
                    nextEmail: normalizedEmail,
                    displayName: name.trim(),
                    position: normalizedPosition,
                    permissions: parsedDashboardPermissions,
                    password: accessPassword,
                    transaction: dashboardTransaction
                });
                await dashboardTransaction.commit();
            } catch (dashboardError) {
                await dashboardTransaction.rollback();
                console.error('Dashboard account sync error (create employee):', dashboardError);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            employee,
            staffAppAccess,
            dashboardAccess
        });
    } catch (error) {
        await transaction.rollback();
        
        // Clean up uploaded file if employee creation fails
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        console.error('Create employee error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            tenantId: req.tenantId,
            body: req.body,
            bodyKeys: Object.keys(req.body || {}),
            file: req.file ? { filename: req.file.filename, path: req.file.path } : null
        });
        
        // Provide more specific error messages
        let errorMessage = 'Failed to create employee';
        if (error.name === 'SequelizeValidationError') {
            errorMessage = `Validation error: ${error.errors.map(e => e.message).join(', ')}`;
        } else if (error.name === 'SequelizeUniqueConstraintError') {
            errorMessage = 'An employee with this email or phone already exists';
        } else if (error.name === 'SequelizeForeignKeyConstraintError') {
            errorMessage = 'Invalid tenant or related data';
        }
        
        // Return error with more details
        const errorResponse = {
            success: false,
            message: errorMessage,
            error: error.message,
            errorName: error.name
        };
        
        // Always include details in development, or if explicitly requested
        if (process.env.NODE_ENV !== 'production') {
            errorResponse.details = error.stack;
            errorResponse.requestBody = req.body;
            errorResponse.tenantId = req.tenantId;
            errorResponse.bodyKeys = Object.keys(req.body || {});
        }
        
        res.status(500).json(errorResponse);
    }
};

/**
 * Update an employee
 * PUT /api/v1/tenant/employees/:id
 */
exports.updateEmployee = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;
        const {
            name,
            email,
            phone,
            nationality,
            gender,
            position,
            bio,
            experience,
            skills,
            spokenLanguages,
            salary,
            commissionRate,
            serviceCommissionEnabled,
            productCommissionEnabled,
            scheduleVisibilityWeeks,
            staffAppPassword,
            dashboardPermissions,
            workingHours,
            isActive
        } = req.body;

        // Find employee
        const employee = await db.Staff.findOne({
            where: {
                id,
                tenantId
            },
            transaction
        });

        if (!employee) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        if (staffAppPassword && staffAppPassword.length < 8) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Staff app password must be at least 8 characters long'
            });
        }

        const parsedScheduleVisibilityWeeks = parseScheduleVisibilityWeeks(
            scheduleVisibilityWeeks,
            employee.scheduleVisibilityWeeks || 1
        );

        if (scheduleVisibilityWeeks !== undefined && parsedScheduleVisibilityWeeks === null) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'scheduleVisibilityWeeks must be one of: 1, 2, 3, 4'
            });
        }

        const previousEmail = employee.email;
        const genderValue = `${gender ?? ''}`.trim();
        const normalizedGender = normalizeEmployeeGender(genderValue);
        if (gender !== undefined && genderValue && !normalizedGender) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Invalid gender. Allowed values: ${VALID_EMPLOYEE_GENDERS.join(', ')}`
            });
        }
        let parsedDashboardPermissions = null;
        if (dashboardPermissions !== undefined) {
            if (typeof dashboardPermissions === 'string' && dashboardPermissions.trim()) {
                try {
                    parsedDashboardPermissions = JSON.parse(dashboardPermissions);
                } catch (parseError) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: 'dashboardPermissions must be valid JSON'
                    });
                }
            } else if (dashboardPermissions && typeof dashboardPermissions === 'object') {
                parsedDashboardPermissions = dashboardPermissions;
            }
        }

        // Parse skills if provided
        if (skills !== undefined) {
            employee.skills = parseStringArrayField(skills, employee.skills || []);
        }

        if (spokenLanguages !== undefined) {
            employee.spokenLanguages = parseStringArrayField(spokenLanguages, employee.spokenLanguages || []);
        }

        // Note: workingHours is deprecated - not updated
        // Schedules are managed via Schedules section (StaffShift model)

        // Update fields
        if (name !== undefined) employee.name = name;
        if (email !== undefined) employee.email = email && email.trim() ? normalizeEmail(email) : null;
        if (phone !== undefined) employee.phone = phone || null;
        if (nationality !== undefined) employee.nationality = nationality || null;
        if (gender !== undefined) employee.gender = normalizedGender;
        if (position !== undefined) {
            const positionValue = `${position}`.trim();
            const normalizedPosition = normalizeEmployeePosition(positionValue);
            if (positionValue && !normalizedPosition) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Invalid employee position. Allowed values: ${VALID_EMPLOYEE_POSITIONS.join(', ')}`
                });
            }
            employee.position = normalizedPosition;
        }
        if (bio !== undefined) employee.bio = bio || null;
        if (experience !== undefined) employee.experience = experience || null;
        if (salary !== undefined && `${salary}`.trim() !== '') employee.salary = parseFloat(salary);
        if (commissionRate !== undefined) employee.commissionRate = parseFloat(commissionRate);
        if (serviceCommissionEnabled !== undefined) employee.serviceCommissionEnabled = parseBooleanField(serviceCommissionEnabled, employee.serviceCommissionEnabled);
        if (productCommissionEnabled !== undefined) employee.productCommissionEnabled = parseBooleanField(productCommissionEnabled, employee.productCommissionEnabled);
        if (scheduleVisibilityWeeks !== undefined) employee.scheduleVisibilityWeeks = parsedScheduleVisibilityWeeks;
        if (isActive !== undefined) employee.isActive = isActive === true || isActive === 'true';

        const isServiceProvider = employee.position === 'service_provider';

        if (!isServiceProvider) {
            employee.dashboardPermissions = normalizeStoredDashboardPermissions(
                parsedDashboardPermissions !== null ? parsedDashboardPermissions : employee.dashboardPermissions,
                employee.position
            );
        } else if (parsedDashboardPermissions !== null) {
            employee.dashboardPermissions = normalizeStoredDashboardPermissions(
                parsedDashboardPermissions,
                employee.position
            );
        }

        // Handle photo upload
        if (req.file) {
            // Delete old photo if exists
            if (employee.photo) {
                const oldPhotoPath = path.join(__dirname, '../../uploads', employee.photo);
                if (fs.existsSync(oldPhotoPath)) {
                    fs.unlinkSync(oldPhotoPath);
                }
            }
            
            // Set new photo path
            employee.photo = req.file.path.replace(/\\/g, '/').split('uploads/')[1];
        }

        const accessPassword = staffAppPassword && staffAppPassword.trim() ? staffAppPassword.trim() : null;
        let staffAppAccess = null;
        let dashboardAccess = null;

        await employee.save({ transaction });
        await transaction.commit();

        const staffTransaction = await db.sequelize.transaction();
        try {
            staffAppAccess = isServiceProvider
                ? await syncStaffAuthAccount({
                    tenantId,
                    previousEmail,
                    nextEmail: employee.email,
                    password: accessPassword,
                    transaction: staffTransaction
                })
                : await syncStaffAuthAccount({
                    tenantId,
                    previousEmail,
                    nextEmail: null,
                    transaction: staffTransaction
                });
            await staffTransaction.commit();
        } catch (staffError) {
            await staffTransaction.rollback();
            console.error('Staff app sync error (update employee):', staffError);
        }

        const dashboardTransaction = await db.sequelize.transaction();
        try {
            dashboardAccess = !isServiceProvider
                ? await syncTenantDashboardAccount({
                    tenantId,
                    previousEmail,
                    nextEmail: employee.email,
                    displayName: employee.name,
                    position: employee.position,
                    permissions: parsedDashboardPermissions,
                    password: accessPassword,
                    transaction: dashboardTransaction
                })
                : await syncTenantDashboardAccount({
                    tenantId,
                    previousEmail,
                    nextEmail: null,
                    displayName: employee.name,
                    position: employee.position,
                    permissions: null,
                    transaction: dashboardTransaction
                });
            await dashboardTransaction.commit();
        } catch (dashboardError) {
            await dashboardTransaction.rollback();
            console.error('Dashboard account sync error (update employee):', dashboardError);
        }

        res.json({
            success: true,
            message: 'Employee updated successfully',
            employee,
            staffAppAccess,
            dashboardAccess
        });
    } catch (error) {
        await transaction.rollback();
        
        // Clean up uploaded file if update fails
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        console.error('Update employee error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update employee',
            error: error.message
        });
    }
};

/**
 * Delete an employee
 * DELETE /api/v1/tenant/employees/:id
 */
exports.deleteEmployee = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;
        const { id } = req.params;

        const employee = await db.Staff.findOne({
            where: {
                id,
                tenantId
            },
            transaction
        });

        if (!employee) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Check if employee has appointments
        const appointmentCount = await db.Appointment.count({
            where: { staffId: id },
            transaction
        });

        if (appointmentCount > 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Cannot delete employee with ${appointmentCount} appointment(s). Please deactivate instead.`
            });
        }

        // Delete photo if exists
        if (employee.photo) {
            const photoPath = path.join(__dirname, '../../uploads', employee.photo);
            if (fs.existsSync(photoPath)) {
                fs.unlinkSync(photoPath);
            }
        }

        if (employee.position === 'service_provider') {
            if (employee.email) {
                const staffUser = await db.User.findOne({
                    where: {
                        email: normalizeEmail(employee.email),
                        tenantId,
                        role: 'staff'
                    },
                    transaction
                });

                if (staffUser) {
                    await staffUser.destroy({ transaction });
                }
            }
        } else if (employee.email) {
            const dashboardAccount = await db.TenantDashboardAccount.findOne({
                where: {
                    tenantId,
                    email: normalizeEmail(employee.email)
                },
                transaction
            });

            if (dashboardAccount) {
                await dashboardAccount.destroy({ transaction });
            }
        }

        // Delete employee
        await employee.destroy({ transaction });
        await transaction.commit();

        res.json({
            success: true,
            message: 'Employee deleted successfully'
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Delete employee error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete employee',
            error: error.message
        });
    }
};

