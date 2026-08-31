/**
 * Public Tenant Controller
 * Handles public-facing API endpoints for tenant websites
 * No authentication required
 */

const db = require('../models');
const { Op } = require('sequelize');
const QRCode = require('qrcode');
const { APPOINTMENT_PAYMENT_STATUS } = require('../utils/appointmentPaymentStatus');
const {
    assertServicePaymentMethodAllowed,
    calculateServiceDeposit,
    getTenantPaymentSettings,
    normalizeServicePaymentOptions,
    resolvePublicOrderPaymentMethod
} = require('../utils/tenantPaymentSettings');
const {
    parseServiceVariants
} = require('../utils/serviceVariant');
const { createAppointmentTransaction } = require('../services/paymentTransactionLedgerService');
const { ensureAppointmentInvoice } = require('../services/customerInvoiceService');

const BUSINESS_TYPE_META = {
    beauty_salon: { name_en: 'Beauty Salon', name_ar: 'صالون تجميل', icon: '💄' },
    hair_salon: { name_en: 'Hair Salon', name_ar: 'صالون شعر', icon: '💇' },
    barber: { name_en: 'Barber', name_ar: 'حلاق', icon: '💈' },
    barbershop: { name_en: 'Barbershop', name_ar: 'محل حلاقة', icon: '💈' },
    spa: { name_en: 'Spa', name_ar: 'سبا', icon: '🧖' },
    nails: { name_en: 'Nails', name_ar: 'أظافر', icon: '💅' },
    massage: { name_en: 'Massage', name_ar: 'تدليك', icon: '💆' },
    makeup: { name_en: 'Makeup', name_ar: 'مكياج', icon: '💄' },
    skincare: { name_en: 'Skincare', name_ar: 'العناية بالبشرة', icon: '🧴' },
    wellness: { name_en: 'Wellness', name_ar: 'العافية', icon: '✨' }
};

const prettifySlug = (value) => value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const normalizeGeneralSettings = (generalSettings = {}) => {
    const sections = generalSettings?.sections || {};
    const aboutFallback = sections.about !== undefined ? sections.about : (sections.callToAction !== false);

    return {
        ...generalSettings,
        template: generalSettings?.template || 'template1',
        theme: {
            primaryColor: generalSettings?.theme?.primaryColor || '#3B82F6',
            secondaryColor: generalSettings?.theme?.secondaryColor || '#8B5CF6',
            helperColor: generalSettings?.theme?.helperColor || '#10B981'
        },
        sections: {
            heroSlider: sections.heroSlider !== false,
            services: sections.services !== false,
            products: sections.products !== false,
            about: aboutFallback !== false,
            reviews: sections.reviews === true,
            // keep legacy key for backward compatibility
            callToAction: sections.callToAction !== false
        },
        logo: generalSettings?.logo || null
    };
};

const buildAppContentEntry = ({
    key,
    titleAr,
    titleEn,
    contentAr,
    contentEn,
    url = '',
    iconKey = 'link',
    metadata = {},
    sortOrder = 0
}) => ({
    key,
    titleAr,
    titleEn,
    contentAr,
    contentEn,
    url,
    iconKey,
    metadata,
    publishedVersion: '1',
    publishedAt: null,
    updatedAt: null,
    sortOrder
});

const normalizeSocialUrl = (value) => {
    if (!value || typeof value !== 'string') {
        return '';
    }

    return value.trim();
};

/**
 * Get all active tenants (public listing)
 */
exports.getAllTenants = async (req, res) => {
    try {
        const { search } = req.query;

        const where = {
            status: 'active' // Only list active (paid) tenants
        };

        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { name_en: { [Op.iLike]: `%${search}%` } },
                { name_ar: { [Op.iLike]: `%${search}%` } },
                { slug: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const tenants = await db.Tenant.findAll({
            where,
            attributes: [
                'id',
                'name',
                'name_en',
                'name_ar',
                'slug',
                'businessType',
                'logo',
                'coverImage',
                'city',
                'status'
            ],
            order: [['createdAt', 'DESC']]
        });

        // Get service and staff counts for each tenant + check availability
        const tenantsWithCounts = await Promise.all(
            tenants.map(async (tenant) => {
                const tenantData = tenant.toJSON();
                
                const [servicesCount, staffCount] = await Promise.all([
                    db.Service.count({
                        where: { tenantId: tenantData.id, isActive: true }
                    }),
                    db.Staff.count({
                        where: { tenantId: tenantData.id, isActive: true }
                    })
                ]);

                // Check if tenant has available shifts for today
                const today = new Date();
                const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
                const currentTime = today.toTimeString().split(' ')[0].substring(0, 5); // HH:MM format

                // Check for active staff with shifts today
                const availableShifts = await db.StaffShift.count({
                    where: {
                        dayOfWeek: dayOfWeek,
                        isActive: true,
                        endTime: { [db.Sequelize.Op.gt]: currentTime } // Shift hasn't ended yet
                    },
                    include: [{
                        model: db.Staff,
                        as: 'staff',
                        where: {
                            tenantId: tenantData.id,
                            isActive: true
                        },
                        required: true
                    }]
                });

                const isAvailable = availableShifts > 0;

                return {
                    ...tenantData,
                    servicesCount,
                    staffCount,
                    isAvailable
                };
            })
        );

        res.json({
            success: true,
            tenants: tenantsWithCounts
        });
    } catch (error) {
        console.error('Get all tenants error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tenants',
            error: error.message
        });
    }
};

/**
 * Get public business categories derived from active tenants
 */
exports.getPublicCategories = async (req, res) => {
    try {
        const tenants = await db.Tenant.findAll({
            where: { status: 'active' },
            attributes: ['businessType']
        });

        const categorySet = new Set();

        tenants.forEach((tenant) => {
            const businessTypes = Array.isArray(tenant.businessType)
                ? tenant.businessType
                : tenant.businessType
                    ? [tenant.businessType]
                    : [];

            businessTypes
                .map((value) => `${value}`.trim().toLowerCase())
                .filter(Boolean)
                .forEach((value) => categorySet.add(value));
        });

        const categories = Array.from(categorySet)
            .sort()
            .map((slug, index) => {
                const meta = BUSINESS_TYPE_META[slug] || {
                    name_en: prettifySlug(slug),
                    name_ar: prettifySlug(slug),
                    icon: '📂'
                };

                return {
                    id: slug,
                    slug,
                    name_en: meta.name_en,
                    name_ar: meta.name_ar,
                    icon: meta.icon,
                    sortOrder: index + 1,
                    isActive: true
                };
            });

        res.json({
            success: true,
            categories
        });
    } catch (error) {
        console.error('Get public categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch categories',
            error: error.message
        });
    }
};

/**
 * Get customer app content blocks (public)
 */
exports.getCustomerAppContent = async (req, res) => {
    try {
        const [tenant, publicPageData] = await Promise.all([
            db.Tenant.findOne({
                where: {
                    status: 'active'
                },
                attributes: [
                    'id',
                    'name',
                    'name_en',
                    'name_ar',
                    'slug',
                    'email',
                    'phone',
                    'mobile',
                    'whatsapp',
                    'facebookUrl',
                    'instagramUrl',
                    'twitterUrl',
                    'linkedinUrl',
                    'tiktokUrl',
                    'youtubeUrl',
                    'snapchatUrl',
                    'pinterestUrl'
                ],
                order: [['createdAt', 'DESC']]
            }),
            db.PublicPageData.findOne({
                attributes: ['generalSettings', 'aboutUs_storyEn', 'aboutUs_storyAr', 'contactUs_data']
            })
        ]);

        const tenantNameEn = tenant?.name_en || tenant?.name || 'Refah';
        const tenantNameAr = tenant?.name_ar || tenant?.name || 'رفاه';
        const supportPhone = normalizeSocialUrl(tenant?.whatsapp || tenant?.mobile || tenant?.phone);
        const supportEmail = normalizeSocialUrl(tenant?.email);
        const contactData = publicPageData?.contactUs_data || {};
        const aboutTextEn = publicPageData?.aboutUs_storyEn
            || `Learn more about ${tenantNameEn} and the services we provide.`;
        const aboutTextAr = publicPageData?.aboutUs_storyAr
            || `تعرف على ${tenantNameAr} والخدمات التي نقدمها.`;
        const supportTextEn = contactData?.supportMessageEn
            || 'Reach out to us for help, support, or general questions.';
        const supportTextAr = contactData?.supportMessageAr
            || 'تواصل معنا للحصول على المساعدة أو الدعم أو أي استفسارات عامة.';
        const privacyTextEn = contactData?.privacyTextEn
            || 'Review our privacy and terms information before using the customer app.';
        const privacyTextAr = contactData?.privacyTextAr
            || 'يرجى مراجعة سياسة الخصوصية والشروط قبل استخدام تطبيق العملاء.';

        const socialItems = [
            ['instagram', tenant?.instagramUrl],
            ['facebook', tenant?.facebookUrl],
            ['twitter', tenant?.twitterUrl],
            ['linkedin', tenant?.linkedinUrl],
            ['tiktok', tenant?.tiktokUrl],
            ['youtube', tenant?.youtubeUrl],
            ['snapchat', tenant?.snapchatUrl],
            ['website', tenant?.pinterestUrl]
        ]
            .map(([iconKey, url], index) => {
                const normalizedUrl = normalizeSocialUrl(url);
                if (!normalizedUrl) {
                    return null;
                }

                return buildAppContentEntry({
                    key: `${iconKey}`,
                    titleAr: iconKey,
                    titleEn: iconKey,
                    contentAr: '',
                    contentEn: '',
                    url: normalizedUrl,
                    iconKey,
                    metadata: {
                        platform: iconKey
                    },
                    sortOrder: index + 1
                });
            })
            .filter(Boolean);

        const appContent = {
            appTarget: 'customer_app',
            legal: {
                about_refah: buildAppContentEntry({
                    key: 'about_refah',
                    titleAr: `عن ${tenantNameAr}`,
                    titleEn: `About ${tenantNameEn}`,
                    contentAr: aboutTextAr,
                    contentEn: aboutTextEn,
                    url: '',
                    iconKey: 'sparkles',
                    metadata: {
                        section: 'about',
                        tenantId: tenant?.id || null
                    },
                    sortOrder: 1
                }),
                privacy_terms: buildAppContentEntry({
                    key: 'privacy_terms',
                    titleAr: 'سياسة الخصوصية والشروط',
                    titleEn: 'Privacy & Terms',
                    contentAr: privacyTextAr,
                    contentEn: privacyTextEn,
                    url: '',
                    iconKey: 'shield',
                    metadata: {
                        section: 'privacy',
                        tenantId: tenant?.id || null
                    },
                    sortOrder: 2
                })
            },
            support: {
                help_support: buildAppContentEntry({
                    key: 'help_support',
                    titleAr: 'المساعدة والدعم',
                    titleEn: 'Help & Support',
                    contentAr: supportTextAr,
                    contentEn: supportTextEn,
                    url: '',
                    iconKey: 'message',
                    metadata: {
                        section: 'support',
                        tenantId: tenant?.id || null,
                        email: supportEmail || null,
                        phone: supportPhone || null
                    },
                    sortOrder: 1
                })
            },
            social: socialItems,
            store: {},
            display: {}
        };

        return res.json({
            success: true,
            appContent
        });
    } catch (error) {
        console.error('Get customer app content error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch customer app content',
            error: error.message
        });
    }
};

/**
 * Get top-rated active providers across active tenants
 */
exports.getTopProviders = async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit || '8', 10), 1), 20);

        const staff = await db.Staff.findAll({
            where: {
                isActive: true
            },
            include: [
                {
                    model: db.Tenant,
                    as: 'tenant',
                    where: { status: 'active' },
                    attributes: ['id', 'name', 'name_en', 'name_ar', 'slug', 'logo'],
                    required: true
                }
            ],
            attributes: ['id', 'name', 'photo', 'rating', 'experience', 'skills', 'bio'],
            order: [
                ['rating', 'DESC'],
                ['totalBookings', 'DESC'],
                ['createdAt', 'DESC']
            ],
            limit
        });

        const providers = staff.map((member) => {
            const memberData = member.toJSON();
            return {
                id: memberData.id,
                name: memberData.name,
                avatar: memberData.photo,
                rating: parseFloat(memberData.rating || 0) || 0,
                skills: Array.isArray(memberData.skills) ? memberData.skills : [],
                experience: memberData.experience,
                bio: memberData.bio,
                specialty: Array.isArray(memberData.skills) && memberData.skills.length > 0
                    ? memberData.skills[0]
                    : null,
                tenant: memberData.tenant ? {
                    id: memberData.tenant.id,
                    name: memberData.tenant.name_ar || memberData.tenant.name_en || memberData.tenant.name,
                    slug: memberData.tenant.slug,
                    logo: memberData.tenant.logo
                } : null
            };
        });

        res.json({
            success: true,
            staff: providers
        });
    } catch (error) {
        console.error('Get top providers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch top providers',
            error: error.message
        });
    }
};

/**
 * Get tenant basic info by slug
 */
exports.getTenantBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const tenant = await db.Tenant.findOne({
            where: { slug },
            attributes: [
                'id',
                'name',
                'name_en',
                'name_ar',
                'slug',
                'businessType',
                'logo',
                'coverImage',
                'email',
                'phone',
                'mobile',
                'buildingNumber',
                'street',
                'district',
                'city',
                'country',
                'postalCode',
                'googleMapLink',
                'facebookUrl',
                'instagramUrl',
                'twitterUrl',
                'linkedinUrl',
                'tiktokUrl',
                'youtubeUrl',
                'snapchatUrl',
                'pinterestUrl',
                'whatsapp',
                'workingHours',
                'coordinates'
            ]
        });

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        // Map coverImage to profileImage and whatsapp to whatsappNumber for frontend compatibility
        const tenantData = tenant.toJSON();
        tenantData.profileImage = tenantData.coverImage;
        tenantData.whatsappNumber = tenantData.whatsapp;
        tenantData.paymentSettings = await getTenantPaymentSettings(tenant.id);
        // Keep coverImage for Client App compatibility
        // delete tenantData.coverImage;
        delete tenantData.whatsapp;

        // Fetch tenant's custom colors from PublicPageData (for Client App theming)
        try {
            const publicPageData = await db.PublicPageData.findOne({
                where: { tenantId: tenant.id },
                attributes: ['generalSettings']
            });

            if (publicPageData && publicPageData.generalSettings && publicPageData.generalSettings.theme) {
                tenantData.customColors = publicPageData.generalSettings.theme;
            }
        } catch (colorError) {
            console.warn('Could not fetch custom colors:', colorError.message);
            // Continue without colors - client will use defaults
        }

        res.json({
            success: true,
            data: tenantData
        });
    } catch (error) {
        console.error('Get tenant by slug error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tenant information',
            error: error.message
        });
    }
};

/**
 * Get public page data (hero sliders, about us, general settings)
 */
exports.getPublicPageData = async (req, res) => {
    try {
        const { tenantId } = req.params;

        let pageData = await db.PublicPageData.findOne({
            where: { tenantId }
        });

        // Create default record if doesn't exist
        if (!pageData) {
            pageData = await db.PublicPageData.create({
                tenantId,
                aboutUs_storyTitle: 'ourStory',
                aboutUs_missions: [],
                aboutUs_visions: [],
                aboutUs_values: [],
                aboutUs_facilitiesImages: [],
                aboutUs_finalWordType: 'image',
                heroSliders: [],
                homePage_data: {},
                contactUs_data: {},
                generalSettings: {
                    template: 'template1',
                    theme: {
                        primaryColor: '#3B82F6',
                        secondaryColor: '#8B5CF6',
                        helperColor: '#10B981'
                    },
                    sections: {
                        heroSlider: true,
                        services: true,
                        products: true,
                        about: true,
                        reviews: false,
                        callToAction: true
                    }
                }
            });
        }

        res.json({
            success: true,
            data: {
                aboutUs: {
                    heroImage: pageData.aboutUs_heroImage,
                    storyTitle: pageData.aboutUs_storyTitle,
                    storyEn: pageData.aboutUs_storyEn,
                    storyAr: pageData.aboutUs_storyAr,
                    missions: pageData.aboutUs_missions || [],
                    visions: pageData.aboutUs_visions || [],
                    values: pageData.aboutUs_values || [],
                    facilitiesDescriptionEn: pageData.aboutUs_facilitiesDescriptionEn,
                    facilitiesDescriptionAr: pageData.aboutUs_facilitiesDescriptionAr,
                    facilitiesImages: pageData.aboutUs_facilitiesImages || [],
                    finalWordTitleEn: pageData.aboutUs_finalWordTitleEn,
                    finalWordTitleAr: pageData.aboutUs_finalWordTitleAr,
                    finalWordTextEn: pageData.aboutUs_finalWordTextEn,
                    finalWordTextAr: pageData.aboutUs_finalWordTextAr,
                    finalWordType: pageData.aboutUs_finalWordType,
                    finalWordImageUrl: pageData.aboutUs_finalWordImageUrl,
                    finalWordIconName: pageData.aboutUs_finalWordIconName
                },
                heroSliders: pageData.heroSliders || [],
                pageBanners: {
                    services: pageData.pageBanner_services || null,
                    products: pageData.pageBanner_products || null,
                    about: pageData.pageBanner_about || null,
                    contact: pageData.pageBanner_contact || null
                },
                generalSettings: normalizeGeneralSettings(pageData.generalSettings || {})
            }
        });
    } catch (error) {
        console.error('Get public page data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch public page data',
            error: error.message
        });
    }
};

/**
 * Get active services (public)
 */
exports.getPublicServices = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { category, minPrice, maxPrice, search } = req.query;

        const where = {
            tenantId,
            isActive: true
        };

        if (category && category !== 'all') {
            where.category = category;
        }

        if (minPrice || maxPrice) {
            where.finalPrice = {};
            if (minPrice) {
                where.finalPrice[Op.gte] = parseFloat(minPrice);
            }
            if (maxPrice) {
                where.finalPrice[Op.lte] = parseFloat(maxPrice);
            }
        }

        if (search) {
            where[Op.or] = [
                { name_en: { [Op.iLike]: `%${search}%` } },
                { name_ar: { [Op.iLike]: `%${search}%` } },
                { description_en: { [Op.iLike]: `%${search}%` } },
                { description_ar: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const services = await db.Service.findAll({
            where,
            attributes: [
                'id',
                'name_en',
                'name_ar',
                'description_en',
                'description_ar',
                'category',
                'finalPrice',
                'duration',
                'image',
                'variants',
                'paymentOptions',
                'availableInCenter',
                'availableHomeVisit',
                'allowReschedule'
            ],
            order: [['createdAt', 'DESC']]
        });

        const serviceRows = services.map((service) => {
            const serviceData = service.toJSON();
            serviceData.variants = parseServiceVariants(serviceData.variants || []);
            return serviceData;
        });

        res.json({
            success: true,
            services: serviceRows
        });
    } catch (error) {
        console.error('Get public services error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch services',
            error: error.message
        });
    }
};

/**
 * Get single service details (public)
 */
exports.getPublicService = async (req, res) => {
    try {
        const { tenantId, id } = req.params;

        const service = await db.Service.findOne({
            where: {
                id,
                tenantId,
                isActive: true
            },
            attributes: [
                'id',
                'name_en',
                'name_ar',
                'description_en',
                'description_ar',
                'category',
                'finalPrice',
                'duration',
                'image',
                'variants',
                'paymentOptions',
                'availableInCenter',
                'availableHomeVisit',
                'allowReschedule'
            ],
            include: [
                {
                    model: db.Staff,
                    as: 'employees',
                    attributes: ['id', 'name', 'photo', 'rating', 'bio', 'experience', 'skills'],
                    through: { attributes: [] },
                    required: false // Left join - service can exist without employees
                }
            ]
        });

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // Map staff photo to image for frontend compatibility
        const serviceData = service.toJSON();
        serviceData.variants = parseServiceVariants(serviceData.variants || []);
        if (serviceData.employees && Array.isArray(serviceData.employees)) {
            serviceData.employees = serviceData.employees.map((employee) => {
                const employeeData = { ...employee };
                employeeData.image = employeeData.photo;
                employeeData.name_ar = employeeData.name; // Staff only has 'name', not 'name_ar'
                employeeData.specialty = Array.isArray(employeeData.skills) && employeeData.skills.length > 0 
                    ? employeeData.skills[0] 
                    : null;
                delete employeeData.photo;
                return employeeData;
            });
        }

        res.json({
            success: true,
            service: serviceData
        });
    } catch (error) {
        console.error('Get public service error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch service',
            error: error.message
        });
    }
};

/**
 * Get available products (public)
 */
exports.getPublicProducts = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { category, minPrice, maxPrice, search, brand } = req.query;

        const where = {
            tenantId,
            isAvailable: true
        };

        if (category && category !== 'all') {
            where.category = category;
        }

        if (minPrice || maxPrice) {
            where.finalPrice = {};
            if (minPrice) {
                where.finalPrice[Op.gte] = parseFloat(minPrice);
            }
            if (maxPrice) {
                where.finalPrice[Op.lte] = parseFloat(maxPrice);
            }
        }

        if (search) {
            where[Op.or] = [
                { name_en: { [Op.iLike]: `%${search}%` } },
                { name_ar: { [Op.iLike]: `%${search}%` } },
                { description_en: { [Op.iLike]: `%${search}%` } },
                { description_ar: { [Op.iLike]: `%${search}%` } },
                { category: { [Op.iLike]: `%${search}%` } },
                { brand: { [Op.iLike]: `%${search}%` } }
            ];
        }

        if (brand && brand !== 'all') {
            where.brand = { [Op.iLike]: `%${brand}%` };
        }

        const products = await db.Product.findAll({
            where,
            attributes: [
                'id',
                'name_en',
                'name_ar',
                'description_en',
                'description_ar',
                'category',
                'price',
                'rawPrice',
                'images',
                'image',
                'stock',
                'isAvailable',
                'brand'
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            products
        });
    } catch (error) {
        console.error('Get public products error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch products',
            error: error.message
        });
    }
};

/**
 * Get single product details (public)
 */
exports.getPublicProduct = async (req, res) => {
    try {
        const { tenantId, id } = req.params;

        const product = await db.Product.findOne({
            where: {
                id,
                tenantId,
                isAvailable: true
            }
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            product
        });
    } catch (error) {
        console.error('Get public product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch product',
            error: error.message
        });
    }
};

/**
 * Get active staff members (public)
 */
exports.getPublicStaff = async (req, res) => {
    try {
        const { tenantId } = req.params;

        const staff = await db.Staff.findAll({
            where: {
                tenantId,
                isActive: true
            },
            attributes: [
                'id',
                'name',
                'photo',
                'rating',
                'experience',
                'skills',
                'bio'
            ],
            order: [['rating', 'DESC']]
        });

        // Map photo to image for frontend compatibility
        const staffData = staff.map(member => {
            const memberData = member.toJSON();
            memberData.image = memberData.photo;
            memberData.specialty = Array.isArray(memberData.skills) && memberData.skills.length > 0 
                ? memberData.skills[0] 
                : null;
            delete memberData.photo;
            return memberData;
        });

        res.json({
            success: true,
            staff: staffData
        });
    } catch (error) {
        console.error('Get public staff error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch staff',
            error: error.message
        });
    }
};

/**
 * Get staff members assigned to a specific service (public)
 */
exports.getPublicStaffByService = async (req, res) => {
    try {
        const { tenantId, serviceId } = req.params;

        // First verify the service exists and belongs to this tenant
        const service = await db.Service.findOne({
            where: {
                id: serviceId,
                tenantId,
                isActive: true
            }
        });

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // Get staff assigned to this service through ServiceEmployee table
        const staff = await db.Staff.findAll({
            where: {
                tenantId,
                isActive: true
            },
            attributes: [
                'id',
                'name',
                'photo',
                'rating',
                'experience',
                'skills',
                'bio'
            ],
            include: [
                {
                    model: db.Service,
                    as: 'services',
                    where: { id: serviceId },
                    attributes: [],
                    through: { attributes: [] },
                    required: true // Inner join - only staff assigned to this service
                }
            ],
            order: [['rating', 'DESC']]
        });

        // Map photo to image for frontend compatibility
        const staffData = staff.map(member => {
            const memberData = member.toJSON();
            memberData.image = memberData.photo;
            memberData.specialty = Array.isArray(memberData.skills) && memberData.skills.length > 0 
                ? memberData.skills[0] 
                : null;
            delete memberData.photo;
            return memberData;
        });

        res.json({
            success: true,
            staff: staffData,
            count: staffData.length
        });
    } catch (error) {
        console.error('Get public staff by service error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch staff for service',
            error: error.message
        });
    }
};

/**
 * Create booking (public, no auth required)
 * Uses unified BookingService with PlatformUser integration
 */
exports.createPublicBooking = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const {
            serviceId,
            variantId,
            staffId, // Optional - null means "Any Staff"
            date,
            time,
            serviceType, // 'in-center' or 'home-visit' (for future use)
            customerName,
            customerEmail,
            customerPhone,
            specialRequests, // For future use
            paymentMethod, // 'at-center', 'online-full', 'booking-fee' (for future use)
            location // for home visits (for future use)
        } = req.body;

        // Validate required fields
        if (!serviceId || !date || !time || !customerName || !customerPhone) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: serviceId, date, time, customerName, and customerPhone are required'
            });
        }

        // Import services
        const userService = require('../services/userService');
        const bookingService = require('../services/bookingService');

        // Find or create PlatformUser (not Customer)
        // Split customerName into firstName and lastName
        const nameParts = customerName.trim().split(/\s+/);
        const firstName = nameParts[0] || 'Guest';
        const lastName = nameParts.slice(1).join(' ') || 'User';

        const platformUser = await userService.findOrCreatePlatformUser({
            email: customerEmail || null,
            phone: customerPhone,
            firstName,
            lastName
        });

        const bookingItems = Array.isArray(req.body.items) ? req.body.items : [];
        const { bookingSessionId, bookingReference, bookingItemIndex } = req.body || {};
        if (bookingItems.length > 0) {
            const normalizedItems = bookingItems.map((item, index) => {
                const rawStartTime = item.startTime
                    || (item.date && item.time ? new Date(`${item.date}T${item.time}`).toISOString() : null)
                    || null;
                const parsedStartTime = rawStartTime ? new Date(rawStartTime) : null;

                if (!parsedStartTime || Number.isNaN(parsedStartTime.getTime())) {
                    throw new Error(`Invalid start time for booking item ${index + 1}`);
                }

                return {
                    serviceId: item.serviceId,
                    variantId: item.variantId || null,
                    staffId: item.staffId || null,
                    requestedStaffId: item.requestedStaffId || item.staffId || null,
                    startTime: parsedStartTime.toISOString(),
                    notes: item.notes || specialRequests || null,
                    paymentMethod: item.paymentMethod || paymentMethod || 'at-center',
                    assignmentMode: item.assignmentMode || (item.staffId ? 'tenant_reassigned' : undefined),
                    duration: item.duration,
                    discountType: item.discountType,
                    discountValue: item.discountValue
                };
            });

            const { session, appointments, paymentSummary } = await bookingService.createBookingSession({
                tenantId,
                platformUserId: platformUser.id,
                items: normalizedItems,
                notes: specialRequests || null,
                paymentMethod: normalizedItems[0]?.paymentMethod || paymentMethod || 'at-center',
                bookingSessionId,
                bookingReference,
                bookingItemIndex
            });

            res.json({
                success: true,
                message: 'Booking created successfully',
                data: {
                    bookingId: session.id,
                    bookingReference: session.bookingReference,
                    bookingSessionId: session.id,
                    paymentSummary,
                    appointments: appointments.map((appointment) => ({
                        id: appointment.id,
                        bookingNumber: appointment.bookingNumber,
                        startTime: appointment.startTime,
                        endTime: appointment.endTime,
                        status: appointment.status,
                        paymentStatus: appointment.paymentStatus,
                        serviceVariantId: appointment.serviceVariantId,
                        serviceVariantName: appointment.serviceVariantName,
                        serviceVariantDuration: appointment.serviceVariantDuration
                    })),
                    platformUserId: platformUser.id
                }
            });
            return;
        }

        // Combine date and time into startTime
        const startTime = new Date(`${date}T${time}`);
        if (isNaN(startTime.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date or time format'
            });
        }

        const service = await db.Service.findOne({
            where: {
                id: serviceId,
                tenantId,
                isActive: true
            },
            attributes: ['id', 'name_en', 'name_ar', 'paymentOptions', 'allowReschedule']
        });

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        const tenantPaymentSettings = await getTenantPaymentSettings(tenantId);
        const servicePaymentOptions = normalizeServicePaymentOptions(service.paymentOptions);
        assertServicePaymentMethodAllowed(paymentMethod || 'at-center', tenantPaymentSettings, servicePaymentOptions);

        // Use unified booking service
        // This handles all validation, conflict checking, pricing, etc.
        const appointment = await bookingService.createBooking({
            serviceId,
            variantId: variantId || null,
            staffId: staffId || null, // null = "Any Staff"
            requestedStaffId: staffId || null,
            platformUserId: platformUser.id,
            tenantId,
            startTime: startTime.toISOString()
        });

        const pricing = {
            totalAmount: appointment.price,
            rawPrice: appointment.rawPrice,
            taxAmount: appointment.taxAmount,
            platformFee: appointment.platformFee
        };

        const bookingFee = paymentMethod === 'booking-fee'
            ? calculateServiceDeposit(appointment.price ?? 0, tenantPaymentSettings).depositAmount
            : 0;

        if (paymentMethod === 'online-full') {
            const totalPaid = parseFloat(appointment.price ?? 0);

            await appointment.update({
                paymentStatus: APPOINTMENT_PAYMENT_STATUS.FULLY_PAID,
                paymentMethod: 'mock_online',
                paidAt: new Date(),
                depositAmount: 0,
                depositPaid: true,
                remainderAmount: 0,
                remainderPaid: true,
                totalPaid
            });

            await createAppointmentTransaction({
                appointmentId: appointment.id,
                type: 'full',
                amount: totalPaid,
                paymentMethod: 'online',
                status: 'completed',
                processedBy: null,
                processedAt: appointment.paidAt || new Date(),
                transactionRef: `PUBLIC-BOOKING-FULL-${appointment.bookingNumber || appointment.id.substring(0, 8).toUpperCase()}`,
                notes: 'Full online booking payment',
                metadata: {
                    source: 'public_booking_checkout',
                    paymentChoice: 'online-full',
                    tenantId,
                    platformUserId: platformUser.id
                }
            });

            await db.PlatformUser.increment('totalSpent', {
                by: totalPaid,
                where: { id: platformUser.id }
            });

            await db.CustomerInsight.increment('totalSpent', {
                by: totalPaid,
                where: { platformUserId: platformUser.id, tenantId }
            });
        } else if (paymentMethod === 'booking-fee') {
            const totalPrice = parseFloat(appointment.price ?? 0);
            const splitPayment = calculateServiceDeposit(totalPrice, tenantPaymentSettings);
            const safeBookingFee = splitPayment.depositAmount;
            const normalizedTotalPrice = Number.isFinite(totalPrice) ? totalPrice : 0;
            const isFullyCoveredByDeposit = safeBookingFee >= normalizedTotalPrice && normalizedTotalPrice > 0;
            const nextPaymentStatus = isFullyCoveredByDeposit
                ? APPOINTMENT_PAYMENT_STATUS.FULLY_PAID
                : APPOINTMENT_PAYMENT_STATUS.DEPOSIT_PAID;
            const safeRemainderAmount = isFullyCoveredByDeposit
                ? 0
                : splitPayment.remainderAmount;

            await appointment.update({
                paymentStatus: nextPaymentStatus,
                paymentMethod: 'mock_booking_fee',
                paidAt: new Date(),
                depositAmount: safeBookingFee,
                depositPaid: safeBookingFee > 0,
                remainderAmount: safeRemainderAmount,
                remainderPaid: isFullyCoveredByDeposit,
                totalPaid: safeBookingFee
            });

            await createAppointmentTransaction({
                appointmentId: appointment.id,
                type: 'deposit',
                amount: safeBookingFee,
                paymentMethod: 'online',
                status: 'completed',
                processedBy: null,
                processedAt: appointment.paidAt || new Date(),
                transactionRef: `PUBLIC-BOOKING-DEPOSIT-${appointment.bookingNumber || appointment.id.substring(0, 8).toUpperCase()}`,
                notes: 'Online booking deposit payment',
                metadata: {
                    source: 'public_booking_checkout',
                    paymentChoice: 'booking-fee',
                    depositMode: splitPayment.depositMode,
                    depositPercentage: splitPayment.depositPercentage,
                    remainderAmount: splitPayment.remainderAmount,
                    tenantId,
                    platformUserId: platformUser.id
                }
            });

            if (safeBookingFee > 0) {
                await db.PlatformUser.increment('totalSpent', {
                    by: safeBookingFee,
                    where: { id: platformUser.id }
                });

                await db.CustomerInsight.increment('totalSpent', {
                    by: safeBookingFee,
                    where: { platformUserId: platformUser.id, tenantId }
                });
            }
        }

        try {
            await ensureAppointmentInvoice(appointment.id);
        } catch (invoiceErr) {
            console.warn('Could not generate CustomerInvoice for public booking:', invoiceErr.message);
        }

        await appointment.reload();

        res.json({
            success: true,
            message: 'Booking created successfully',
            data: {
                bookingId: appointment.id,
                bookingReference: appointment.bookingNumber || appointment.id.substring(0, 8).toUpperCase(),
                bookingQrUrl: `/api/v1/public/tenant/${tenantId}/bookings/${encodeURIComponent(
                    appointment.bookingNumber || appointment.id
                )}/qr`,
                appointment: {
                    id: appointment.id,
                    bookingNumber: appointment.bookingNumber,
                    startTime: appointment.startTime,
                    endTime: appointment.endTime,
                    status: appointment.status,
                    paymentStatus: appointment.paymentStatus,
                    serviceVariantId: appointment.serviceVariantId,
                    serviceVariantName: appointment.serviceVariantName,
                    serviceVariantDuration: appointment.serviceVariantDuration,
                    service: {
                        id: service.id,
                        name_en: service.name_en,
                        name_ar: service.name_ar,
                        paymentOptions: servicePaymentOptions
                    }
                },
                pricing,
                bookingFee,
                // Note: customerId is deprecated, using platformUserId
                platformUserId: platformUser.id
            }
        });
    } catch (error) {
        console.error('Create public booking error:', error);
        
        // Determine appropriate status code
        let statusCode = 500;
        if (error.message.includes('required')
            || error.message.includes('Invalid')
            || error.message.includes('payment option')
            || error.message.includes('Pay at')
            || error.message.includes('Cash on delivery')
            || error.message.includes('Online product payment')) {
            statusCode = 400;
        } else if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('conflict') || error.message.includes('not available')) {
            statusCode = 409; // Conflict
        } else if (error.message.includes('inactive') || error.message.includes('banned')) {
            statusCode = 403; // Forbidden
        }
        
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to create booking'
        });
    }
};

/**
 * Get staff available for a specific service (public)
 */

/**
 * Generate a QR code image for a booking reference.
 */
exports.getBookingQrCode = async (req, res) => {
    try {
        const { tenantId, bookingNumber } = req.params;

        const appointment = await db.Appointment.findOne({
            where: {
                tenantId,
                [Op.or]: [
                    { bookingNumber },
                    { id: bookingNumber }
                ]
            },
            include: [
                {
                    model: db.Service,
                    as: 'service',
                    attributes: ['name_en', 'name_ar'],
                    required: false
                },
                {
                    model: db.PlatformUser,
                    as: 'user',
                    attributes: ['firstName', 'lastName', 'phone'],
                    required: false
                }
            ]
        });

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        const customerName = `${appointment.user?.firstName || ''} ${appointment.user?.lastName || ''}`.trim();
        const qrPayload = JSON.stringify({
            type: 'refah_booking',
            tenantId,
            appointmentId: appointment.id,
            bookingNumber: appointment.bookingNumber || appointment.id,
            customerName: customerName || null,
            customerPhone: appointment.user?.phone || null,
            serviceName: appointment.service?.name_en || appointment.service?.name_ar || null,
            startTime: appointment.startTime
        });

        const qrImage = await QRCode.toBuffer(qrPayload, {
            type: 'png',
            width: 512,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: {
                dark: '#7C3AED',
                light: '#FFFFFF'
            }
        });

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.send(qrImage);
    } catch (error) {
        console.error('Get booking QR code error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate booking QR code',
            error: error.message
        });
    }
};

/**
 * Create product order (public, no auth required)
 */
exports.createPublicOrder = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const {
            items, // [{ productId, quantity }]
            customerName,
            customerEmail,
            customerPhone,
            shippingAddress, // Can be a string or object
            city,
            district,
            postalCode,
            street,
            building,
            floor,
            apartment,
            notes,
            deliveryMethod, // 'standard' or 'express'
            paymentMethod // 'online' or 'cash-on-delivery'
        } = req.body;
        const authenticatedUserId = req.userId || null;

        // Validate required fields
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Order items are required'
            });
        }

        if (!customerName || !customerEmail || !customerPhone) {
            return res.status(400).json({
                success: false,
                message: 'Customer information is required'
            });
        }

        const userService = require('../services/userService');
        const orderService = require('../services/orderService');

        let platformUserId = authenticatedUserId;

        if (!platformUserId) {
            const nameParts = customerName.trim().split(/\s+/);
            const firstName = nameParts[0] || 'Guest';
            const lastName = nameParts.slice(1).join(' ') || 'User';

            const platformUser = await userService.findOrCreatePlatformUser({
                email: customerEmail || null,
                phone: customerPhone,
                firstName,
                lastName
            });

            platformUserId = platformUser.id;
        }

        // Prepare shipping address as JSONB
        const shippingAddressData = (shippingAddress || (city && district)) ? {
            street: street || (typeof shippingAddress === 'string' ? shippingAddress.split(',')[0] : '') || '',
            city: city || '',
            district: district || '',
            building: building || '',
            floor: floor || '',
            apartment: apartment || '',
            phone: customerPhone,
            notes: notes || ''
        } : null;

        const deliveryType = shippingAddressData ? 'delivery' : 'pickup';
        const tenantPaymentSettings = await getTenantPaymentSettings(tenantId);
        const normalizedPaymentMethod = resolvePublicOrderPaymentMethod(
            paymentMethod,
            deliveryType,
            tenantPaymentSettings
        );

        const order = await orderService.createOrder({
            platformUserId,
            tenantId,
            items,
            paymentMethod: normalizedPaymentMethod,
            deliveryType,
            deliveryMethod: deliveryMethod || 'standard',
            shippingAddress: shippingAddressData,
            shippingFee: tenantPaymentSettings.defaultDeliveryFee,
            notes: notes || null
        });

        let finalOrder = order;
        if (normalizedPaymentMethod === 'online') {
            await orderService.updatePaymentStatus(order.id, 'paid', {
                paymentMethod: 'online',
                transactionRef: `PUBLIC-ORDER-${order.orderNumber}`,
                notes: 'Online order payment from public checkout',
                metadata: {
                    source: 'public_order_checkout',
                    tenantId,
                    platformUserId
                }
            });
            finalOrder = await orderService.getOrderById(order.id);
        }

        res.json({
            success: true,
            message: 'Order created successfully',
            data: {
                orderId: finalOrder.id,
                orderReference: finalOrder.orderNumber,
                total: finalOrder.totalAmount,
                items: (finalOrder.items || []).map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.totalPrice
                }))
            }
        });
    } catch (error) {
        console.error('Create public order error:', error);
        const statusCode = error.message.includes('payment')
            || error.message.includes('Pay at')
            || error.message.includes('Cash on delivery')
            || error.message.includes('Missing required')
            || error.message.includes('Invalid')
            ? 400
            : 500;

        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to create order',
            error: error.message
        });
    }
};

/**
 * Submit contact form (public)
 */
exports.submitContactForm = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { name, email, phone, subject, message } = req.body;

        // Validate required fields
        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and message are required'
            });
        }

        // Store contact form submission
        // You can create a ContactMessage model or store in a JSONB field
        // For now, we'll just return success
        // TODO: Implement contact message storage

        res.json({
            success: true,
            message: 'Contact form submitted successfully'
        });
    } catch (error) {
        console.error('Submit contact form error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit contact form',
            error: error.message
        });
    }
};
