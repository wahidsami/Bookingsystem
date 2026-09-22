const {
    isGenericCustomerName,
    resolveRealCustomerName,
    sanitizeReviewCustomerIdentity,
    createCustomerReview,
    getTenantPublicReviews
} = require('../reviewController');
const { getAllReviews } = require('../tenantPayrollController');
const db = require('../../models');

describe('Review Identity Resolution Logic', () => {
    describe('isGenericCustomerName', () => {
        test('identifies generic English placeholder "Verified Customer"', () => {
            expect(isGenericCustomerName('Verified Customer')).toBe(true);
            expect(isGenericCustomerName('  verified customer  ')).toBe(true);
            expect(isGenericCustomerName('VERIFIED CUSTOMER')).toBe(true);
        });

        test('identifies generic Arabic placeholder "عميل موثّق"', () => {
            expect(isGenericCustomerName('عميل موثّق')).toBe(true);
            expect(isGenericCustomerName('  عميل موثّق  ')).toBe(true);
        });

        test('identifies generic words "Customer" and "عميل"', () => {
            expect(isGenericCustomerName('Customer')).toBe(true);
            expect(isGenericCustomerName('customer')).toBe(true);
            expect(isGenericCustomerName('عميل')).toBe(true);
        });

        test('identifies generic words "Valued Customer" and "عميل مميز"', () => {
            expect(isGenericCustomerName('Valued Customer')).toBe(true);
            expect(isGenericCustomerName('valued customer')).toBe(true);
            expect(isGenericCustomerName('عميل مميز')).toBe(true);
        });

        test('identifies empty, whitespace, and null values as generic', () => {
            expect(isGenericCustomerName('')).toBe(true);
            expect(isGenericCustomerName('   ')).toBe(true);
            expect(isGenericCustomerName(null)).toBe(true);
            expect(isGenericCustomerName(undefined)).toBe(true);
        });

        test('preserves real customer names', () => {
            expect(isGenericCustomerName('Amina Al-Harbi')).toBe(false);
            expect(isGenericCustomerName('Sarah Smith')).toBe(false);
            expect(isGenericCustomerName('محمد علي')).toBe(false);
            expect(isGenericCustomerName('John Doe')).toBe(false);
        });
    });

    describe('resolveRealCustomerName', () => {
        test('resolves full name when both firstName and lastName exist', () => {
            expect(resolveRealCustomerName({ firstName: 'Amina', lastName: 'Al-Harbi' })).toBe('Amina Al-Harbi');
        });

        test('resolves single name when only firstName exists', () => {
            expect(resolveRealCustomerName({ firstName: 'Amina', lastName: null })).toBe('Amina');
        });

        test('resolves single name when only lastName exists', () => {
            expect(resolveRealCustomerName({ firstName: '', lastName: 'Al-Harbi' })).toBe('Al-Harbi');
        });

        test('returns null when names are undefined, null, or string "undefined"', () => {
            expect(resolveRealCustomerName({ firstName: undefined, lastName: undefined })).toBeNull();
            expect(resolveRealCustomerName({ firstName: 'undefined', lastName: '' })).toBeNull();
            expect(resolveRealCustomerName(null)).toBeNull();
        });
    });

    describe('sanitizeReviewCustomerIdentity', () => {
        test('replaces "Verified Customer" with real PlatformUser name when present', () => {
            const oldReview = {
                id: 'rev-1',
                customerName: 'Verified Customer',
                rating: 5,
                comment: 'Great service!',
                platformUser: {
                    id: 'user-1',
                    firstName: 'Amina',
                    lastName: 'Al-Harbi'
                },
                staff: {
                    id: 'staff-1',
                    name: 'Sally'
                }
            };

            const sanitized = sanitizeReviewCustomerIdentity(oldReview);
            expect(sanitized.customerName).toBe('Amina Al-Harbi');
            expect(sanitized.platformUser).toEqual({
                id: 'user-1',
                firstName: 'Amina',
                lastName: 'Al-Harbi'
            });
            expect(sanitized.staff.name).toBe('Sally');
        });

        test('replaces "عميل موثّق" with real PlatformUser name when present', () => {
            const oldReview = {
                id: 'rev-2',
                customerName: 'عميل موثّق',
                rating: 4,
                platformUser: {
                    id: 'user-2',
                    firstName: 'سارة',
                    lastName: 'العتيبي'
                }
            };

            const sanitized = sanitizeReviewCustomerIdentity(oldReview);
            expect(sanitized.customerName).toBe('سارة العتيبي');
        });

        test('leaves generic customerName untouched if PlatformUser has no name', () => {
            const oldReview = {
                id: 'rev-3',
                customerName: 'Verified Customer',
                rating: 5,
                platformUser: {
                    id: 'user-3',
                    firstName: null,
                    lastName: null
                }
            };

            const sanitized = sanitizeReviewCustomerIdentity(oldReview);
            expect(sanitized.customerName).toBe('Verified Customer');
        });

        test('preserves real custom customerName untouched', () => {
            const customReview = {
                id: 'rev-4',
                customerName: 'Custom VIP Guest',
                rating: 5,
                platformUser: {
                    id: 'user-4',
                    firstName: 'Amina',
                    lastName: 'Al-Harbi'
                }
            };

            const sanitized = sanitizeReviewCustomerIdentity(customReview);
            expect(sanitized.customerName).toBe('Custom VIP Guest');
        });

        test('handles Sequelize model instance with toJSON() method', () => {
            const mockInstance = {
                id: 'rev-5',
                customerName: 'Verified Customer',
                platformUser: { id: 'u-5', firstName: 'Noura', lastName: 'Saleh' },
                toJSON() {
                    return {
                        id: this.id,
                        customerName: this.customerName,
                        platformUser: this.platformUser
                    };
                }
            };

            const sanitized = sanitizeReviewCustomerIdentity(mockInstance);
            expect(sanitized.customerName).toBe('Noura Saleh');
        });
    });

    describe('Controller Endpoints Integration Behavior', () => {
        let notificationOrchestrator;

        beforeEach(() => {
            notificationOrchestrator = require('../../services/notificationOrchestratorService');
            jest.spyOn(notificationOrchestrator, 'notifyStaff').mockResolvedValue(true);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        const setupReviewCreateMock = (user) => {
            const mockAppointment = {
                id: 'apt-1',
                tenantId: 'tenant-1',
                platformUserId: user.id,
                staffId: 'staff-1',
                status: 'completed'
            };

            jest.spyOn(db.Appointment, 'findOne').mockResolvedValue(mockAppointment);
            jest.spyOn(db.Review, 'findOne').mockResolvedValue(null);
            jest.spyOn(db.Staff, 'findOne').mockResolvedValue({ id: 'staff-1', tenantId: 'tenant-1' });
            jest.spyOn(db.Staff, 'update').mockResolvedValue([1]);
            jest.spyOn(db.Review, 'findAll').mockResolvedValue([]);
            jest.spyOn(db.PlatformUser, 'findByPk').mockResolvedValue(user);

            let createdPayload = null;
            jest.spyOn(db.Review, 'create').mockImplementation(async (payload) => {
                createdPayload = payload;
                return { id: 'new-rev-1', ...payload };
            });

            return () => createdPayload;
        };

        // 1. "Verified Customer" -> real PlatformUser name
        test('1. "Verified Customer" client input resolves to real PlatformUser name', async () => {
            const getCreated = setupReviewCreateMock({
                id: 'user-1',
                firstName: 'Reem',
                lastName: 'Al-Ghamdi',
                email: 'reem@example.com'
            });

            const req = {
                userId: 'user-1',
                body: {
                    tenantId: 'tenant-1',
                    appointmentId: 'apt-1',
                    staffId: 'staff-1',
                    rating: 5,
                    comment: 'Great',
                    customerName: 'Verified Customer'
                }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            await createCustomerReview(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(getCreated().customerName).toBe('Reem Al-Ghamdi');
        });

        // 2. "عميل موثّق" -> real PlatformUser name
        test('2. "عميل موثّق" client input resolves to real PlatformUser name', async () => {
            const getCreated = setupReviewCreateMock({
                id: 'user-2',
                firstName: 'سارة',
                lastName: 'العتيبي',
                email: 'sara@example.com'
            });

            const req = {
                userId: 'user-2',
                body: {
                    tenantId: 'tenant-1',
                    appointmentId: 'apt-1',
                    staffId: 'staff-1',
                    rating: 5,
                    customerName: 'عميل موثّق'
                }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            await createCustomerReview(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(getCreated().customerName).toBe('سارة العتيبي');
        });

        // 3. Arbitrary client value such as "Fake Name" -> real PlatformUser name
        test('3. Arbitrary client value "Fake Name" is rejected in favor of real PlatformUser name', async () => {
            const getCreated = setupReviewCreateMock({
                id: 'user-3',
                firstName: 'Amina',
                lastName: 'Al-Harbi',
                email: 'amina@example.com'
            });

            const req = {
                userId: 'user-3',
                body: {
                    tenantId: 'tenant-1',
                    appointmentId: 'apt-1',
                    staffId: 'staff-1',
                    rating: 5,
                    customerName: 'Fake Name' // Client sends an arbitrary / spoofed name
                }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            await createCustomerReview(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            // Must strictly use the authenticated PlatformUser name
            expect(getCreated().customerName).toBe('Amina Al-Harbi');
        });

        // 4. Real PlatformUser with only firstName works
        test('4. Real PlatformUser with only firstName resolves correctly', async () => {
            const getCreated = setupReviewCreateMock({
                id: 'user-4',
                firstName: 'Maha',
                lastName: null,
                email: 'maha@example.com'
            });

            const req = {
                userId: 'user-4',
                body: {
                    tenantId: 'tenant-1',
                    appointmentId: 'apt-1',
                    staffId: 'staff-1',
                    rating: 4,
                    customerName: 'Verified Customer'
                }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            await createCustomerReview(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(getCreated().customerName).toBe('Maha');
        });

        // 5. Missing PlatformUser name preserves the documented fallback
        test('5. Missing PlatformUser name preserves the documented fallback (email or "Customer")', async () => {
            const getCreatedWithEmail = setupReviewCreateMock({
                id: 'user-5a',
                firstName: null,
                lastName: null,
                email: 'anonymous_client@example.com'
            });

            const reqWithEmail = {
                userId: 'user-5a',
                body: {
                    tenantId: 'tenant-1',
                    appointmentId: 'apt-1',
                    staffId: 'staff-1',
                    rating: 5,
                    customerName: 'Verified Customer'
                }
            };
            const resA = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            await createCustomerReview(reqWithEmail, resA);

            expect(getCreatedWithEmail().customerName).toBe('anonymous_client@example.com');

            // Now test when user has no name and no email
            const getCreatedNoEmail = setupReviewCreateMock({
                id: 'user-5b',
                firstName: null,
                lastName: null,
                email: null
            });

            const reqNoEmail = {
                userId: 'user-5b',
                body: {
                    tenantId: 'tenant-1',
                    appointmentId: 'apt-1',
                    staffId: 'staff-1',
                    rating: 5,
                    customerName: 'Verified Customer'
                }
            };
            const resB = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            await createCustomerReview(reqNoEmail, resB);

            expect(getCreatedNoEmail().customerName).toBe('Customer');
        });

        // 6. Existing public/admin review response behavior remains correct
        test('6. Existing public tenant reviews API returns platformUser identity and resolves old reviews', async () => {
            const mockReviews = [
                {
                    id: 'rev-old-1',
                    tenantId: 'tenant-1',
                    customerName: 'Verified Customer',
                    rating: 5,
                    platformUser: { id: 'u-1', firstName: 'Huda', lastName: 'Mansour' },
                    staff: { id: 's-1', name: 'Mona', photo: 'staff.jpg' }
                }
            ];

            let queryOptions = null;
            jest.spyOn(db.Review, 'findAll').mockImplementation(async (opts) => {
                queryOptions = opts;
                return mockReviews;
            });

            const req = { params: { tenantId: 'tenant-1' }, query: {} };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            await getTenantPublicReviews(req, res);

            expect(res.json).toHaveBeenCalled();
            const responseData = res.json.mock.calls[0][0];
            expect(responseData.success).toBe(true);

            // Verifies PlatformUser association is included
            const platformUserInclude = queryOptions.include.find(inc => inc.as === 'platformUser');
            expect(platformUserInclude).toBeDefined();
            expect(platformUserInclude.model).toBe(db.PlatformUser);
            expect(platformUserInclude.attributes).toEqual(['id', 'firstName', 'lastName']);

            // Verifies Staff association is preserved
            const staffInclude = queryOptions.include.find(inc => inc.as === 'staff');
            expect(staffInclude).toBeDefined();

            // Verifies response resilience: customerName resolved to real name
            expect(responseData.reviews[0].customerName).toBe('Huda Mansour');
            expect(responseData.reviews[0].platformUser.firstName).toBe('Huda');
            expect(responseData.reviews[0].staff.name).toBe('Mona');
        });

        test('6b. Existing tenant admin reviews API returns platformUser identity and resolves old reviews', async () => {
            const mockReviews = [
                {
                    id: 'rev-old-2',
                    tenantId: 'tenant-1',
                    customerName: 'Verified Customer',
                    rating: 5,
                    platformUser: { id: 'u-2', firstName: 'Layla', lastName: 'Khaled' },
                    staff: { id: 's-1', name: 'Sara' }
                }
            ];

            let queryOptions = null;
            jest.spyOn(db.Review, 'findAll').mockImplementation(async (opts) => {
                queryOptions = opts;
                return mockReviews;
            });

            const req = { tenantId: 'tenant-1', query: {} };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            await getAllReviews(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            const responseData = res.json.mock.calls[0][0];
            expect(responseData.success).toBe(true);

            // Verifies PlatformUser association is included
            const platformUserInclude = queryOptions.include.find(inc => inc.as === 'platformUser');
            expect(platformUserInclude).toBeDefined();
            expect(platformUserInclude.attributes).toEqual(['id', 'firstName', 'lastName']);

            // Verifies response resilience: customerName resolved to real name
            expect(responseData.data.reviews[0].customerName).toBe('Layla Khaled');
            expect(responseData.data.reviews[0].platformUser.firstName).toBe('Layla');
            expect(responseData.data.reviews[0].staff.name).toBe('Sara');
        });
    });
});
