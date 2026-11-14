'use strict';

describe('BARSPA-FIN-OPS-01 Decision 4: Product Sales & Service Sales Separation', () => {
    let tenantPosController;
    let db;
    let mockTransaction;
    let mockProduct;
    let mockService;
    let mockStaff;
    let mockPlatformUser;
    let createdOrders;
    let createdOrderItems;
    let createdAppointments;
    let createdPaymentTransactions;
    let invoiceGenerations;

    beforeEach(() => {
        jest.clearAllMocks();

        mockTransaction = {
            commit: jest.fn().mockResolvedValue(true),
            rollback: jest.fn().mockResolvedValue(true),
            LOCK: { UPDATE: 'UPDATE' }
        };

        mockProduct = {
            id: 'prod-001',
            tenantId: 'tenant-100',
            name_en: 'Moroccan Argan Hair Oil 100ml',
            name_ar: 'زيت الأرغان المغربي للشعر 100 مل',
            price: 150.00,
            taxRate: 15,
            stock: 20,
            soldCount: 5,
            save: jest.fn().mockImplementation(async function() {
                return this;
            })
        };

        mockService = {
            id: 'srv-001',
            tenantId: 'tenant-100',
            name_en: 'Royal Moroccan Bath & Massage',
            name_ar: 'حمام مغربي ملكي مع مساج',
            price: 350.00,
            finalPrice: 350.00,
            rawPrice: 304.35,
            duration: 90
        };

        mockStaff = {
            id: 'staff-001',
            tenantId: 'tenant-100',
            name: 'Layla Specialist',
            isActive: true
        };

        mockPlatformUser = {
            id: 'user-001',
            firstName: 'Noura',
            lastName: 'Al-Harbi',
            phone: '+966512345678',
            email: 'noura@example.com'
        };

        createdOrders = [];
        createdOrderItems = [];
        createdAppointments = [];
        createdPaymentTransactions = [];
        invoiceGenerations = [];

        db = {
            sequelize: {
                transaction: jest.fn().mockResolvedValue(mockTransaction)
            },
            PlatformUser: {
                findByPk: jest.fn().mockResolvedValue(mockPlatformUser),
                findOne: jest.fn().mockResolvedValue(mockPlatformUser),
                create: jest.fn().mockImplementation(async (data) => ({ id: 'new-user', ...data }))
            },
            Product: {
                findOne: jest.fn().mockImplementation(async ({ where }) => {
                    if (where.id === mockProduct.id) return mockProduct;
                    return null;
                })
            },
            Service: {
                findOne: jest.fn().mockImplementation(async ({ where }) => {
                    if (where.id === mockService.id) return mockService;
                    return null;
                })
            },
            Staff: {
                findOne: jest.fn().mockResolvedValue(mockStaff)
            },
            Order: {
                create: jest.fn().mockImplementation(async (data) => {
                    const order = {
                        id: 'order-uuid-101',
                        orderNumber: 'ORD-2026-000101',
                        ...data
                    };
                    createdOrders.push(order);
                    return order;
                })
            },
            OrderItem: {
                create: jest.fn().mockImplementation(async (data) => {
                    createdOrderItems.push(data);
                    return { id: `item-${createdOrderItems.length}`, ...data };
                })
            },
            Appointment: {
                create: jest.fn().mockImplementation(async (data) => {
                    const appt = {
                        id: 'appt-uuid-201',
                        bookingNumber: 'BKG-2026-000201',
                        ...data
                    };
                    createdAppointments.push(appt);
                    return appt;
                })
            }
        };

        jest.doMock('../../models', () => db);

        jest.doMock('../customerInvoiceService', () => ({
            ensureOrderInvoice: jest.fn().mockImplementation(async (orderId) => {
                invoiceGenerations.push({ type: 'order', orderId });
                return { id: `inv-ord-${orderId}` };
            }),
            ensureAppointmentInvoice: jest.fn().mockImplementation(async (appointmentId) => {
                invoiceGenerations.push({ type: 'appointment', appointmentId });
                return { id: `inv-appt-${appointmentId}` };
            })
        }));

        jest.doMock('../paymentTransactionLedgerService', () => ({
            createOrderTransaction: jest.fn().mockImplementation(async (data) => {
                createdPaymentTransactions.push({ scope: 'order', ...data });
                return { id: `pt-ord-${data.orderId}`, ...data };
            }),
            createAppointmentTransaction: jest.fn().mockImplementation(async (data) => {
                createdPaymentTransactions.push({ scope: 'appointment', ...data });
                return { id: `pt-appt-${data.appointmentId}`, ...data };
            })
        }));

        tenantPosController = require('../../controllers/tenantPosController');
    });

    afterEach(() => {
        jest.resetModules();
    });

    describe('1. POS Retail Product Checkout (Decision 4 - Product Sales)', () => {
        it('executes retail product purchase: creates Order, decrements stock, records Order payment transaction', async () => {
            const req = {
                tenantId: 'tenant-100',
                staffId: 'staff-001',
                body: {
                    customer: { platformUserId: 'user-001' },
                    items: [
                        { id: 'prod-001', type: 'product', quantity: 2, price: 150.00 }
                    ],
                    paymentMethod: 'card_pos'
                }
            };

            const jsonMock = jest.fn();
            const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
            const res = { status: statusMock, json: jsonMock };

            await tenantPosController.checkoutPos(req, res);

            expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
            expect(mockTransaction.rollback).not.toHaveBeenCalled();

            // Product inventory movement check
            expect(mockProduct.stock).toBe(18); // 20 - 2
            expect(mockProduct.soldCount).toBe(7); // 5 + 2
            expect(mockProduct.save).toHaveBeenCalled();

            // Order creation check
            expect(createdOrders).toHaveLength(1);
            expect(createdOrders[0].tenantId).toBe('tenant-100');
            expect(createdOrders[0].status).toBe('completed');
            expect(createdOrders[0].paymentStatus).toBe('paid');
            expect(createdOrders[0].deliveryType).toBe('pickup');
            expect(createdOrders[0].totalAmount).toBe(300.00); // 2 * 150

            // Order items check
            expect(createdOrderItems).toHaveLength(1);
            expect(createdOrderItems[0].productId).toBe('prod-001');
            expect(createdOrderItems[0].quantity).toBe(2);

            // Payment Transaction check
            expect(createdPaymentTransactions).toHaveLength(1);
            expect(createdPaymentTransactions[0].scope).toBe('order');
            expect(createdPaymentTransactions[0].orderId).toBe('order-uuid-101');
            expect(createdPaymentTransactions[0].amount).toBe(300.00);
            expect(createdPaymentTransactions[0].paymentMethod).toBe('card_pos');
            expect(createdPaymentTransactions[0].status).toBe('completed');

            // Customer invoice generation check
            expect(invoiceGenerations).toHaveLength(1);
            expect(invoiceGenerations[0].type).toBe('order');
            expect(invoiceGenerations[0].orderId).toBe('order-uuid-101');

            // Response check
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    order: expect.objectContaining({
                        orderNumber: 'ORD-2026-000101',
                        totalAmount: 300.00
                    }),
                    totals: expect.objectContaining({
                        totalAmount: 300.00
                    })
                })
            }));
        });

        it('rejects product checkout when requested quantity exceeds available stock', async () => {
            mockProduct.stock = 1; // Only 1 left

            const req = {
                tenantId: 'tenant-100',
                body: {
                    items: [
                        { id: 'prod-001', type: 'product', quantity: 5, price: 150.00 }
                    ]
                }
            };

            const jsonMock = jest.fn();
            const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
            const res = { status: statusMock, json: jsonMock };

            await tenantPosController.checkoutPos(req, res);

            expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
            expect(mockTransaction.commit).not.toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: expect.stringContaining('Insufficient stock')
            }));
        });
    });

    describe('2. POS Salon Service Checkout (Decision 4 - Service Sales)', () => {
        it('executes salon service checkout: creates Appointment, assigns staff, records Appointment payment transaction', async () => {
            const req = {
                tenantId: 'tenant-100',
                body: {
                    customer: { platformUserId: 'user-001' },
                    items: [
                        { id: 'srv-001', type: 'service', staffId: 'staff-001', price: 350.00 }
                    ],
                    paymentMethod: 'cash'
                }
            };

            const jsonMock = jest.fn();
            const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
            const res = { status: statusMock, json: jsonMock };

            await tenantPosController.checkoutPos(req, res);

            expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
            expect(mockTransaction.rollback).not.toHaveBeenCalled();

            // Appointment creation check
            expect(createdAppointments).toHaveLength(1);
            expect(createdAppointments[0].serviceId).toBe('srv-001');
            expect(createdAppointments[0].staffId).toBe('staff-001');
            expect(createdAppointments[0].status).toBe('completed');
            expect(createdAppointments[0].paymentStatus).toBe('fully_paid');
            expect(createdAppointments[0].totalPaid).toBe(350.00);
            expect(createdAppointments[0].remainderAmount).toBe(0);

            // Payment transaction check: strictly Appointment
            expect(createdPaymentTransactions).toHaveLength(1);
            expect(createdPaymentTransactions[0].scope).toBe('appointment');
            expect(createdPaymentTransactions[0].appointmentId).toBe('appt-uuid-201');
            expect(createdPaymentTransactions[0].amount).toBe(350.00);
            expect(createdPaymentTransactions[0].paymentMethod).toBe('cash');

            // Invoice check
            expect(invoiceGenerations).toHaveLength(1);
            expect(invoiceGenerations[0].type).toBe('appointment');
            expect(invoiceGenerations[0].appointmentId).toBe('appt-uuid-201');

            // Response check
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    appointments: expect.arrayContaining([
                        expect.objectContaining({
                            bookingNumber: 'BKG-2026-000201',
                            price: 350.00
                        })
                    ]),
                    totals: expect.objectContaining({
                        totalAmount: 350.00
                    })
                })
            }));
        });
    });

    describe('3. Combined Mixed Cart POS Checkout (Decision 4 - Combined Receipt, Preserved Ledger Separation)', () => {
        it('processes mixed cart atomically: creates both Order and Appointment while preserving separated ledger entries and returning a unified receipt', async () => {
            const req = {
                tenantId: 'tenant-100',
                staffId: 'staff-001',
                body: {
                    customer: { firstName: 'Sarah', phone: '+966599998888' },
                    items: [
                        { id: 'prod-001', type: 'product', quantity: 1, price: 150.00 },
                        { id: 'srv-001', type: 'service', staffId: 'staff-001', price: 350.00 }
                    ],
                    paymentMethod: 'mada',
                    discount: 50.00 // Promotional discount applied to total
                }
            };

            const jsonMock = jest.fn();
            const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
            const res = { status: statusMock, json: jsonMock };

            await tenantPosController.checkoutPos(req, res);

            expect(mockTransaction.commit).toHaveBeenCalledTimes(1);

            // 1. Separate Product Order was created
            expect(createdOrders).toHaveLength(1);
            expect(createdOrders[0].totalAmount).toBe(150.00);
            expect(mockProduct.stock).toBe(19);

            // 2. Separate Service Appointment was created
            expect(createdAppointments).toHaveLength(1);
            expect(createdAppointments[0].price).toBe(350.00);

            // 3. Underlying Payment Transactions strictly maintain entity separation
            expect(createdPaymentTransactions).toHaveLength(2);
            
            const productTx = createdPaymentTransactions.find(t => t.scope === 'order');
            const serviceTx = createdPaymentTransactions.find(t => t.scope === 'appointment');

            expect(productTx).toBeDefined();
            expect(productTx.orderId).toBe('order-uuid-101');
            expect(productTx.amount).toBe(150.00);
            expect(productTx.paymentMethod).toBe('card_pos'); // Mada mapped to card_pos

            expect(serviceTx).toBeDefined();
            expect(serviceTx.appointmentId).toBe('appt-uuid-201');
            expect(serviceTx.amount).toBe(350.00);
            expect(serviceTx.paymentMethod).toBe('card_pos');

            // 4. Combined receipt returned with single receipt reference and discounted net payable
            // Total = (150 + 350) - 50 discount = 450.00
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    receiptNumber: expect.stringMatching(/^POS-\d+/),
                    order: expect.objectContaining({
                        orderNumber: 'ORD-2026-000101',
                        totalAmount: 150.00
                    }),
                    appointments: expect.arrayContaining([
                        expect.objectContaining({
                            bookingNumber: 'BKG-2026-000201',
                            price: 350.00
                        })
                    ]),
                    totals: expect.objectContaining({
                        subtotal: expect.any(Number),
                        discount: 50.00,
                        totalAmount: 450.00
                    })
                })
            }));
        });
    });

    describe('4. Financial Reporting Separation Safeguards', () => {
        it('verifies BI sales overview maintains strict separation between services, products and gift cards', () => {
            const { buildSalesOverviewPayload } = require('../tenantBiSalesOverviewService');

            const mockFullReportData = {
                overview: {
                    totalRevenue: 5000.00,
                    operationalRevenue: 4500.00,
                    giftCardSales: 500.00,
                    businessRevenue: 5000.00
                },
                services: [
                    { id: 'srv-1', name_en: 'Haircut', totalRevenue: 3000.00 }
                ],
                products: [
                    { id: 'prod-1', name_en: 'Shampoo', totalRevenue: 1500.00 }
                ],
                productTotals: {
                    totalOrders: 10,
                    totalQuantity: 25,
                    totalRevenue: 1500.00
                },
                financialLedger: {
                    revenueLedger: { rows: [], totals: { revenue: 5000.00 } }
                }
            };

            const payload = buildSalesOverviewPayload(mockFullReportData, '2026-11-01', '2026-11-30');

            // Services must be reported exclusively under payload.services
            expect(payload.services).toBeDefined();
            expect(payload.services.revenue).toEqual(mockFullReportData.services);

            // Products must be reported exclusively under payload.products
            expect(payload.products).toBeDefined();
            expect(payload.products.revenue).toEqual(mockFullReportData.products);
            expect(payload.products.totals.totalRevenue).toBe(1500.00);

            // Gift cards isolated under finance.overview
            expect(payload.finance.overview.giftCardSales).toBe(500.00);
            expect(payload.finance.overview.operationalRevenue).toBe(4500.00);
            expect(payload.finance.overview.businessRevenue).toBe(5000.00);
        });
    });
});
