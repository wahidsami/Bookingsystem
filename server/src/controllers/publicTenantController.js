/**
 * Public Tenant Controller
 * Handles public-facing API endpoints for tenant websites
 * No authentication required
 */

const db = require('../models');
const { Op } = require('sequelize');

/**
 * Get all active tenants (public listing)
 */
exports.getAllTenants = async (req, res) => {
    try {
        const { search } = req.query;

        const where = {
            status: ['active', 'approved'] // Include both active and approved tenants
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
                
                console.log('🔍 Counting for tenant:', tenantData.id, tenantData.name);
                
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

                console.log('  📊 Services:', servicesCount, 'Staff:', staffCount, 'Available:', isAvailable);

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
                'workingHours'
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
                generalSettings: {
                    ...(pageData.generalSettings || {
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
                            callToAction: true
                        }
                    }),
                    logo: pageData.generalSettings?.logo || null
                }
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
                'availableInCenter',
                'availableHomeVisit',
                'benefits',
                'whatToExpect'
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            services
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
                'availableInCenter',
                'availableHomeVisit',
                'benefits',
                'whatToExpect'
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
        const { category, minPrice, maxPrice, search } = req.query;

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
                { description_ar: { [Op.iLike]: `%${search}%` } }
            ];
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
                'stock',
                'isAvailable'
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

        // Combine date and time into startTime
        const startTime = new Date(`${date}T${time}`);
        if (isNaN(startTime.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date or time format'
            });
        }

        // Use unified booking service
        // This handles all validation, conflict checking, pricing, etc.
        const appointment = await bookingService.createBooking({
            serviceId,
            staffId: staffId || null, // null = "Any Staff"
            platformUserId: platformUser.id,
            tenantId,
            startTime: startTime.toISOString()
        });

        // Get service for pricing info (for response)
        const service = await db.Service.findByPk(serviceId);
        const pricing = {
            totalAmount: appointment.price,
            rawPrice: appointment.rawPrice,
            taxAmount: appointment.taxAmount,
            platformFee: appointment.platformFee
        };

        // Calculate booking fee if needed (for future payment processing)
        let bookingFee = 0;
        if (paymentMethod === 'booking-fee') {
            bookingFee = 50; // Default booking fee (can be configured later)
        }

        res.json({
            success: true,
            message: 'Booking created successfully',
            data: {
                bookingId: appointment.id,
                bookingReference: appointment.id.substring(0, 8).toUpperCase(),
                appointment: {
                    id: appointment.id,
                    startTime: appointment.startTime,
                    endTime: appointment.endTime,
                    status: appointment.status,
                    service: {
                        id: service.id,
                        name_en: service.name_en,
                        name_ar: service.name_ar
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
        if (error.message.includes('required') || error.message.includes('Invalid')) {
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

        // Get or create customer
        let customer = await db.Customer.findOne({
            where: {
                tenantId,
                email: customerEmail
            }
        });

        if (!customer) {
            customer = await db.Customer.create({
                tenantId,
                name: customerName,
                email: customerEmail,
                phone: customerPhone
            });
        }

        // Calculate order total
        let subtotal = 0;
        const orderItems = [];

        for (const item of items) {
            const product = await db.Product.findOne({
                where: { id: item.productId, tenantId, isAvailable: true }
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: `Product ${item.productId} not found`
                });
            }

            const itemTotal = product.price * item.quantity;
            subtotal += itemTotal;

            orderItems.push({
                productId: product.id,
                productName: product.name_en,
                quantity: item.quantity,
                unitPrice: product.price,
                total: itemTotal
            });
        }

        // Calculate delivery fee
        const deliveryFee = deliveryMethod === 'express' ? 50 : (subtotal >= 200 ? 0 : 25);
        const tax = subtotal * 0.15; // 15% VAT
        const total = subtotal + tax + deliveryFee;

        // Generate order number
        const orderNumber = await db.Order.generateOrderNumber();

        // Create order using Order model
        // For public orders, we need to create or find a guest user
        // First, try to find existing user by email
        let guestUser = await db.PlatformUser.findOne({
            where: {
                email: customerEmail
            }
        });

        if (!guestUser) {
            // Create a guest user for public orders
            // Split name into first and last
            const nameParts = customerName.trim().split(' ');
            const firstName = nameParts[0] || customerName;
            const lastName = nameParts.slice(1).join(' ') || firstName;
            
            guestUser = await db.PlatformUser.create({
                email: customerEmail,
                phone: customerPhone,
                firstName: firstName,
                lastName: lastName,
                emailVerified: false,
                phoneVerified: false,
                // Generate a random password for guest users
                password: require('crypto').randomBytes(32).toString('hex')
            });
        }

        // Prepare shipping address as JSONB
        // shippingAddress can be a string (from frontend) or we use individual fields
        const shippingAddressData = shippingAddress || (city && district) ? {
            street: street || (typeof shippingAddress === 'string' ? shippingAddress.split(',')[0] : '') || '',
            city: city || '',
            district: district || '',
            building: building || '',
            floor: floor || '',
            apartment: apartment || '',
            phone: customerPhone,
            notes: notes || ''
        } : null;

        // Create the order
        const order = await db.Order.create({
            orderNumber,
            platformUserId: guestUser.id,
            tenantId,
            status: paymentMethod === 'cash-on-delivery' ? 'pending' : 'confirmed',
            paymentMethod: paymentMethod === 'online' ? 'online' : 'cash_on_delivery',
            paymentStatus: paymentMethod === 'online' ? 'paid' : 'pending',
            deliveryType: shippingAddress ? 'delivery' : 'pickup',
            shippingAddress: shippingAddressData,
            subtotal: subtotal,
            taxAmount: tax,
            shippingFee: deliveryFee,
            platformFee: 0, // No platform fee for now
            totalAmount: total,
            notes: null
        });

        // Create order items
        for (const item of orderItems) {
            await db.OrderItem.create({
                orderId: order.id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.total
            });
        }

        res.json({
            success: true,
            message: 'Order created successfully',
            data: {
                orderId: order.id,
                orderReference: order.orderNumber,
                total,
                items: orderItems
            }
        });
    } catch (error) {
        console.error('Create public order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create order',
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
