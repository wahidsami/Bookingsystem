/**
 * Tenant Employee Controller
 * Handles employee (staff) management for authenticated tenants
 */

const db = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

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
        const { isActive, search } = req.query;

        const where = { tenantId };
        
        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
                { phone: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const employees = await db.Staff.findAll({
            where,
            order: [['name', 'ASC']],
            attributes: [
                'id',
                'name',
                'email',
                'phone',
                'nationality',
                'bio',
                'experience',
                'skills',
                'photo',
                'rating',
                'totalBookings',
                'salary',
                'commissionRate',
                'workingHours',
                'isActive',
                'createdAt',
                'updatedAt'
            ]
        });

        res.json({
            success: true,
            employees,
            count: employees.length
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
                'bio',
                'experience',
                'skills',
                'photo',
                'rating',
                'totalBookings',
                'salary',
                'commissionRate',
                'workingHours',
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

        res.json({
            success: true,
            employee
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
            bio,
            experience,
            skills,
            salary,
            commissionRate,
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

        // Parse salary - handle string from FormData
        const salaryNum = salary ? parseFloat(salary) : 0;
        if (!salary || isNaN(salaryNum) || salaryNum < 0) {
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
            email: email && email.trim() ? email.trim() : null,
            phone: phone && phone.trim() ? phone.trim() : null,
            nationality: nationality && nationality.trim() ? nationality.trim() : null,
            bio: bio && bio.trim() ? bio.trim() : null,
            experience: experience && experience.trim() ? experience.trim() : null,
            skills: skillsForDB, // JavaScript array - JSONB should handle this correctly
            photo: photoPath,
            salary: salaryNum,
            commissionRate: commissionRate ? parseFloat(commissionRate) : 0.00,
            workingHours: workingHoursForDB, // JavaScript object - JSONB should handle this correctly
            isActive: isActiveBool
        }, { transaction });

        await transaction.commit();

        res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            employee
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
            bio,
            experience,
            skills,
            salary,
            commissionRate,
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

        // Parse skills if provided
        if (skills !== undefined) {
            if (typeof skills === 'string') {
                employee.skills = skills.split(',').map(s => s.trim()).filter(s => s);
            } else if (Array.isArray(skills)) {
                employee.skills = skills;
            }
        }

        // Note: workingHours is deprecated - not updated
        // Schedules are managed via Schedules section (StaffShift model)

        // Update fields
        if (name !== undefined) employee.name = name;
        if (email !== undefined) employee.email = email || null;
        if (phone !== undefined) employee.phone = phone || null;
        if (nationality !== undefined) employee.nationality = nationality || null;
        if (bio !== undefined) employee.bio = bio || null;
        if (experience !== undefined) employee.experience = experience || null;
        if (salary !== undefined) employee.salary = parseFloat(salary);
        if (commissionRate !== undefined) employee.commissionRate = parseFloat(commissionRate);
        if (isActive !== undefined) employee.isActive = isActive === true || isActive === 'true';

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

        await employee.save({ transaction });
        await transaction.commit();

        res.json({
            success: true,
            message: 'Employee updated successfully',
            employee
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

