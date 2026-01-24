/**
 * Input Validation Middleware
 * Validates request data against defined schemas using Joi
 */
const Joi = require('joi');

/**
 * Generic validation middleware creator
 * @param {Object} schema - Joi schema to validate against
 * @returns {Function} Express middleware
 */
const validate = (schema) => {
    return (req, res, next) => {
        try {
            // Validate request body, params, and query
            const dataToValidate = {
                body: req.body,
                params: req.params,
                query: req.query
            };

            const { error, value } = schema.validate(dataToValidate, {
                abortEarly: false, // Return all errors, not just the first
                stripUnknown: true // Remove unknown fields
            });

            if (error) {
                const errors = error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message
                }));

                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors
                });
            }

            // Replace req data with validated and cleaned data
            req.body = value.body;
            req.params = value.params;
            req.query = value.query;

            next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Validation error',
                error: error.message
            });
        }
    };
};

/**
 * Validation Schemas for all endpoints
 */
const schemas = {
    // User Authentication Schemas
    userRegister: Joi.object({
        body: Joi.object({
            firstName: Joi.string().required().min(2).max(50),
            lastName: Joi.string().required().min(2).max(50),
            email: Joi.string().email().required(),
            phone: Joi.string().required().pattern(/^[0-9+\-\s()]+$/),
            password: Joi.string()
                .required()
                .min(8)
                .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
                .messages({
                    'string.pattern.base': 'Password must contain lowercase, uppercase, and numbers'
                }),
            confirmPassword: Joi.string().required().valid(Joi.ref('password'))
                .messages({
                    'any.only': 'Passwords do not match'
                })
        }).unknown(true)
    }),

    userLogin: Joi.object({
        body: Joi.object({
            email: Joi.string().email().required(),
            password: Joi.string().required().min(6)
        }).unknown(true)
    }),

    userChangePassword: Joi.object({
        body: Joi.object({
            currentPassword: Joi.string().required(),
            newPassword: Joi.string()
                .required()
                .min(8)
                .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
                .messages({
                    'string.pattern.base': 'Password must contain lowercase, uppercase, and numbers'
                }),
            confirmPassword: Joi.string().required().valid(Joi.ref('newPassword'))
                .messages({
                    'any.only': 'Passwords do not match'
                })
        }).unknown(true)
    }),

    userUpdateProfile: Joi.object({
        body: Joi.object({
            firstName: Joi.string().min(2).max(50),
            lastName: Joi.string().min(2).max(50),
            phone: Joi.string().pattern(/^[0-9+\-\s()]+$/),
            address: Joi.string().max(255),
            city: Joi.string().max(100),
            state: Joi.string().max(100),
            zipCode: Joi.string().max(20),
            country: Joi.string().max(100)
        }).unknown(true)
    }),

    refreshToken: Joi.object({
        body: Joi.object({
            refreshToken: Joi.string().required()
        }).unknown(true)
    }),

    // Tenant Authentication Schemas
    tenantRegister: Joi.object({
        body: Joi.object({
            companyName: Joi.string().required().min(3).max(100),
            email: Joi.string().email().required(),
            password: Joi.string()
                .required()
                .min(8)
                .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
                .messages({
                    'string.pattern.base': 'Password must contain lowercase, uppercase, and numbers'
                }),
            confirmPassword: Joi.string().required().valid(Joi.ref('password'))
                .messages({
                    'any.only': 'Passwords do not match'
                }),
            phone: Joi.string().required(),
            category: Joi.string().required(),
            website: Joi.string().uri().allow(''),
            plan: Joi.string().valid('starter', 'professional', 'enterprise')
        }).unknown(true)
    }),

    tenantLogin: Joi.object({
        body: Joi.object({
            email: Joi.string().email().required(),
            password: Joi.string().required()
        }).unknown(true)
    }),

    // Appointment Booking Schema
    bookAppointment: Joi.object({
        body: Joi.object({
            serviceId: Joi.string().uuid().required(),
            staffId: Joi.string().uuid(),
            startTime: Joi.date().iso().required(),
            endTime: Joi.date().iso().required(),
            notes: Joi.string().max(1000),
            clientName: Joi.string().min(2).max(100),
            clientEmail: Joi.string().email(),
            clientPhone: Joi.string().pattern(/^[0-9+\-\s()]+$/)
        }).unknown(true)
    }),

    // Payment Schema
    processPayment: Joi.object({
        body: Joi.object({
            appointmentId: Joi.string().uuid().required(),
            amount: Joi.number().positive().required(),
            cardNumber: Joi.string().required().pattern(/^[0-9]{13,19}$/),
            expiryDate: Joi.string().required().pattern(/^(0[1-9]|1[0-2])\/\d{2}$/),
            cvv: Joi.string().required().pattern(/^[0-9]{3,4}$/),
            cardholderName: Joi.string().required(),
            saveCard: Joi.boolean()
        }).unknown(true)
    }),

    // Service Creation/Update Schema
    createService: Joi.object({
        body: Joi.object({
            name: Joi.string().required().min(3).max(100),
            description: Joi.string().max(1000),
            duration: Joi.number().positive().required(),
            price: Joi.number().positive().required(),
            category: Joi.string().required(),
            staffIds: Joi.array().items(Joi.string().uuid())
        }).unknown(true)
    }),

    // Employee Creation/Update Schema
    createEmployee: Joi.object({
        body: Joi.object({
            firstName: Joi.string().required().min(2).max(50),
            lastName: Joi.string().required().min(2).max(50),
            email: Joi.string().email().required(),
            phone: Joi.string().required(),
            position: Joi.string().required(),
            skills: Joi.alternatives().try(
                Joi.array().items(Joi.string()),
                Joi.string()
            ),
            workingHours: Joi.object(),
            status: Joi.string().valid('active', 'inactive', 'on_leave')
        }).unknown(true)
    }),

    // Payment Method Schema
    addPaymentMethod: Joi.object({
        body: Joi.object({
            cardNumber: Joi.string().required().pattern(/^[0-9]{13,19}$/),
            expiryDate: Joi.string().required().pattern(/^(0[1-9]|1[0-2])\/\d{2}$/),
            cvv: Joi.string().required().pattern(/^[0-9]{3,4}$/),
            cardholderName: Joi.string().required()
        }).unknown(true)
    }),

    // Product Creation/Update Schema
    createProduct: Joi.object({
        body: Joi.object({
            name: Joi.string().required().min(3).max(100),
            description: Joi.string().max(1000),
            price: Joi.number().positive().required(),
            quantity: Joi.number().positive().required(),
            category: Joi.string().required()
        }).unknown(true)
    }),

    // Tenant Settings Update Schema
    updateTenantSettings: Joi.object({
        body: Joi.object({
            businessName: Joi.string().min(3).max(100),
            email: Joi.string().email(),
            phone: Joi.string(),
            address: Joi.string(),
            city: Joi.string(),
            state: Joi.string(),
            zipCode: Joi.string(),
            country: Joi.string(),
            website: Joi.string().uri().allow('')
        }).unknown(true)
    })
};

module.exports = {
    validate,
    schemas
};
