'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PublicPageData extends Model {
        static associate(models) {
            PublicPageData.belongsTo(models.Tenant, {
                foreignKey: 'tenantId',
                as: 'tenant'
            });
        }
    }
    PublicPageData.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        tenantId: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true,
            references: {
                model: 'tenants',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        // About Us Section
        aboutUs_heroImage: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'Hero section banner image (recommended: 1920x600px)'
        },
        aboutUs_storyTitle: {
            type: DataTypes.STRING(100),
            defaultValue: 'ourStory',
            comment: 'Title for story section: ourStory, aboutUs, whoWeAre, ourJourney'
        },
        aboutUs_storyEn: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Our story in English'
        },
        aboutUs_storyAr: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Our story in Arabic'
        },
        aboutUs_missions: {
            type: DataTypes.JSONB,
            defaultValue: [],
            comment: 'Array of mission objects with bilingual content, icon/image support'
        },
        aboutUs_visions: {
            type: DataTypes.JSONB,
            defaultValue: [],
            comment: 'Array of vision objects with bilingual content, icon/image support'
        },
        aboutUs_values: {
            type: DataTypes.JSONB,
            defaultValue: [],
            comment: 'Array of value objects with bilingual content, icon/image support'
        },
        aboutUs_facilitiesDescriptionEn: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Facilities description in English'
        },
        aboutUs_facilitiesDescriptionAr: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Facilities description in Arabic'
        },
        aboutUs_facilitiesImages: {
            type: DataTypes.JSONB,
            defaultValue: [],
            comment: 'Array of facility image URLs (up to 10 images, FHD landscape)'
        },
        aboutUs_finalWordTitleEn: {
            type: DataTypes.STRING(200),
            allowNull: true,
            comment: 'Final word title in English'
        },
        aboutUs_finalWordTitleAr: {
            type: DataTypes.STRING(200),
            allowNull: true,
            comment: 'Final word title in Arabic'
        },
        aboutUs_finalWordTextEn: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Final word text in English'
        },
        aboutUs_finalWordTextAr: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Final word text in Arabic'
        },
        aboutUs_finalWordType: {
            type: DataTypes.STRING(20),
            defaultValue: 'image',
            comment: 'Final word display type: image or icon'
        },
        aboutUs_finalWordImageUrl: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'Final word image URL'
        },
        aboutUs_finalWordIconName: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: 'Final word icon name (Heroicons)'
        },
        // Hero Sliders
        heroSliders: {
            type: DataTypes.JSONB,
            defaultValue: [],
            comment: 'Array of hero slider objects with background image, text content, CTA buttons, and alignment settings'
        },
        // Home Page Section (for future use)
        homePage_data: {
            type: DataTypes.JSONB,
            defaultValue: {},
            comment: 'Home page data'
        },
        // Contact Us Section (for future use)
        contactUs_data: {
            type: DataTypes.JSONB,
            defaultValue: {},
            comment: 'Contact us page data'
        },
        // Page Banners
        pageBanner_services: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'Banner image for Services page (recommended: 1920x400px)'
        },
        pageBanner_products: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'Banner image for Products page (recommended: 1920x400px)'
        },
        pageBanner_about: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'Banner image for About Us page (recommended: 1920x400px)'
        },
        pageBanner_contact: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'Banner image for Contact page (recommended: 1920x400px)'
        },
        // General Settings
        generalSettings: {
            type: DataTypes.JSONB,
            defaultValue: {},
            comment: 'General public page settings'
        }
    }, {
        sequelize,
        modelName: 'PublicPageData',
        tableName: 'public_page_data',
        schema: 'public',
        timestamps: true,
        indexes: [
            { fields: ['tenantId'] }
        ]
    });
    return PublicPageData;
};

