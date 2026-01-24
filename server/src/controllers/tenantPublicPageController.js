/**
 * Tenant Public Page Controller
 * Handles public-facing website content management
 */

const db = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for public page image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = '';
        
        // Determine upload path based on field name
        if (file.fieldname === 'publicPageLogo') {
            uploadPath = path.join(__dirname, '../../uploads/tenants/public-page/logo');
        } else if (file.fieldname === 'heroImage') {
            uploadPath = path.join(__dirname, '../../uploads/tenants/public-page/hero');
        } else if (file.fieldname === 'backgroundImage') {
            uploadPath = path.join(__dirname, '../../uploads/tenants/public-page/hero-slider');
        } else if (file.fieldname === 'facilitiesImages') {
            uploadPath = path.join(__dirname, '../../uploads/tenants/public-page/facilities');
        } else if (file.fieldname === 'finalWordImage') {
            uploadPath = path.join(__dirname, '../../uploads/tenants/public-page/final-word');
        } else if (file.fieldname === 'servicesBanner' || file.fieldname === 'productsBanner' || file.fieldname === 'aboutBanner' || file.fieldname === 'contactBanner') {
            uploadPath = path.join(__dirname, '../../uploads/tenants/public-page/page-banners');
        } else if (file.fieldname.startsWith('missionImage') || file.fieldname.startsWith('visionImage') || file.fieldname.startsWith('valueImage')) {
            uploadPath = path.join(__dirname, '../../uploads/tenants/public-page/mission-vision-values');
        } else {
            uploadPath = path.join(__dirname, '../../uploads/tenants/public-page/misc');
        }

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
    fileFilter: fileFilter
});

// Middleware for handling public page file uploads
// Using upload.any() to accept dynamic field names for mission/vision/value images
exports.uploadMiddleware = upload.any();

/**
 * Get public page data for tenant
 */
exports.getPublicPageData = async (req, res) => {
    try {
        const tenantId = req.tenantId;

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
                generalSettings: {}
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
                homePage: pageData.homePage_data || {},
                contactUs: pageData.contactUs_data || {},
                generalSettings: pageData.generalSettings || {}
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
 * Update public page data
 */
exports.updatePublicPageData = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;

        // Get or create page data
        let pageData = await db.PublicPageData.findOne({
            where: { tenantId },
            transaction
        });

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
                generalSettings: {}
            }, { transaction });
        }

        // Get all files once at the beginning
        const allFiles = Array.isArray(req.files) ? req.files : [];
        
        // Handle hero image
        const heroImageFile = allFiles.find(f => f.fieldname === 'heroImage');
        if (heroImageFile) {
            // Delete old image if exists
            if (pageData.aboutUs_heroImage) {
                const oldImagePath = path.join(__dirname, '../../uploads', pageData.aboutUs_heroImage);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            const heroImagePath = heroImageFile.path.replace(/\\/g, '/').split('uploads/')[1];
            pageData.aboutUs_heroImage = heroImagePath;
        } else if (req.body.existingHeroImage) {
            pageData.aboutUs_heroImage = req.body.existingHeroImage;
        }

        // Handle story
        if (req.body.storyTitle !== undefined) pageData.aboutUs_storyTitle = req.body.storyTitle;
        if (req.body.storyEn !== undefined) pageData.aboutUs_storyEn = req.body.storyEn;
        if (req.body.storyAr !== undefined) pageData.aboutUs_storyAr = req.body.storyAr;

        // Handle missions, visions, values
        if (req.body.missions) {
            let missions = typeof req.body.missions === 'string' ? JSON.parse(req.body.missions) : req.body.missions;
            // Process image files for missions
            missions = await processItemImages(missions, allFiles, 'missionImage_', transaction);
            pageData.aboutUs_missions = missions;
        }

        if (req.body.visions) {
            let visions = typeof req.body.visions === 'string' ? JSON.parse(req.body.visions) : req.body.visions;
            visions = await processItemImages(visions, allFiles, 'visionImage_', transaction);
            pageData.aboutUs_visions = visions;
        }

        if (req.body.values) {
            let values = typeof req.body.values === 'string' ? JSON.parse(req.body.values) : req.body.values;
            values = await processItemImages(values, allFiles, 'valueImage_', transaction);
            pageData.aboutUs_values = values;
        }

        // Handle facilities
        if (req.body.facilitiesDescriptionEn !== undefined) pageData.aboutUs_facilitiesDescriptionEn = req.body.facilitiesDescriptionEn;
        if (req.body.facilitiesDescriptionAr !== undefined) pageData.aboutUs_facilitiesDescriptionAr = req.body.facilitiesDescriptionAr;
        
        // Handle facilities images
        const facilitiesImageFiles = allFiles.filter(f => f.fieldname === 'facilitiesImages') || [];
        if (facilitiesImageFiles.length > 0) {
            const existingImages = req.body.existingFacilitiesImages ? 
                (typeof req.body.existingFacilitiesImages === 'string' ? JSON.parse(req.body.existingFacilitiesImages) : req.body.existingFacilitiesImages) : 
                [];
            const newImagePaths = facilitiesImageFiles.map(file => file.path.replace(/\\/g, '/').split('uploads/')[1]);
            pageData.aboutUs_facilitiesImages = [...existingImages, ...newImagePaths].slice(0, 10); // Max 10 images
        } else if (req.body.existingFacilitiesImages) {
            const existingImages = typeof req.body.existingFacilitiesImages === 'string' ? 
                JSON.parse(req.body.existingFacilitiesImages) : req.body.existingFacilitiesImages;
            pageData.aboutUs_facilitiesImages = existingImages;
        }

        // Handle final word
        if (req.body.finalWordTitleEn !== undefined) pageData.aboutUs_finalWordTitleEn = req.body.finalWordTitleEn;
        if (req.body.finalWordTitleAr !== undefined) pageData.aboutUs_finalWordTitleAr = req.body.finalWordTitleAr;
        if (req.body.finalWordTextEn !== undefined) pageData.aboutUs_finalWordTextEn = req.body.finalWordTextEn;
        if (req.body.finalWordTextAr !== undefined) pageData.aboutUs_finalWordTextAr = req.body.finalWordTextAr;
        if (req.body.finalWordType !== undefined) pageData.aboutUs_finalWordType = req.body.finalWordType;
        if (req.body.finalWordIconName !== undefined) pageData.aboutUs_finalWordIconName = req.body.finalWordIconName;

        // Handle hero sliders (for delete operations)
        if (req.body.heroSliders !== undefined) {
            let heroSliders = typeof req.body.heroSliders === 'string' ? JSON.parse(req.body.heroSliders) : req.body.heroSliders;
            pageData.heroSliders = heroSliders;
        }

        // Handle public page logo upload
        const publicPageLogoFile = allFiles.find(f => f.fieldname === 'publicPageLogo');
        if (publicPageLogoFile) {
            // Delete old logo if exists
            const currentGeneralSettings = pageData.generalSettings || {};
            if (currentGeneralSettings.logo) {
                const oldLogoPath = path.join(__dirname, '../../uploads', currentGeneralSettings.logo);
                if (fs.existsSync(oldLogoPath)) {
                    fs.unlinkSync(oldLogoPath);
                }
            }
            const logoPath = publicPageLogoFile.path.replace(/\\/g, '/').split('uploads/')[1];
            // Update generalSettings with logo
            const currentSettings = pageData.generalSettings || {};
            currentSettings.logo = logoPath;
            pageData.generalSettings = currentSettings;
        } else if (req.body.existingPublicPageLogo) {
            // Keep existing logo if provided
            const currentSettings = pageData.generalSettings || {};
            currentSettings.logo = req.body.existingPublicPageLogo;
            pageData.generalSettings = currentSettings;
        }

        // Handle generalSettings (template, theme colors, section visibility)
        if (req.body.generalSettings !== undefined) {
            let generalSettingsData = typeof req.body.generalSettings === 'string' 
                ? JSON.parse(req.body.generalSettings) 
                : req.body.generalSettings;
            
            // Merge with existing generalSettings to preserve logo if it exists
            const currentSettings = pageData.generalSettings || {};
            pageData.generalSettings = {
                ...currentSettings,
                ...generalSettingsData,
                // Preserve logo if it exists and wasn't explicitly removed
                logo: generalSettingsData.logo !== undefined ? generalSettingsData.logo : currentSettings.logo
            };
        }

        // Handle page banners - using dedicated columns (following aboutUs_heroImage pattern)
        
        // Handle services banner
        const servicesBannerFile = allFiles.find(f => f.fieldname === 'servicesBanner');
        if (servicesBannerFile) {
            // Delete old banner if exists
            if (pageData.pageBanner_services) {
                const oldBannerPath = path.join(__dirname, '../../uploads', pageData.pageBanner_services);
                if (fs.existsSync(oldBannerPath)) {
                    fs.unlinkSync(oldBannerPath);
                }
            }
            const bannerPath = servicesBannerFile.path.replace(/\\/g, '/').split('uploads/')[1];
            pageData.pageBanner_services = bannerPath;
        } else if (req.body.existingServicesBanner) {
            pageData.pageBanner_services = req.body.existingServicesBanner;
        } else if (req.body.pageBanners && !servicesBannerFile) {
            // Only process JSON if no file was uploaded (file upload takes priority)
            const pageBannersData = typeof req.body.pageBanners === 'string' ? JSON.parse(req.body.pageBanners) : req.body.pageBanners;
            if (pageBannersData.services !== undefined) {
                // Handle removal (null value)
                if (pageBannersData.services === null && pageData.pageBanner_services) {
                    const oldBannerPath = path.join(__dirname, '../../uploads', pageData.pageBanner_services);
                    if (fs.existsSync(oldBannerPath)) {
                        fs.unlinkSync(oldBannerPath);
                    }
                }
                pageData.pageBanner_services = pageBannersData.services || null;
            }
        }

        // Handle products banner
        const productsBannerFile = allFiles.find(f => f.fieldname === 'productsBanner');
        if (productsBannerFile) {
            if (pageData.pageBanner_products) {
                const oldBannerPath = path.join(__dirname, '../../uploads', pageData.pageBanner_products);
                if (fs.existsSync(oldBannerPath)) {
                    fs.unlinkSync(oldBannerPath);
                }
            }
            const bannerPath = productsBannerFile.path.replace(/\\/g, '/').split('uploads/')[1];
            pageData.pageBanner_products = bannerPath;
        } else if (req.body.existingProductsBanner) {
            pageData.pageBanner_products = req.body.existingProductsBanner;
        } else if (req.body.pageBanners && !productsBannerFile) {
            // Only process JSON if no file was uploaded (file upload takes priority)
            const pageBannersData = typeof req.body.pageBanners === 'string' ? JSON.parse(req.body.pageBanners) : req.body.pageBanners;
            if (pageBannersData.products !== undefined) {
                if (pageBannersData.products === null && pageData.pageBanner_products) {
                    const oldBannerPath = path.join(__dirname, '../../uploads', pageData.pageBanner_products);
                    if (fs.existsSync(oldBannerPath)) {
                        fs.unlinkSync(oldBannerPath);
                    }
                }
                pageData.pageBanner_products = pageBannersData.products || null;
            }
        }

        // Handle about banner
        const aboutBannerFile = allFiles.find(f => f.fieldname === 'aboutBanner');
        if (aboutBannerFile) {
            if (pageData.pageBanner_about) {
                const oldBannerPath = path.join(__dirname, '../../uploads', pageData.pageBanner_about);
                if (fs.existsSync(oldBannerPath)) {
                    fs.unlinkSync(oldBannerPath);
                }
            }
            const bannerPath = aboutBannerFile.path.replace(/\\/g, '/').split('uploads/')[1];
            pageData.pageBanner_about = bannerPath;
        } else if (req.body.existingAboutBanner) {
            pageData.pageBanner_about = req.body.existingAboutBanner;
        } else if (req.body.pageBanners && !aboutBannerFile) {
            // Only process JSON if no file was uploaded (file upload takes priority)
            const pageBannersData = typeof req.body.pageBanners === 'string' ? JSON.parse(req.body.pageBanners) : req.body.pageBanners;
            if (pageBannersData.about !== undefined) {
                if (pageBannersData.about === null && pageData.pageBanner_about) {
                    const oldBannerPath = path.join(__dirname, '../../uploads', pageData.pageBanner_about);
                    if (fs.existsSync(oldBannerPath)) {
                        fs.unlinkSync(oldBannerPath);
                    }
                }
                pageData.pageBanner_about = pageBannersData.about || null;
            }
        }

        // Handle contact banner
        const contactBannerFile = allFiles.find(f => f.fieldname === 'contactBanner');
        if (contactBannerFile) {
            if (pageData.pageBanner_contact) {
                const oldBannerPath = path.join(__dirname, '../../uploads', pageData.pageBanner_contact);
                if (fs.existsSync(oldBannerPath)) {
                    fs.unlinkSync(oldBannerPath);
                }
            }
            const bannerPath = contactBannerFile.path.replace(/\\/g, '/').split('uploads/')[1];
            pageData.pageBanner_contact = bannerPath;
        } else if (req.body.existingContactBanner) {
            pageData.pageBanner_contact = req.body.existingContactBanner;
        } else if (req.body.pageBanners && !contactBannerFile) {
            // Only process JSON if no file was uploaded (file upload takes priority)
            const pageBannersData = typeof req.body.pageBanners === 'string' ? JSON.parse(req.body.pageBanners) : req.body.pageBanners;
            if (pageBannersData.contact !== undefined) {
                if (pageBannersData.contact === null && pageData.pageBanner_contact) {
                    const oldBannerPath = path.join(__dirname, '../../uploads', pageData.pageBanner_contact);
                    if (fs.existsSync(oldBannerPath)) {
                        fs.unlinkSync(oldBannerPath);
                    }
                }
                pageData.pageBanner_contact = pageBannersData.contact || null;
            }
        }

        const finalWordImageFile = allFiles.find(f => f.fieldname === 'finalWordImage');
        if (finalWordImageFile) {
            // Delete old image if exists
            if (pageData.aboutUs_finalWordImageUrl) {
                const oldImagePath = path.join(__dirname, '../../uploads', pageData.aboutUs_finalWordImageUrl);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            const finalWordImagePath = finalWordImageFile.path.replace(/\\/g, '/').split('uploads/')[1];
            pageData.aboutUs_finalWordImageUrl = finalWordImagePath;
        } else if (req.body.existingFinalWordImage) {
            pageData.aboutUs_finalWordImageUrl = req.body.existingFinalWordImage;
        }

        await pageData.save({ transaction });
        await transaction.commit();

        res.json({
            success: true,
            message: 'Public page data updated successfully',
            data: pageData
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Update public page data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update public page data',
            error: error.message
        });
    }
};

/**
 * Update hero slider (add or edit)
 */
exports.updateHeroSlider = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tenantId = req.tenantId;

        // Get or create page data
        let pageData = await db.PublicPageData.findOne({
            where: { tenantId },
            transaction
        });

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
                generalSettings: {}
            }, { transaction });
        }

        const allFiles = Array.isArray(req.files) ? req.files : [];
        const backgroundImageFile = allFiles.find(f => f.fieldname === 'backgroundImage');
        
        let heroSliders = pageData.heroSliders || [];
        const sliderId = req.body.sliderId;
        const isEditing = sliderId && heroSliders.find((s) => s.id === sliderId);

        const sliderData = {
            id: sliderId || Date.now().toString(),
            taglineEn: req.body.taglineEn || '',
            taglineAr: req.body.taglineAr || '',
            heroTitleEn: req.body.heroTitleEn || '',
            heroTitleAr: req.body.heroTitleAr || '',
            heroTitleColor: req.body.heroTitleColor || '#FFFFFF',
            subtitleEn: req.body.subtitleEn || '',
            subtitleAr: req.body.subtitleAr || '',
            subtitleColor: req.body.subtitleColor || '#FFFFFF',
            ctaButtonTextEn: req.body.ctaButtonTextEn || '',
            ctaButtonTextAr: req.body.ctaButtonTextAr || '',
            ctaButtonType: req.body.ctaButtonType || '',
            ctaButtonItemId: req.body.ctaButtonItemId || '',
            textAlignment: req.body.textAlignment || 'center',
            order: parseInt(req.body.order) || heroSliders.length
        };

        // Handle background image
        if (backgroundImageFile) {
            // Delete old image if editing
            if (isEditing) {
                const oldSlider = heroSliders.find((s) => s.id === sliderId);
                if (oldSlider?.backgroundImage) {
                    const oldImagePath = path.join(__dirname, '../../uploads', oldSlider.backgroundImage);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                    }
                }
            }
            const imagePath = backgroundImageFile.path.replace(/\\/g, '/').split('uploads/')[1];
            sliderData.backgroundImage = imagePath;
        } else if (req.body.existingBackgroundImage) {
            sliderData.backgroundImage = req.body.existingBackgroundImage;
        } else if (isEditing) {
            // Keep existing image
            const oldSlider = heroSliders.find((s) => s.id === sliderId);
            sliderData.backgroundImage = oldSlider?.backgroundImage || null;
        } else {
            sliderData.backgroundImage = null;
        }

        // Add or update slider
        if (isEditing) {
            heroSliders = heroSliders.map((s) => s.id === sliderId ? sliderData : s);
        } else {
            heroSliders.push(sliderData);
        }

        console.log('Hero sliders before save:', JSON.stringify(heroSliders, null, 2));
        console.log('Hero sliders type:', typeof heroSliders, Array.isArray(heroSliders));
        
        // Ensure heroSliders is a proper array
        if (!Array.isArray(heroSliders)) {
            heroSliders = [];
        }
        
        // Update heroSliders directly (same pattern as aboutUs_facilitiesImages which works)
        // Direct assignment works for JSONB fields in Sequelize
        pageData.heroSliders = heroSliders;
        
        console.log('PageData heroSliders set to:', JSON.stringify(pageData.heroSliders, null, 2));
        console.log('PageData changed fields:', pageData.changed());
        console.log('Is heroSliders in changed?', pageData.changed('heroSliders'));
        
        // If Sequelize doesn't detect the change, use raw SQL update
        if (!pageData.changed('heroSliders')) {
            console.log('HeroSliders not detected as changed, using raw SQL update...');
            // Use raw SQL to update JSONB field
            const heroSlidersJson = JSON.stringify(heroSliders);
            await db.sequelize.query(
                `UPDATE "public_page_data" SET "heroSliders" = :heroSliders::jsonb WHERE "id" = :id`,
                {
                    replacements: { 
                        heroSliders: heroSlidersJson,
                        id: pageData.id
                    },
                    transaction
                }
            );
            // Update the instance to reflect the change
            pageData.heroSliders = heroSliders;
        } else {
            // Save the pageData - same as facilitiesImages
            await pageData.save({ transaction });
        }
        
        console.log('After save, before commit - heroSliders:', JSON.stringify(pageData.heroSliders, null, 2));
        
        await transaction.commit();
        
        console.log('Transaction committed successfully');

        // Reload the pageData AFTER transaction commit to get fresh data
        await pageData.reload();

        console.log('Hero sliders after save and reload:', JSON.stringify(pageData.heroSliders, null, 2));
        console.log('Hero sliders count:', pageData.heroSliders ? pageData.heroSliders.length : 0);
        
        // Also fetch fresh from database to verify it's actually saved
        const freshPageData = await db.PublicPageData.findOne({
            where: { tenantId }
        });
        console.log('Fresh hero sliders from DB query:', JSON.stringify(freshPageData?.heroSliders, null, 2));
        console.log('Fresh hero sliders count:', freshPageData?.heroSliders ? freshPageData.heroSliders.length : 0);

        res.json({
            success: true,
            message: isEditing ? 'Hero slider updated successfully' : 'Hero slider added successfully',
            data: sliderData,
            heroSliders: freshPageData?.heroSliders || pageData.heroSliders || [] // Use fresh data from DB
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Update public page data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update public page data',
            error: error.message
        });
    }
};

/**
 * Helper function to process images for missions, visions, and values
 */
async function processItemImages(items, files, prefix, transaction) {
    const processedItems = [];
    
    for (const item of items) {
        const processedItem = { ...item };
        
        // Find matching image file for this item
        const imageFile = files.find(f => f.fieldname === `${prefix}${item.id}`);
        
        if (item.type === 'image' && imageFile) {
            // Delete old image if exists
            if (item.imageUrl && !item.imageUrl.startsWith('data:') && !item.imageUrl.startsWith('http')) {
                const oldImagePath = path.join(__dirname, '../../uploads', item.imageUrl);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            // Save new image
            const imagePath = imageFile.path.replace(/\\/g, '/').split('uploads/')[1];
            processedItem.imageUrl = imagePath;
        } else if (item.type === 'image' && item.imageUrl && item.imageUrl.startsWith('data:')) {
            // This is a base64 preview from frontend, but no file was uploaded
            // Keep existing imageUrl if it's a valid path, otherwise remove it
            if (!item.imageUrl.startsWith('http') && !item.imageUrl.startsWith('/uploads')) {
                // Remove base64 preview if no actual file
                delete processedItem.imageUrl;
            }
        } else if (item.type === 'image' && item.imageUrl && !item.imageUrl.startsWith('data:')) {
            // Keep existing image URL (already saved)
            processedItem.imageUrl = item.imageUrl;
        }
        
        // Remove imageFile reference (not needed in database)
        delete processedItem.imageFile;
        processedItems.push(processedItem);
    }
    
    return processedItems;
}

