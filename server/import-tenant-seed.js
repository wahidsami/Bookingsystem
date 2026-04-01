#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Op } = require('sequelize');

const DEFAULT_SEED_DIR_CANDIDATES = [
    path.resolve(__dirname, '..', 'seeds', 'Kamy Salon'),
    path.resolve(__dirname, 'seeds', 'Kamy Salon')
];

function parseArgs(argv) {
    const args = {
        seedDir: null,
        tenantSlug: null,
        tenantName: null,
        createStaffUsers: false,
        dryRun: false,
        help: false
    };

    for (let i = 0; i < argv.length; i += 1) {
        const current = argv[i];
        const next = argv[i + 1];

        switch (current) {
            case '--seed-dir':
                args.seedDir = next ? path.resolve(next) : args.seedDir;
                i += 1;
                break;
            case '--tenant-slug':
                args.tenantSlug = next || null;
                i += 1;
                break;
            case '--tenant-name':
                args.tenantName = next || null;
                i += 1;
                break;
            case '--create-staff-users':
                args.createStaffUsers = true;
                break;
            case '--dry-run':
                args.dryRun = true;
                break;
            case '--help':
            case '-h':
                args.help = true;
                break;
            default:
                break;
        }
    }

    return args;
}

function printUsage() {
    console.log(`
Tenant seed importer

Usage:
  node import-tenant-seed.js --tenant-slug <slug> [options]
  node import-tenant-seed.js --tenant-name "<name>" [options]

Options:
  --seed-dir <path>           Seed directory. Defaults to auto-detecting seeds/Kamy Salon
  --tenant-slug <slug>        Find tenant by exact slug
  --tenant-name "<name>"      Find tenant by business name
  --create-staff-users        Create staff auth accounts from employee emails
  --dry-run                   Validate and show planned work without saving
  --help, -h                  Show this help

Examples:
  node import-tenant-seed.js --tenant-slug kamy-salon
  node import-tenant-seed.js --tenant-name "Kamy Salon" --dry-run
  node import-tenant-seed.js --tenant-slug kamy-salon --create-staff-users
`);
}

function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function directoryHasSeedFiles(seedDir) {
    const requiredFiles = [
        'employees.json',
        'services.json',
        'products.json',
        'hotDeals.json',
        'shifts.json'
    ];

    return requiredFiles.every((file) => fs.existsSync(path.join(seedDir, file)));
}

function resolveSeedDir(seedDir) {
    if (seedDir && directoryHasSeedFiles(seedDir)) {
        return seedDir;
    }

    for (const candidate of DEFAULT_SEED_DIR_CANDIDATES) {
        if (directoryHasSeedFiles(candidate)) {
            return candidate;
        }
    }

    return seedDir || DEFAULT_SEED_DIR_CANDIDATES[0];
}

function loadSeedData(seedDir) {
    const resolvedSeedDir = resolveSeedDir(seedDir);
    const files = {
        employees: path.join(resolvedSeedDir, 'employees.json'),
        services: path.join(resolvedSeedDir, 'services.json'),
        products: path.join(resolvedSeedDir, 'products.json'),
        hotDeals: path.join(resolvedSeedDir, 'hotDeals.json'),
        shifts: path.join(resolvedSeedDir, 'shifts.json')
    };

    for (const filePath of Object.values(files)) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Missing required seed file: ${filePath}`);
        }
    }

    return {
        seedDir: resolvedSeedDir,
        employees: readJsonFile(files.employees),
        services: readJsonFile(files.services),
        products: readJsonFile(files.products),
        hotDeals: readJsonFile(files.hotDeals),
        shifts: readJsonFile(files.shifts)
    };
}

function normalizeEmail(value) {
    return value ? String(value).trim().toLowerCase() : null;
}

function generateTemporaryStaffPassword() {
    return `Rifah!${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function calculateFinalPrice(rawPrice, taxRate, commissionRate) {
    const raw = parseFloat(rawPrice || 0);
    const tax = raw * (parseFloat(taxRate || 15) / 100);
    const commission = raw * (parseFloat(commissionRate || 10) / 100);
    return parseFloat((raw + tax + commission).toFixed(2));
}

async function getGlobalRates(db) {
    const settings = await db.GlobalSettings.findOne({
        order: [['updatedAt', 'DESC']]
    });

    if (!settings) {
        return {
            taxRate: 15,
            serviceCommissionRate: 10,
            productCommissionRate: 10
        };
    }

    return {
        taxRate: parseFloat(settings.taxRate || 15),
        serviceCommissionRate: parseFloat(settings.serviceCommissionRate || 10),
        productCommissionRate: parseFloat(settings.productCommissionRate || 10)
    };
}

async function findTenant(db, { tenantSlug, tenantName }) {
    if (tenantSlug) {
        return db.Tenant.findOne({ where: { slug: tenantSlug } });
    }

    if (!tenantName) {
        throw new Error('Either --tenant-slug or --tenant-name is required');
    }

    return db.Tenant.findOne({
        where: {
            [Op.or]: [
                { name: { [Op.iLike]: tenantName } },
                { name_en: { [Op.iLike]: tenantName } },
                { name_ar: { [Op.iLike]: tenantName } }
            ]
        }
    });
}

async function upsertEmployees(db, transaction, tenant, employees, options, summary) {
    const employeeMap = new Map();
    const createdStaffUsers = [];

    for (const employee of employees) {
        const normalizedEmail = normalizeEmail(employee.email);

        let existing = null;
        if (normalizedEmail) {
            existing = await db.Staff.findOne({
                where: {
                    tenantId: tenant.id,
                    email: normalizedEmail
                },
                transaction
            });
        }

        if (!existing) {
            existing = await db.Staff.findOne({
                where: {
                    tenantId: tenant.id,
                    name: employee.name,
                    phone: employee.phone || null
                },
                transaction
            });
        }

        const payload = {
            tenantId: tenant.id,
            name: employee.name,
            email: normalizedEmail,
            phone: employee.phone || null,
            nationality: employee.nationality || null,
            bio: employee.bio || null,
            experience: employee.experience || null,
            skills: Array.isArray(employee.skills) ? employee.skills : [],
            salary: parseFloat(employee.salary || 0),
            commissionRate: parseFloat(employee.commissionRate || 0),
            isActive: employee.isActive !== false
        };

        let staffRecord = existing;
        if (!staffRecord) {
            staffRecord = await db.Staff.create(payload, { transaction });
            summary.employees.created += 1;
        } else {
            await staffRecord.update(payload, { transaction });
            summary.employees.updated += 1;
        }

        employeeMap.set(normalizedEmail || `${employee.name}:${employee.phone || ''}`, staffRecord);

        if (options.createStaffUsers && normalizedEmail) {
            const existingUser = await db.User.findOne({
                where: {
                    email: normalizedEmail,
                    tenantId: tenant.id,
                    role: 'staff'
                },
                transaction
            });

            if (!existingUser) {
                const tempPassword = generateTemporaryStaffPassword();
                await db.User.create({
                    email: normalizedEmail,
                    password: tempPassword,
                    role: 'staff',
                    tenantId: tenant.id
                }, { transaction });

                createdStaffUsers.push({
                    name: employee.name,
                    email: normalizedEmail,
                    temporaryPassword: tempPassword
                });
                summary.staffUsers.created += 1;
            } else {
                summary.staffUsers.existing += 1;
            }
        }
    }

    return { employeeMap, createdStaffUsers };
}

async function upsertShifts(db, transaction, shifts, employeeMap, summary) {
    for (const record of shifts) {
        const employeeKey = normalizeEmail(record.employeeEmail);
        const employee = employeeMap.get(employeeKey);

        if (!employee) {
            summary.shifts.skipped += 1;
            console.warn(`Skipping shifts for ${record.employeeEmail}: employee not found in imported set`);
            continue;
        }

        for (const shift of record.weeklyShifts || []) {
            const where = shift.isRecurring !== false
                ? {
                    staffId: employee.id,
                    isRecurring: true,
                    dayOfWeek: shift.dayOfWeek,
                    label: shift.label || null
                }
                : {
                    staffId: employee.id,
                    isRecurring: false,
                    specificDate: shift.specificDate,
                    label: shift.label || null
                };

            const existing = await db.StaffShift.findOne({ where, transaction });
            const payload = {
                staffId: employee.id,
                dayOfWeek: shift.isRecurring !== false ? shift.dayOfWeek : null,
                specificDate: shift.isRecurring !== false ? null : shift.specificDate,
                startTime: shift.startTime,
                endTime: shift.endTime,
                isRecurring: shift.isRecurring !== false,
                startDate: shift.startDate || null,
                endDate: shift.endDate || null,
                label: shift.label || null,
                isActive: shift.isActive !== false
            };

            if (!existing) {
                await db.StaffShift.create(payload, { transaction });
                summary.shifts.created += 1;
            } else {
                await existing.update(payload, { transaction });
                summary.shifts.updated += 1;
            }
        }
    }
}

async function upsertServices(db, transaction, tenant, services, employeeMap, rates, summary) {
    const serviceMap = new Map();

    for (const service of services) {
        const existing = await db.Service.findOne({
            where: {
                tenantId: tenant.id,
                name_en: service.name_en
            },
            transaction
        });

        const payload = {
            tenantId: tenant.id,
            name_en: service.name_en,
            name_ar: service.name_ar,
            description_en: service.description_en || null,
            description_ar: service.description_ar || null,
            image: service.image || null,
            rawPrice: parseFloat(service.rawPrice || 0),
            taxRate: rates.taxRate,
            commissionRate: rates.serviceCommissionRate,
            finalPrice: calculateFinalPrice(service.rawPrice, rates.taxRate, rates.serviceCommissionRate),
            category: service.category || 'General',
            duration: parseInt(service.duration || 30, 10),
            includes: Array.isArray(service.includes) ? service.includes : [],
            benefits: Array.isArray(service.benefits) ? service.benefits : [],
            whatToExpect: Array.isArray(service.whatToExpect) ? service.whatToExpect : [],
            hasOffer: service.hasOffer === true,
            offerDetails: service.offerDetails || null,
            hasGift: service.hasGift === true,
            giftType: service.giftType || null,
            giftDetails: service.giftDetails || null,
            isActive: service.isActive !== false,
            availableInCenter: service.availableInCenter !== false,
            availableHomeVisit: service.availableHomeVisit === true
        };

        let serviceRecord = existing;
        if (!serviceRecord) {
            serviceRecord = await db.Service.create(payload, { transaction });
            summary.services.created += 1;
        } else {
            await serviceRecord.update(payload, { transaction });
            summary.services.updated += 1;
        }

        serviceMap.set(service.name_en, serviceRecord);

        const assignedStaff = (service.employeeEmails || [])
            .map((email) => employeeMap.get(normalizeEmail(email)))
            .filter(Boolean);

        await db.ServiceEmployee.destroy({
            where: { serviceId: serviceRecord.id },
            transaction
        });

        if (assignedStaff.length > 0) {
            await db.ServiceEmployee.bulkCreate(
                assignedStaff.map((staff, index) => ({
                    serviceId: serviceRecord.id,
                    staffId: staff.id,
                    isPrimary: index === 0,
                    commissionRate: null,
                    notes: null
                })),
                { transaction }
            );
            summary.serviceAssignments += assignedStaff.length;
        }
    }

    return serviceMap;
}

async function upsertProducts(db, transaction, tenant, products, rates, summary) {
    for (const product of products) {
        let existing = null;

        if (product.sku) {
            existing = await db.Product.findOne({
                where: {
                    tenantId: tenant.id,
                    sku: product.sku
                },
                transaction
            });
        }

        if (!existing) {
            existing = await db.Product.findOne({
                where: {
                    tenantId: tenant.id,
                    name_en: product.name_en
                },
                transaction
            });
        }

        const images = Array.isArray(product.images) ? product.images : [];
        const payload = {
            tenantId: tenant.id,
            name_en: product.name_en,
            name_ar: product.name_ar,
            description_en: product.description_en || null,
            description_ar: product.description_ar || null,
            image: product.image || images[0] || null,
            images,
            rawPrice: parseFloat(product.rawPrice || 0),
            taxRate: rates.taxRate,
            commissionRate: rates.productCommissionRate,
            price: calculateFinalPrice(product.rawPrice, rates.taxRate, rates.productCommissionRate),
            category: product.category || 'General',
            stock: parseInt(product.stock || 0, 10),
            sku: product.sku || null,
            brand: product.brand || null,
            size: product.size || null,
            color: product.color || null,
            ingredients: product.ingredients || null,
            ingredients_en: product.ingredients_en || null,
            ingredients_ar: product.ingredients_ar || null,
            howToUse_en: product.howToUse_en || null,
            howToUse_ar: product.howToUse_ar || null,
            features_en: product.features_en || null,
            features_ar: product.features_ar || null,
            isAvailable: product.isAvailable !== false,
            isFeatured: product.isFeatured === true
        };

        if (!existing) {
            await db.Product.create(payload, { transaction });
            summary.products.created += 1;
        } else {
            const mergedPayload = {
                ...payload,
                image: payload.image || existing.image || null,
                images: payload.images.length > 0 ? payload.images : (existing.images || [])
            };

            await existing.update(mergedPayload, { transaction });
            summary.products.updated += 1;
        }
    }
}

async function upsertHotDeals(db, transaction, tenant, hotDeals, serviceMap, summary) {
    const now = new Date();

    for (const deal of hotDeals) {
        const service = serviceMap.get(deal.linkedService);

        if (!service) {
            summary.hotDeals.skipped += 1;
            console.warn(`Skipping hot deal "${deal.title_en}": linked service not found (${deal.linkedService})`);
            continue;
        }

        const originalPrice = parseFloat(service.finalPrice || service.rawPrice || 0);
        let discountedPrice = originalPrice;

        if (deal.discountType === 'percentage') {
            discountedPrice = originalPrice - (originalPrice * (parseFloat(deal.discountValue) / 100));
        } else {
            discountedPrice = originalPrice - parseFloat(deal.discountValue);
        }

        discountedPrice = parseFloat(Math.max(0, discountedPrice).toFixed(2));
        const validFrom = new Date(deal.validFrom);
        const validUntil = new Date(deal.validUntil);
        const status = now >= validFrom && now <= validUntil ? 'active' : 'approved';

        const payload = {
            tenantId: tenant.id,
            serviceId: service.id,
            title_en: deal.title_en,
            title_ar: deal.title_ar,
            description_en: deal.description_en || null,
            description_ar: deal.description_ar || null,
            discountType: deal.discountType,
            discountValue: parseFloat(deal.discountValue),
            originalPrice,
            discountedPrice,
            validFrom,
            validUntil,
            maxRedemptions: parseInt(deal.maxRedemptions || -1, 10),
            status,
            isActive: true,
            approvedAt: new Date()
        };

        const existing = await db.HotDeal.findOne({
            where: {
                tenantId: tenant.id,
                serviceId: service.id,
                title_en: deal.title_en
            },
            transaction
        });

        if (!existing) {
            await db.HotDeal.create(payload, { transaction });
            summary.hotDeals.created += 1;
        } else {
            await existing.update(payload, { transaction });
            summary.hotDeals.updated += 1;
        }
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        printUsage();
        return;
    }

    if (!args.tenantSlug && !args.tenantName) {
        printUsage();
        throw new Error('Missing tenant target. Use --tenant-slug or --tenant-name.');
    }

    const seedData = loadSeedData(args.seedDir);
    const db = require('./src/models');

    const tenant = await findTenant(db, args);
    if (!tenant) {
        throw new Error(`Tenant not found for slug/name: ${args.tenantSlug || args.tenantName}`);
    }

    const rates = await getGlobalRates(db);
    const summary = {
        employees: { created: 0, updated: 0 },
        staffUsers: { created: 0, existing: 0 },
        shifts: { created: 0, updated: 0, skipped: 0 },
        services: { created: 0, updated: 0 },
        products: { created: 0, updated: 0 },
        hotDeals: { created: 0, updated: 0, skipped: 0 },
        serviceAssignments: 0
    };

    console.log(`\nImporting tenant seed data for: ${tenant.name_en || tenant.name || tenant.slug}`);
    console.log(`Seed directory: ${seedData.seedDir}`);
    console.log(`Dry run: ${args.dryRun ? 'yes' : 'no'}`);
    console.log(`Create staff users: ${args.createStaffUsers ? 'yes' : 'no'}\n`);

    const transaction = await db.sequelize.transaction();

    try {
        const { employeeMap, createdStaffUsers } = await upsertEmployees(
            db,
            transaction,
            tenant,
            seedData.employees,
            args,
            summary
        );

        await upsertShifts(db, transaction, seedData.shifts, employeeMap, summary);
        const serviceMap = await upsertServices(db, transaction, tenant, seedData.services, employeeMap, rates, summary);
        await upsertProducts(db, transaction, tenant, seedData.products, rates, summary);
        await upsertHotDeals(db, transaction, tenant, seedData.hotDeals, serviceMap, summary);

        if (args.dryRun) {
            await transaction.rollback();
            console.log('Dry run complete. No changes were saved.');
        } else {
            await transaction.commit();
            console.log('Import completed successfully.');
        }

        console.log('\nSummary:');
        console.log(`- Employees: ${summary.employees.created} created, ${summary.employees.updated} updated`);
        console.log(`- Staff users: ${summary.staffUsers.created} created, ${summary.staffUsers.existing} existing`);
        console.log(`- Shifts: ${summary.shifts.created} created, ${summary.shifts.updated} updated, ${summary.shifts.skipped} skipped`);
        console.log(`- Services: ${summary.services.created} created, ${summary.services.updated} updated`);
        console.log(`- Service assignments synced: ${summary.serviceAssignments}`);
        console.log(`- Products: ${summary.products.created} created, ${summary.products.updated} updated`);
        console.log(`- Hot deals: ${summary.hotDeals.created} created, ${summary.hotDeals.updated} updated, ${summary.hotDeals.skipped} skipped`);

        if (createdStaffUsers.length > 0) {
            console.log('\nCreated staff app credentials:');
            for (const user of createdStaffUsers) {
                console.log(`- ${user.name}: ${user.email} / ${user.temporaryPassword}`);
            }
        }

        console.log('\nNotes:');
        console.log('- Products created through this importer can exist without images so you can attach images later.');
        console.log('- Hot deals are imported directly with computed pricing to avoid the current controller price-field mismatch.');
    } catch (error) {
        await transaction.rollback();
        throw error;
    } finally {
        await db.sequelize.close();
    }
}

main().catch((error) => {
    console.error('\nImport failed:', error.message);
    if (process.env.NODE_ENV !== 'production') {
        console.error(error.stack);
    }
    process.exit(1);
});
