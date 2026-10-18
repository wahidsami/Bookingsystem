const { getReviews, replyToReview } = require('../staffAppController');
const db = require('../../models');

describe('Staff App Reviews — Reviewer Identity & Regression Tests', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    const createMockReqRes = (tenantId = 'tenant-100', staffId = 'staff-200', body = {}, params = {}) => {
        const req = {
            tenantId,
            staffId,
            body,
            params
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        return { req, res };
    };

    const mockStaffPermissions = (permissions = { view_reviews: true, reply_reviews: true }) => {
        jest.spyOn(db.StaffPermission, 'findOne').mockResolvedValue({ permissions });
    };

    describe('Case A — Historical placeholder with a real associated customer', () => {
        test('replaces "Verified Customer" with real PlatformUser name from association', async () => {
            mockStaffPermissions({ view_reviews: true });

            const mockReviews = [
                {
                    id: 'rev-001',
                    tenantId: 'tenant-100',
                    staffId: 'staff-200',
                    customerName: 'Verified Customer',
                    rating: 5,
                    comment: 'Excellent styling session!',
                    createdAt: new Date('2026-03-01T10:00:00Z'),
                    platformUser: {
                        id: 'usr-001',
                        firstName: 'Amina',
                        lastName: 'Al-Harbi'
                    }
                }
            ];

            let capturedQuery = null;
            jest.spyOn(db.Review, 'findAll').mockImplementation(async (query) => {
                capturedQuery = query;
                return mockReviews;
            });

            const { req, res } = createMockReqRes();
            await getReviews(req, res);

            expect(res.json).toHaveBeenCalled();
            const body = res.json.mock.calls[0][0];
            expect(body.success).toBe(true);

            // Reviewer display name is resolved to real name
            expect(body.data.reviews[0].customerName).toBe('Amina Al-Harbi');
            expect(body.data.reviews[0].platformUser).toEqual({
                id: 'usr-001',
                firstName: 'Amina',
                lastName: 'Al-Harbi'
            });

            // Verify PlatformUser include configuration
            const userInclude = capturedQuery.include.find((inc) => inc.as === 'platformUser');
            expect(userInclude).toBeDefined();
            expect(userInclude.model).toBe(db.PlatformUser);
            expect(userInclude.attributes).toEqual(['id', 'firstName', 'lastName']);
            expect(userInclude.required).toBe(false);
        });
    });

    describe('Case B — Arabic customer name', () => {
        test('preserves Arabic first and last name without transliteration or corruption', async () => {
            mockStaffPermissions({ view_reviews: true });

            const mockReviews = [
                {
                    id: 'rev-002',
                    tenantId: 'tenant-100',
                    staffId: 'staff-200',
                    customerName: 'عميل موثّق',
                    rating: 5,
                    comment: 'خدمة رائعة ومميزة جداً',
                    createdAt: new Date('2026-03-02T11:00:00Z'),
                    platformUser: {
                        id: 'usr-002',
                        firstName: 'سارة',
                        lastName: 'العتيبي'
                    }
                }
            ];

            jest.spyOn(db.Review, 'findAll').mockResolvedValue(mockReviews);

            const { req, res } = createMockReqRes();
            await getReviews(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.success).toBe(true);
            expect(body.data.reviews[0].customerName).toBe('سارة العتيبي');
            expect(body.data.reviews[0].platformUser.firstName).toBe('سارة');
            expect(body.data.reviews[0].platformUser.lastName).toBe('العتيبي');
        });
    });

    describe('Case C — No usable associated customer name', () => {
        test('retains generic fallback when platformUser association is null (e.g. deleted user)', async () => {
            mockStaffPermissions({ view_reviews: true });

            const mockReviews = [
                {
                    id: 'rev-003',
                    tenantId: 'tenant-100',
                    staffId: 'staff-200',
                    customerName: 'Verified Customer',
                    rating: 4,
                    comment: 'Good overall',
                    createdAt: new Date('2026-03-03T12:00:00Z'),
                    platformUser: null
                }
            ];

            jest.spyOn(db.Review, 'findAll').mockResolvedValue(mockReviews);

            const { req, res } = createMockReqRes();
            await getReviews(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.success).toBe(true);
            expect(body.data.reviews[0].customerName).toBe('Verified Customer');
            expect(body.data.reviews[0].platformUser).toBeNull();
        });

        test('retains generic fallback when platformUser has null/empty names without throwing', async () => {
            mockStaffPermissions({ view_reviews: true });

            const mockReviews = [
                {
                    id: 'rev-004',
                    tenantId: 'tenant-100',
                    staffId: 'staff-200',
                    customerName: 'عميل موثّق',
                    rating: 4,
                    comment: 'خدمة جيدة',
                    createdAt: new Date('2026-03-04T14:00:00Z'),
                    platformUser: {
                        id: 'usr-004',
                        firstName: null,
                        lastName: null
                    }
                }
            ];

            jest.spyOn(db.Review, 'findAll').mockResolvedValue(mockReviews);

            const { req, res } = createMockReqRes();
            await getReviews(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.success).toBe(true);
            expect(body.data.reviews[0].customerName).toBe('عميل موثّق');
        });
    });

    describe('Case D — Privacy restrictions', () => {
        test('does not query or expose email, phone number, password, or tokens', async () => {
            mockStaffPermissions({ view_reviews: true });

            let capturedQuery = null;
            jest.spyOn(db.Review, 'findAll').mockImplementation(async (query) => {
                capturedQuery = query;
                return [
                    {
                        id: 'rev-005',
                        tenantId: 'tenant-100',
                        staffId: 'staff-200',
                        customerName: 'Verified Customer',
                        rating: 5,
                        comment: 'Top quality',
                        createdAt: new Date('2026-03-05T15:00:00Z'),
                        platformUser: {
                            id: 'usr-005',
                            firstName: 'Reem',
                            lastName: 'Al-Ghamdi'
                        }
                    }
                ];
            });

            const { req, res } = createMockReqRes();
            await getReviews(req, res);

            // 1. Sequelize include attributes strictly limited to ['id', 'firstName', 'lastName']
            const userInclude = capturedQuery.include.find((inc) => inc.as === 'platformUser');
            expect(userInclude.attributes).toEqual(['id', 'firstName', 'lastName']);
            expect(userInclude.attributes).not.toContain('email');
            expect(userInclude.attributes).not.toContain('phone');
            expect(userInclude.attributes).not.toContain('password');
            expect(userInclude.attributes).not.toContain('passwordHash');

            // 2. Response object has no sensitive personal data
            const review = res.json.mock.calls[0][0].data.reviews[0];
            expect(review.customerName).toBe('Reem Al-Ghamdi');
            expect(review.platformUser.email).toBeUndefined();
            expect(review.platformUser.phone).toBeUndefined();
            expect(review.platformUser.passwordHash).toBeUndefined();
            expect(review.customerName).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/i); // Not a UUID
        });
    });

    describe('Case E — Tenant and staff isolation', () => {
        test('strictly scopes review query by req.tenantId and req.staffId', async () => {
            mockStaffPermissions({ view_reviews: true });

            let capturedQuery = null;
            jest.spyOn(db.Review, 'findAll').mockImplementation(async (query) => {
                capturedQuery = query;
                return [];
            });

            const { req, res } = createMockReqRes('tenant-alpha', 'staff-beta');
            await getReviews(req, res);

            expect(capturedQuery.where).toEqual({
                tenantId: 'tenant-alpha',
                staffId: 'staff-beta'
            });
        });

        test('returns 403 Forbidden when staff lacks view_reviews permission', async () => {
            mockStaffPermissions({ view_reviews: false });

            const findAllSpy = jest.spyOn(db.Review, 'findAll');

            const { req, res } = createMockReqRes();
            await getReviews(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: expect.stringContaining('Review access is not enabled')
            }));
            expect(findAllSpy).not.toHaveBeenCalled();
        });
    });

    describe('Case F — Existing response compatibility', () => {
        test('preserves review fields, calculates avgRating, distribution, and total correctly', async () => {
            mockStaffPermissions({ view_reviews: true });

            const mockReviews = [
                {
                    id: 'rev-010',
                    tenantId: 'tenant-100',
                    staffId: 'staff-200',
                    customerName: 'Verified Customer',
                    rating: 5,
                    comment: 'Loved it',
                    staffReply: 'Thank you for visiting!',
                    staffRepliedAt: new Date('2026-03-06T12:00:00Z'),
                    createdAt: new Date('2026-03-06T10:00:00Z'),
                    platformUser: {
                        id: 'usr-010',
                        firstName: 'Noura',
                        lastName: 'Al-Saleh'
                    }
                },
                {
                    id: 'rev-011',
                    tenantId: 'tenant-100',
                    staffId: 'staff-200',
                    customerName: 'Custom Guest Name',
                    rating: 3,
                    comment: 'Average experience',
                    staffReply: null,
                    staffRepliedAt: null,
                    createdAt: new Date('2026-03-05T09:00:00Z'),
                    platformUser: {
                        id: 'usr-011',
                        firstName: 'Lama',
                        lastName: 'Al-Otaibi'
                    }
                }
            ];

            let capturedQuery = null;
            jest.spyOn(db.Review, 'findAll').mockImplementation(async (query) => {
                capturedQuery = query;
                return mockReviews;
            });

            const { req, res } = createMockReqRes();
            await getReviews(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.success).toBe(true);

            // Sorting preserved
            expect(capturedQuery.order).toEqual([['createdAt', 'DESC']]);

            // Summary metrics
            expect(body.data.total).toBe(2);
            expect(body.data.avgRating).toBe('4.0');
            expect(body.data.distribution).toEqual({ 3: 1, 5: 1 });

            // Fields preserved
            const first = body.data.reviews[0];
            expect(first.id).toBe('rev-010');
            expect(first.rating).toBe(5);
            expect(first.comment).toBe('Loved it');
            expect(first.staffReply).toBe('Thank you for visiting!');
            expect(first.staffRepliedAt).toBeDefined();
            expect(first.createdAt).toBeDefined();
            expect(first.customerName).toBe('Noura Al-Saleh');

            // Custom non-generic name untouched
            const second = body.data.reviews[1];
            expect(second.customerName).toBe('Custom Guest Name');
        });
    });

    describe('Case G — Review replies remain intact', () => {
        test('replyToReview updates staff reply with tenant and staff isolation', async () => {
            mockStaffPermissions({ reply_reviews: true });

            const mockReviewInstance = {
                id: 'rev-020',
                tenantId: 'tenant-100',
                staffId: 'staff-200',
                staffReply: null,
                staffRepliedAt: null,
                update: jest.fn().mockImplementation(async (fields) => {
                    Object.assign(mockReviewInstance, fields);
                    return mockReviewInstance;
                })
            };

            let capturedFindWhere = null;
            jest.spyOn(db.Review, 'findOne').mockImplementation(async (query) => {
                capturedFindWhere = query.where;
                return mockReviewInstance;
            });

            const { req, res } = createMockReqRes('tenant-100', 'staff-200', { staffReply: '  Thank you very much!  ' }, { id: 'rev-020' });
            await replyToReview(req, res);

            expect(capturedFindWhere).toEqual({
                id: 'rev-020',
                tenantId: 'tenant-100',
                staffId: 'staff-200'
            });

            expect(mockReviewInstance.update).toHaveBeenCalledWith(expect.objectContaining({
                staffReply: 'Thank you very much!',
                staffRepliedAt: expect.any(Date)
            }));

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: mockReviewInstance
            }));
        });

        test('replyToReview returns 403 Forbidden when staff lacks reply_reviews permission', async () => {
            mockStaffPermissions({ reply_reviews: false });

            const findOneSpy = jest.spyOn(db.Review, 'findOne');

            const { req, res } = createMockReqRes('tenant-100', 'staff-200', { staffReply: 'Hello' }, { id: 'rev-020' });
            await replyToReview(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: expect.stringContaining('Review reply access is not enabled')
            }));
            expect(findOneSpy).not.toHaveBeenCalled();
        });
    });
});
