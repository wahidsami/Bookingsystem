'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Tenant extends Model {
        static associate(models) {
            Tenant.hasMany(models.User, { foreignKey: 'tenantId' });
            
            // Subscription relationship
            Tenant.hasOne(models.TenantSubscription, {
                foreignKey: 'tenantId',
                as: 'subscription'
            });
            
            // Hot deals relationship
            Tenant.hasMany(models.HotDeal, {
                foreignKey: 'tenantId',
                as: 'hotDeals'
            });
        }
    }
    Tenant.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        // Basic Info
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Business name in English (legacy field)'
        },
        name_en: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Business name in English'
        },
        name_ar: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Business name in Arabic'
        },
        nameAr: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Legacy Arabic name field'
        },
        slug: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        dbSchema: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        // Business Type
        businessType: {
            type: DataTypes.ENUM('salon', 'spa', 'barbershop', 'beauty_center', 'clinic', 'nail_studio', 'other'),
            defaultValue: 'salon'
        },
        // Authentication
        password: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Hashed password for tenant login'
        },
        lastLogin: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Contact Info
        email: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: { isEmail: true }
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Business phone number'
        },
        mobile: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Business mobile number'
        },
        whatsapp: {
            type: DataTypes.STRING,
            allowNull: true
        },
        website: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // Location
        buildingNumber: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Building number'
        },
        street: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Street name'
        },
        district: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'District/neighborhood'
        },
        city: {
            type: DataTypes.STRING,
            allowNull: true
        },
        country: {
            type: DataTypes.STRING,
            defaultValue: 'Saudi Arabia'
        },
        postalCode: {
            type: DataTypes.STRING,
            allowNull: true
        },
        address: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Full address (legacy/computed field)'
        },
        googleMapLink: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Google Maps location link'
        },
        coordinates: {
            type: DataTypes.JSONB,
            allowNull: true // { lat: 24.7136, lng: 46.6753 }
        },
        // Business Details
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        descriptionAr: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        logo: {
            type: DataTypes.STRING,
            allowNull: true
        },
        coverImage: {
            type: DataTypes.STRING,
            allowNull: true
        },
        images: {
            type: DataTypes.JSONB,
            defaultValue: []
        },
        // Business Documents
        crNumber: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Commercial Registration number'
        },
        crDocument: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'CR document file path'
        },
        taxNumber: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Tax/VAT number'
        },
        taxDocument: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Tax certificate file path'
        },
        licenseNumber: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Business license number'
        },
        licenseDocument: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'License document file path'
        },
        documents: {
            type: DataTypes.JSONB,
            defaultValue: {
                commercialRegister: null, // { url, verified, uploadedAt } - legacy
                license: null,
                ownerIdCard: null,
                vatCertificate: null
            }
        },
        // Contact Person
        contactPersonNameAr: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Contact person name in Arabic'
        },
        contactPersonNameEn: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Contact person name in English'
        },
        contactPersonEmail: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: { isEmail: true },
            comment: 'Contact person email'
        },
        contactPersonMobile: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Contact person mobile'
        },
        contactPersonPosition: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Contact person job title/position'
        },
        // Business Details
        providesHomeServices: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'Do you provide home services?'
        },
        staffCount: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Number of staff members'
        },
        mainService: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Main service provided'
        },
        sellsProducts: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'Planning to offer products for sale?'
        },
        hasOwnPaymentGateway: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'Has own payment gateway?'
        },
        serviceRanking: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: { min: 1, max: 5 },
            comment: 'Self-rated service ranking (1-5 stars)'
        },
        advertiseOnSocialMedia: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'Advertises on social media?'
        },
        wantsRifahPromotion: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'Wants Rifah to promote?'
        },
        // Working Hours
        workingHours: {
            type: DataTypes.JSONB,
            defaultValue: {
                sunday: { open: '09:00', close: '21:00', isOpen: true },
                monday: { open: '09:00', close: '21:00', isOpen: true },
                tuesday: { open: '09:00', close: '21:00', isOpen: true },
                wednesday: { open: '09:00', close: '21:00', isOpen: true },
                thursday: { open: '09:00', close: '21:00', isOpen: true },
                friday: { open: '14:00', close: '21:00', isOpen: true },
                saturday: { open: '09:00', close: '21:00', isOpen: true }
            }
        },
        // Subscription & Plan
        plan: {
            type: DataTypes.ENUM('free_trial', 'basic', 'pro', 'enterprise'),
            defaultValue: 'free_trial'
        },
        planStartDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        planEndDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Approval Status (for super admin)
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected', 'suspended', 'inactive'),
            defaultValue: 'pending'
        },
        approvedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        approvedBy: {
            type: DataTypes.UUID,
            allowNull: true // SuperAdmin ID
        },
        rejectionReason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        suspensionReason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Settings
        settings: {
            type: DataTypes.JSONB,
            defaultValue: {
                currency: 'SAR',
                timezone: 'Asia/Riyadh',
                language: 'ar',
                bookingBuffer: 15, // minutes between bookings
                maxAdvanceBooking: 30, // days in advance
                cancellationPolicy: 24, // hours before
                autoConfirmBookings: false,
                requireDeposit: false,
                depositPercentage: 0
            }
        },
        // Layout/Theme (for future)
        layoutTemplate: {
            type: DataTypes.ENUM('default', 'modern', 'classic', 'elegant'),
            defaultValue: 'default'
        },
        themeColors: {
            type: DataTypes.JSONB,
            defaultValue: {
                primary: '#7C3AED',
                secondary: '#EC4899'
            }
        },
        // Statistics (cached for performance)
        stats: {
            type: DataTypes.JSONB,
            defaultValue: {
                totalBookings: 0,
                totalRevenue: 0,
                totalCustomers: 0,
                averageRating: 0,
                totalReviews: 0
            }
        },
        // Owner Info (quick reference)
        ownerName: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Legacy owner name field'
        },
        ownerNameAr: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Owner full name in Arabic'
        },
        ownerNameEn: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Owner full name in English'
        },
        ownerPhone: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Owner personal phone'
        },
        ownerEmail: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Owner personal email'
        },
        ownerNationalId: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Owner National ID or Iqama number'
        },
        // Social Media Links
        facebookUrl: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'Facebook page/profile URL'
        },
        instagramUrl: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'Instagram profile URL'
        },
        twitterUrl: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'Twitter/X profile URL'
        },
        linkedinUrl: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'LinkedIn company/profile URL'
        },
        tiktokUrl: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'TikTok profile URL'
        },
        youtubeUrl: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'YouTube channel URL'
        },
        snapchatUrl: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'Snapchat username or URL'
        },
        pinterestUrl: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'Pinterest profile URL'
        }
    }, {
        sequelize,
        modelName: 'Tenant',
        tableName: 'tenants',
        schema: 'public',
        indexes: [
            { fields: ['status'] },
            { fields: ['businessType'] },
            { fields: ['city'] },
            { fields: ['plan'] },
            { fields: ['createdAt'] },
            { fields: ['email'], unique: true, where: { email: { [sequelize.Sequelize.Op.ne]: null } } }
        ],
        hooks: {
            beforeCreate: async (tenant) => {
                if (tenant.password) {
                    const bcrypt = require('bcrypt');
                    tenant.password = await bcrypt.hash(tenant.password, 10);
                }
            },
            beforeUpdate: async (tenant) => {
                if (tenant.changed('password') && tenant.password) {
                    const bcrypt = require('bcrypt');
                    tenant.password = await bcrypt.hash(tenant.password, 10);
                }
            }
        }
    });

    // Instance method to compare passwords
    Tenant.prototype.comparePassword = async function(candidatePassword) {
        const bcrypt = require('bcrypt');
        return await bcrypt.compare(candidatePassword, this.password);
    };

    return Tenant;
};
