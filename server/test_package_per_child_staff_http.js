/**
 * Final HTTP Integration Gate — Authoritative Per-Child Staff Availability
 * 
 * Verifies end-to-end HTTP controller endpoints against real PostgreSQL DB (rifah_clean)
 * and real tenant ("Happiness Salon"):
 * 
 *   Task 1: POST /bookings/package-search
 *     - 1.A: Sequence Child A = Staff A, Child B = Staff B
 *     - 1.B: Sequence Child A = Staff A, Child B = unavailable staff -> excluded / 0 slots
 *     - 1.C: Parallel Child A = Staff A, Child B = Staff B -> concurrent slots returned
 *     - 1.D: Parallel Child A = Staff A, Child B = Staff A -> 0 feasible slots
 *     - 1.E: Parallel Child A = Any, Child B = Staff B -> auto-assigns distinct staff
 *     - 1.F: Parallel Child A = Any, Child B = Any -> assigns distinct staff
 * 
 *   Task 2: Explicit NULL Override
 *     - packageItem.defaultStaffId = Staff A, request explicitly sets child = null
 *     - Verifies Staff A is NOT forced.
 * 
 *   Task 3: Conflicting Inputs
 *     - Matching packageItems + staffAssignments -> succeeds (200)
 *     - Conflicting packageItems (Staff A) vs staffAssignments (Staff B) -> safe 400 CONFLICTING_STAFF_ASSIGNMENTS
 *     - Explicit null vs UUID -> safe 400 CONFLICTING_STAFF_ASSIGNMENTS
 * 
 *   Task 4: Evaluate HTTP Verification
 *     - Real startTime from package-search
 *     - Explicit Child A Staff A + Child B Staff B -> 200 valid
 *     - Mixed Any + explicit staff -> 200 valid
 *     - Same explicit staff on parallel children -> safe 409 PARALLEL_STAFF_CONFLICT
 * 
 *   Task 5: Create Contract
 *     - Validates payload acceptance with child-level staff without creating mutations
 * 
 *   Task 8: Duplicate serviceId child items in a package
 *     - packageItemId matching guarantees isolation
 */
process.env.NODE_ENV = 'development';
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const supertest = require('supertest');
const express = require('express');

// ---------- CONSTANTS ----------
const TENANT_ID  = 'b7189ce5-fee9-4449-b8f7-28b7e7275a81'; // Happiness Salon
const SEQ_PKG_ID = '77832435-f83a-41a4-a5b6-6f5990ec45be'; // P6D Sequential Spa (Moroccan 60m -> Thai 45m)
const PAR_PKG_ID = '3f043c7e-e80c-4c0d-b174-03b84c2d8a6f'; // P6D Parallel Duo   (Moroccan + Thai concurrent)

const SVC_MOROCCAN = '1be2f412-93c6-4014-8bf9-3d28c443a162';
const SVC_THAI     = '1c8e64fd-3cac-4e03-866a-6c2431630027';

const SEQ_ITEM_1 = '04808694-b7b3-4fe1-929d-eeba94dcc921'; // Moroccan in Seq
const SEQ_ITEM_2 = '0d343eea-c314-4731-9f80-ff7f0153830b'; // Thai in Seq

const PAR_ITEM_1 = '06840f2f-440c-4575-a6c1-6cb94ef35169'; // Moroccan in Par
const PAR_ITEM_2 = 'dbfe2616-f74a-402d-b83c-b8bdd183565f'; // Thai in Par

const STAFF_ALPHA = '63043c2f-7d14-4aa3-ad1e-04add785be14';
const STAFF_GAMMA = '927b4313-0e17-407c-8846-2279d8d82498';
const UNAVAILABLE_STAFF = '00000000-0000-0000-0000-000000000099';

// ---------- RESULTS TRACKING ----------
const results = [];
let passCount = 0;
let failCount = 0;

const log = (testName, pass, detail) => {
    const status = pass ? 'PASS' : 'FAIL';
    results.push({ test: testName, status, detail });
    if (pass) passCount++; else failCount++;
    console.log(`  [${status}] ${testName}${detail ? ' — ' + detail : ''}`);
};

const getFutureDate = (daysAhead = 4) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().slice(0, 10);
};

(async () => {
    let db, app, request, createdSEIds = [], createdScheduleIds = [];
    let originalDefaultStaff = null;

    try {
        db = require('./src/models');
        await db.sequelize.authenticate();
        console.log('✅ Database connected\n');

        // =========================================================
        // SETUP: ServiceEmployee & StaffSchedule fixtures for Alpha & Gamma
        // =========================================================
        console.log('--- Phase 0: Test Fixtures Setup ---');
        const seData = [
            { serviceId: SVC_MOROCCAN, staffId: STAFF_ALPHA },
            { serviceId: SVC_THAI,     staffId: STAFF_ALPHA },
            { serviceId: SVC_MOROCCAN, staffId: STAFF_GAMMA },
            { serviceId: SVC_THAI,     staffId: STAFF_GAMMA },
        ];

        for (const se of seData) {
            const existing = await db.ServiceEmployee.findOne({ where: se });
            if (!existing) {
                const created = await db.ServiceEmployee.create(se);
                createdSEIds.push(created.id);
            }
        }

        for (const staffId of [STAFF_ALPHA, STAFF_GAMMA]) {
            for (let day = 0; day <= 6; day++) {
                const existing = await db.StaffSchedule.findOne({ where: { staffId, dayOfWeek: day } });
                if (!existing) {
                    const created = await db.StaffSchedule.create({
                        staffId,
                        dayOfWeek: day,
                        startTime: '08:00',
                        endTime: '22:00',
                        isAvailable: true
                    });
                    createdScheduleIds.push(created.id);
                }
            }
        }
        console.log(`  Fixtures ready: ${createdSEIds.length} SE, ${createdScheduleIds.length} schedules\n`);

        // Setup Express app
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        const bookingRoutes = require('./src/routes/bookingRoutes');
        app.use('/api/v1/bookings', bookingRoutes);
        request = supertest(app);

        const testDate = getFutureDate(4);
        console.log(`Test Date: ${testDate}\n`);

        // =========================================================
        // TASK 1: PACKAGE SEARCH HTTP TESTS
        // =========================================================
        console.log('--- Task 1: Package Search HTTP Tests ---');

        // 1.A: Sequence Child A = Staff Alpha, Child B = Staff Gamma
        {
            const res = await request.post('/api/v1/bookings/package-search')
                .send({
                    tenantId: TENANT_ID,
                    packageId: SEQ_PKG_ID,
                    date: testDate,
                    packageItems: [
                        { packageItemId: SEQ_ITEM_1, staffId: STAFF_ALPHA },
                        { packageItemId: SEQ_ITEM_2, staffId: STAFF_GAMMA }
                    ],
                    staffAssignments: {
                        [SEQ_ITEM_1]: STAFF_ALPHA,
                        [SEQ_ITEM_2]: STAFF_GAMMA
                    }
                });

            log('1.A.1 status is 200', res.status === 200, `status=${res.status}`);
            log('1.A.2 success=true', res.body.success === true);
            log('1.A.3 returns feasible sequence slots', Array.isArray(res.body.slots) && res.body.slots.length > 0, `count=${res.body.slots?.length}`);
            if (res.body.slots && res.body.slots.length > 0) {
                const slot = res.body.slots[0];
                const steps = slot.steps || [];
                const step1Staff = steps[0]?.staffId;
                const step2Staff = steps[1]?.staffId;
                log('1.A.4 slot step 1 is Staff Alpha', step1Staff === STAFF_ALPHA, `step1Staff=${step1Staff}`);
                log('1.A.5 slot step 2 is Staff Gamma', step2Staff === STAFF_GAMMA, `step2Staff=${step2Staff}`);
            }
        }

        // 1.B: Sequence Child A = Staff Alpha, Child B = unavailable staff -> affected slots excluded (0 slots)
        {
            const res = await request.post('/api/v1/bookings/package-search')
                .send({
                    tenantId: TENANT_ID,
                    packageId: SEQ_PKG_ID,
                    date: testDate,
                    staffAssignments: {
                        [SEQ_ITEM_1]: STAFF_ALPHA,
                        [SEQ_ITEM_2]: UNAVAILABLE_STAFF
                    }
                });

            log('1.B.1 status is 200 (safe domain response)', res.status === 200, `status=${res.status}`);
            log('1.B.2 slots is empty array (0 slots due to unavailable staff)', Array.isArray(res.body.slots) && res.body.slots.length === 0, `slots=${res.body.slots?.length}`);
        }

        // 1.C: Parallel Child A = Staff Alpha, Child B = Staff Gamma -> valid concurrent slots returned
        {
            const res = await request.post('/api/v1/bookings/package-search')
                .send({
                    tenantId: TENANT_ID,
                    packageId: PAR_PKG_ID,
                    date: testDate,
                    packageItems: [
                        { packageItemId: PAR_ITEM_1, staffId: STAFF_ALPHA },
                        { packageItemId: PAR_ITEM_2, staffId: STAFF_GAMMA }
                    ]
                });

            log('1.C.1 status is 200', res.status === 200, `status=${res.status}`);
            log('1.C.2 returns concurrent slots', Array.isArray(res.body.slots) && res.body.slots.length > 0, `count=${res.body.slots?.length}`);
            if (res.body.slots && res.body.slots.length > 0) {
                const slot = res.body.slots[0];
                log('1.C.3 scheduleType is parallel', slot.scheduleType === 'parallel');
                const steps = slot.steps || [];
                log('1.C.4 both steps start at same time', steps.length >= 2 && steps[0].startTime === steps[1].startTime);
                const assignedStaff = steps.map(s => s.staffId).sort();
                const expectedStaff = [STAFF_ALPHA, STAFF_GAMMA].sort();
                log('1.C.5 steps assigned Alpha and Gamma concurrently', JSON.stringify(assignedStaff) === JSON.stringify(expectedStaff), `assigned=${JSON.stringify(assignedStaff)}`);
            }
        }

        // 1.D: Parallel Child A = Staff Alpha, Child B = Staff Alpha -> 0 feasible slots (same staff conflict)
        {
            const res = await request.post('/api/v1/bookings/package-search')
                .send({
                    tenantId: TENANT_ID,
                    packageId: PAR_PKG_ID,
                    date: testDate,
                    staffAssignments: {
                        [PAR_ITEM_1]: STAFF_ALPHA,
                        [PAR_ITEM_2]: STAFF_ALPHA
                    }
                });

            log('1.D.1 status is 200', res.status === 200, `status=${res.status}`);
            log('1.D.2 returns 0 feasible slots for concurrent same-staff request', Array.isArray(res.body.slots) && res.body.slots.length === 0, `slots=${res.body.slots?.length}`);
        }

        // 1.E: Parallel Child A = Any Professional (null), Child B = Staff Gamma -> auto-assigns distinct professional
        {
            const res = await request.post('/api/v1/bookings/package-search')
                .send({
                    tenantId: TENANT_ID,
                    packageId: PAR_PKG_ID,
                    date: testDate,
                    packageItems: [
                        { packageItemId: PAR_ITEM_1, staffId: null, requestedStaffId: null },
                        { packageItemId: PAR_ITEM_2, staffId: STAFF_GAMMA, requestedStaffId: STAFF_GAMMA }
                    ]
                });

            log('1.E.1 status is 200', res.status === 200, `status=${res.status}`);
            log('1.E.2 returns concurrent slots', Array.isArray(res.body.slots) && res.body.slots.length > 0, `count=${res.body.slots?.length}`);
            if (res.body.slots && res.body.slots.length > 0) {
                const slot = res.body.slots[0];
                const steps = slot.steps || [];
                const staff0 = steps[0]?.staffId;
                const staff1 = steps[1]?.staffId;
                log('1.E.3 Child B assigned Staff Gamma', staff1 === STAFF_GAMMA, `staff1=${staff1}`);
                log('1.E.4 Child A assigned distinct qualified staff', staff0 && staff0 !== STAFF_GAMMA, `staff0=${staff0}`);
            }
        }

        // 1.F: Parallel Child A = Any, Child B = Any -> assigns distinct staff
        {
            const res = await request.post('/api/v1/bookings/package-search')
                .send({
                    tenantId: TENANT_ID,
                    packageId: PAR_PKG_ID,
                    date: testDate,
                    staffAssignments: {
                        [PAR_ITEM_1]: null,
                        [PAR_ITEM_2]: null
                    }
                });

            log('1.F.1 status is 200', res.status === 200, `status=${res.status}`);
            log('1.F.2 returns slots for Any+Any', Array.isArray(res.body.slots) && res.body.slots.length > 0, `count=${res.body.slots?.length}`);
            if (res.body.slots && res.body.slots.length > 0) {
                const slot = res.body.slots[0];
                const steps = slot.steps || [];
                log('1.F.3 parallel distinct staff assigned', steps[0]?.staffId !== steps[1]?.staffId, `staff0=${steps[0]?.staffId}, staff1=${steps[1]?.staffId}`);
            }
        }

        // =========================================================
        // TASK 2: EXPLICIT NULL OVERRIDE
        // =========================================================
        console.log('\n--- Task 2: Explicit NULL Override via HTTP ---');
        {
            // Set defaultStaffId = STAFF_ALPHA on SEQ_ITEM_1 in DB
            const item = await db.ServicePackageItem.findByPk(SEQ_ITEM_1);
            originalDefaultStaff = item.defaultStaffId;
            await item.update({ defaultStaffId: STAFF_ALPHA });

            // Request explicitly sends child = null for SEQ_ITEM_1
            const res = await request.post('/api/v1/bookings/package-search')
                .send({
                    tenantId: TENANT_ID,
                    packageId: SEQ_PKG_ID,
                    date: testDate,
                    packageItems: [
                        { packageItemId: SEQ_ITEM_1, staffId: null, requestedStaffId: null },
                        { packageItemId: SEQ_ITEM_2, staffId: STAFF_GAMMA }
                    ],
                    staffAssignments: {
                        [SEQ_ITEM_1]: null,
                        [SEQ_ITEM_2]: STAFF_GAMMA
                    }
                });

            log('2.1 status is 200', res.status === 200, `status=${res.status}`);
            log('2.2 returns slots when explicit null overrides defaultStaffId', Array.isArray(res.body.slots) && res.body.slots.length > 0);

            // Revert defaultStaffId
            await item.update({ defaultStaffId: originalDefaultStaff });
            originalDefaultStaff = null;
        }

        // =========================================================
        // TASK 3: CONFLICTING INPUTS
        // =========================================================
        console.log('\n--- Task 3: Conflicting Inputs via HTTP ---');
        {
            // Matching pair succeeds
            const matchRes = await request.post('/api/v1/bookings/package-search')
                .send({
                    tenantId: TENANT_ID,
                    packageId: SEQ_PKG_ID,
                    date: testDate,
                    packageItems: [
                        { packageItemId: SEQ_ITEM_1, staffId: STAFF_ALPHA }
                    ],
                    staffAssignments: {
                        [SEQ_ITEM_1]: STAFF_ALPHA
                    }
                });
            log('3.1 matching packageItems + staffAssignments succeeds (200)', matchRes.status === 200, `status=${matchRes.status}`);

            // Conflicting pair (Staff Alpha vs Staff Gamma for same item)
            const conflictRes = await request.post('/api/v1/bookings/package-search')
                .send({
                    tenantId: TENANT_ID,
                    packageId: SEQ_PKG_ID,
                    date: testDate,
                    packageItems: [
                        { packageItemId: SEQ_ITEM_1, staffId: STAFF_ALPHA }
                    ],
                    staffAssignments: {
                        [SEQ_ITEM_1]: STAFF_GAMMA
                    }
                });
            log('3.2 conflicting child staff returns HTTP 400', conflictRes.status === 400, `status=${conflictRes.status}`);
            log('3.3 code is CONFLICTING_STAFF_ASSIGNMENTS', conflictRes.body.code === 'CONFLICTING_STAFF_ASSIGNMENTS', `code=${conflictRes.body.code}`);
            log('3.4 has customer-friendly messageAr', !!conflictRes.body.messageAr, `messageAr=${conflictRes.body.messageAr}`);
            log('3.5 does not expose SQL or internals', !conflictRes.body.message?.includes('SQL') && !conflictRes.body.message?.includes('Sequelize'));

            // Explicit null vs UUID conflict
            const nullVsUuidRes = await request.post('/api/v1/bookings/package-search')
                .send({
                    tenantId: TENANT_ID,
                    packageId: SEQ_PKG_ID,
                    date: testDate,
                    packageItems: [
                        { packageItemId: SEQ_ITEM_1, staffId: null, requestedStaffId: null }
                    ],
                    staffAssignments: {
                        [SEQ_ITEM_1]: STAFF_ALPHA
                    }
                });
            log('3.6 explicit null vs UUID returns HTTP 400 CONFLICTING_STAFF_ASSIGNMENTS', nullVsUuidRes.status === 400 && nullVsUuidRes.body.code === 'CONFLICTING_STAFF_ASSIGNMENTS', `status=${nullVsUuidRes.status}, code=${nullVsUuidRes.body.code}`);
        }

        // =========================================================
        // TASK 4: EVALUATE HTTP VERIFICATION
        // =========================================================
        console.log('\n--- Task 4: Evaluate HTTP Verification ---');
        {
            // Search a real slot first
            const searchRes = await request.post('/api/v1/bookings/package-search')
                .send({
                    tenantId: TENANT_ID,
                    packageId: SEQ_PKG_ID,
                    date: testDate,
                    packageItems: [
                        { packageItemId: SEQ_ITEM_1, staffId: STAFF_ALPHA },
                        { packageItemId: SEQ_ITEM_2, staffId: STAFF_GAMMA }
                    ]
                });

            if (searchRes.body.slots && searchRes.body.slots.length > 0) {
                const realSlot = searchRes.body.slots[0];
                const realStartTime = realSlot.startTime;

                // 4.A: Explicit Child A Staff Alpha + Child B Staff Gamma
                const evalExplicit = await request.post('/api/v1/bookings/evaluate')
                    .send({
                        tenantId: TENANT_ID,
                        packageId: SEQ_PKG_ID,
                        startTime: realStartTime,
                        duration: realSlot.duration,
                        packageItems: [
                            { packageItemId: SEQ_ITEM_1, serviceId: SVC_MOROCCAN, staffId: STAFF_ALPHA },
                            { packageItemId: SEQ_ITEM_2, serviceId: SVC_THAI, staffId: STAFF_GAMMA }
                        ]
                    });

                log('4.A.1 evaluate with explicit staff returns 200', evalExplicit.status === 200, `status=${evalExplicit.status}`);
                log('4.A.2 decision.valid is true', evalExplicit.body.decision?.valid === true, `valid=${evalExplicit.body.decision?.valid}`);

                // 4.B: Mixed Any + explicit staff
                const evalMixed = await request.post('/api/v1/bookings/evaluate')
                    .send({
                        tenantId: TENANT_ID,
                        packageId: SEQ_PKG_ID,
                        startTime: realStartTime,
                        duration: realSlot.duration,
                        packageItems: [
                            { packageItemId: SEQ_ITEM_1, serviceId: SVC_MOROCCAN, staffId: null },
                            { packageItemId: SEQ_ITEM_2, serviceId: SVC_THAI, staffId: STAFF_GAMMA }
                        ]
                    });

                log('4.B.1 evaluate with mixed Any+explicit returns 200', evalMixed.status === 200, `status=${evalMixed.status}`);
                log('4.B.2 mixed decision.valid is true', evalMixed.body.decision?.valid === true);

                // 4.C: Same explicit staff on parallel children -> safe HTTP 409 PARALLEL_STAFF_CONFLICT
                const evalSamePar = await request.post('/api/v1/bookings/evaluate')
                    .send({
                        tenantId: TENANT_ID,
                        packageId: PAR_PKG_ID,
                        startTime: realStartTime,
                        duration: 60,
                        packageItems: [
                            { packageItemId: PAR_ITEM_1, serviceId: SVC_MOROCCAN, staffId: STAFF_ALPHA },
                            { packageItemId: PAR_ITEM_2, serviceId: SVC_THAI, staffId: STAFF_ALPHA }
                        ]
                    });

                log('4.C.1 evaluate same-staff parallel returns HTTP 409', evalSamePar.status === 409, `status=${evalSamePar.status}`);
                log('4.C.2 code is PARALLEL_STAFF_CONFLICT', evalSamePar.body.code === 'PARALLEL_STAFF_CONFLICT', `code=${evalSamePar.body.code}`);
                log('4.C.3 has friendly bilingual error', !!evalSamePar.body.messageAr, `messageAr=${evalSamePar.body.messageAr}`);
            } else {
                log('4.A.1 search returned no slots for evaluate testing', false);
            }
        }

        // =========================================================
        // TASK 5: CREATE CONTRACT VALIDATION (DRY PAYLOAD SHAPE)
        // =========================================================
        console.log('\n--- Task 5: Create Contract Payload Validation ---');
        {
            // Send payload with child-level staff without auth -> verifies contract acceptance (401 auth gate, not 500 parsing error)
            const payload = {
                tenantId: TENANT_ID,
                items: [{
                    itemType: 'package',
                    packageId: SEQ_PKG_ID,
                    packageItems: [
                        {
                            serviceId: SVC_MOROCCAN,
                            packageItemId: SEQ_ITEM_1,
                            staffId: STAFF_ALPHA,
                            requestedStaffId: STAFF_ALPHA,
                            startTime: '2026-10-01T10:00:00.000Z',
                            endTime: '2026-10-01T11:00:00.000Z',
                            duration: 60,
                            sequenceOrder: 0
                        },
                        {
                            serviceId: SVC_THAI,
                            packageItemId: SEQ_ITEM_2,
                            staffId: STAFF_GAMMA,
                            requestedStaffId: STAFF_GAMMA,
                            startTime: '2026-10-01T11:00:00.000Z',
                            endTime: '2026-10-01T11:45:00.000Z',
                            duration: 45,
                            sequenceOrder: 1
                        }
                    ],
                    notes: 'Per-child staff verification',
                    paymentMethod: 'at-center'
                }]
            };

            const res = await request.post('/api/v1/bookings/create').send(payload);
            log('5.1 create endpoint accepts packageItems payload (returns 401, not 500)', res.status === 401, `status=${res.status}`);
            log('5.2 no schema or internal server crash', res.status !== 500);
        }

        // =========================================================
        // TASK 8: DUPLICATE SERVICE-ID CHECK
        // =========================================================
        console.log('\n--- Task 8: Duplicate serviceId Resolution Check ---');
        {
            const availabilityService = require('./src/services/availabilityService');
            // Mock two package items with identical serviceId but distinct packageItemId
            const itemA = { id: 'p-item-dup-1', serviceId: SVC_MOROCCAN, defaultStaffId: null };
            const itemB = { id: 'p-item-dup-2', serviceId: SVC_MOROCCAN, defaultStaffId: null };

            const requestPackageItems = [
                { packageItemId: 'p-item-dup-1', serviceId: SVC_MOROCCAN, staffId: STAFF_ALPHA },
                { packageItemId: 'p-item-dup-2', serviceId: SVC_MOROCCAN, staffId: STAFF_GAMMA }
            ];

            const staffA = availabilityService._resolveChildStepStaff(itemA, { packageItems: requestPackageItems });
            const staffB = availabilityService._resolveChildStepStaff(itemB, { packageItems: requestPackageItems });

            log('8.1 duplicate serviceId itemA resolves to its distinct staff (Alpha)', staffA === STAFF_ALPHA, `staffA=${staffA}`);
            log('8.2 duplicate serviceId itemB resolves to its distinct staff (Gamma)', staffB === STAFF_GAMMA, `staffB=${staffB}`);
            log('8.3 canonical packageItemId prevents cross-item collision', staffA !== staffB);
        }

        // =========================================================
        // SUMMARY
        // =========================================================
        console.log('\n' + '='.repeat(60));
        console.log(`RESULTS: ${passCount} PASS, ${failCount} FAIL out of ${passCount + failCount} tests`);
        console.log('='.repeat(60));
        if (failCount > 0) {
            console.log('\nFailed tests:');
            results.filter(r => r.status === 'FAIL').forEach(r => {
                console.log(`  ✗ ${r.test}: ${r.detail}`);
            });
        }
        console.log();

    } catch (err) {
        console.error('\n❌ FATAL ERROR:', err.message);
        console.error(err.stack);
    } finally {
        // CLEANUP
        try {
            if (originalDefaultStaff !== null && db) {
                await db.ServicePackageItem.update({ defaultStaffId: originalDefaultStaff }, { where: { id: SEQ_ITEM_1 } });
            }
            if (db && createdSEIds.length > 0) {
                await db.ServiceEmployee.destroy({ where: { id: createdSEIds } });
                console.log(`🧹 Cleaned ${createdSEIds.length} ServiceEmployee fixtures`);
            }
            if (db && createdScheduleIds.length > 0) {
                await db.StaffSchedule.destroy({ where: { id: createdScheduleIds } });
                console.log(`🧹 Cleaned ${createdScheduleIds.length} StaffSchedule fixtures`);
            }
            if (db) await db.sequelize.close();
        } catch (cleanupErr) {
            console.error('⚠️  Cleanup error:', cleanupErr.message);
        }

        process.exit(failCount > 0 ? 1 : 0);
    }
})();
