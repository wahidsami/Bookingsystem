'use strict';

const { ensureIdempotentColumnChanges } = require('../utils/migration-utils');

module.exports = {
  async up(queryInterface, Sequelize) {
    ensureIdempotentColumnChanges(queryInterface);

    await queryInterface.addColumn('tenants', 'address', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'buildingNumber', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'businessType', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: ['salon']
    });

    await queryInterface.addColumn('tenants', 'contactPersonEmail', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'coordinates', {
      type: Sequelize.JSONB,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'country', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'Saudi Arabia'
    });

    await queryInterface.addColumn('tenants', 'coverImage', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'crDocument', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'crNumber', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'description', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'descriptionAr', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'district', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'facebookUrl', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'googleMapLink', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'instagramUrl', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'lastLogin', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'layoutTemplate', {
      type: Sequelize.ENUM('default', 'modern', 'classic', 'elegant'),
      allowNull: false,
      defaultValue: 'default'
    });

    await queryInterface.addColumn('tenants', 'licenseDocument', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'licenseNumber', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'linkedinUrl', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'logo', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'mobile', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'nameAr', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'name_ar', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'name_en', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'password', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'phone', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'pinterestUrl', {
      type: Sequelize.STRING(500),
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'postalCode', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'settings', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {
        currency: 'SAR',
        timezone: 'Asia/Riyadh',
        language: 'ar',
        bookingBuffer: 15,
        maxAdvanceBooking: 30,
        cancellationPolicy: 24,
        autoConfirmBookings: false,
        requireDeposit: false,
        depositPercentage: 0
      }
    });

    await queryInterface.addColumn('tenants', 'snapchatUrl', {
      type: Sequelize.STRING(500),
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'stats', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {
        totalBookings: 0,
        totalRevenue: 0,
        totalCustomers: 0,
        averageRating: 0,
        totalReviews: 0
      }
    });

    await queryInterface.addColumn('tenants', 'street', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'taxDocument', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'taxNumber', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'themeColors', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {
        primary: '#7C3AED',
        secondary: '#EC4899'
      }
    });

    await queryInterface.addColumn('tenants', 'tiktokUrl', {
      type: Sequelize.STRING(500),
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'twitterUrl', {
      type: Sequelize.STRING(500),
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'website', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'whatsapp', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('tenants', 'workingHours', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {
        sunday: { open: '09:00', close: '21:00', isOpen: true },
        monday: { open: '09:00', close: '21:00', isOpen: true },
        tuesday: { open: '09:00', close: '21:00', isOpen: true },
        wednesday: { open: '09:00', close: '21:00', isOpen: true },
        thursday: { open: '09:00', close: '21:00', isOpen: true },
        friday: { open: '14:00', close: '21:00', isOpen: true },
        saturday: { open: '09:00', close: '21:00', isOpen: true }
      }
    });

    await queryInterface.addColumn('tenants', 'youtubeUrl', {
      type: Sequelize.STRING(500),
      allowNull: true
    });
  },

  async down() {}
};
