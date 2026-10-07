const fs = require('fs');
const path = require('path');

let mockSend = jest.fn();

jest.mock('resend', () => {
    return {
        Resend: jest.fn().mockImplementation(() => ({
            emails: {
                send: mockSend
            }
        }))
    };
});

const emailService = require('../emailService');

describe('BARSPA Email Rebranding & Template Verification', () => {
    const templatesDir = path.resolve(__dirname, '../../templates/emails');
    const templateFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.html'));

    beforeEach(() => {
        mockSend.mockReset();
        process.env.RESEND_API_KEY = 're_test_mock_key';
        process.env.RESEND_FROM_EMAIL = 'OldRifahStaff <noreply@unifinitylab.com>';
    });

    test('All templates should exist and have zero old branding in raw source', () => {
        const forbiddenPatterns = [
            { name: 'Refah', regex: /\bRefah\b/i },
            { name: 'Rifah', regex: /\bRifah\b/i },
            { name: 'Arabic Refah', regex: /رفاه/ }
        ];

        templateFiles.forEach(fileName => {
            const filePath = path.join(templatesDir, fileName);
            const content = fs.readFileSync(filePath, 'utf8');

            forbiddenPatterns.forEach(({ name, regex }) => {
                const match = content.match(regex);
                expect(match ? `${fileName} contains ${name}: ${match[0]}` : null).toBeNull();
            });
        });
    });

    test('All templates render cleanly without error and contain no old branding', async () => {
        const sampleData = {
            tenantName: 'BarSpa Salon',
            tenantNameAr: 'صالون بارسبا',
            customerName: 'Ahmad User',
            email: 'customer@example.com',
            invoiceNumber: 'INV-2026-001',
            invoiceStatus: 'PAID',
            packageName: 'Growth Package',
            billingCycle: 'Monthly',
            totalAmountText: '500.00 SAR',
            subtotalAmountText: '434.78 SAR',
            vatAmountText: '65.22 SAR',
            paidAmountText: '500.00 SAR',
            dueAmountText: '0.00 SAR',
            paymentDueText: '10 Oct 2026',
            paidDateText: '08 Oct 2026',
            periodStartText: '01 Oct 2026',
            periodEndText: '31 Oct 2026',
            loginUrl: 'https://rtenantv2.unifinitylab.com/login',
            paymentUrl: 'https://rapi.unifinitylab.com/pay',
            invoicePdfUrl: 'https://rapi.unifinitylab.com/invoice.pdf',
            receiptPdfUrl: 'https://rapi.unifinitylab.com/receipt.pdf',
            staffName: 'Staff Member',
            temporaryPassword: 'TempPassword123!',
            serviceName: 'Haircut',
            appointmentDate: '10 Oct 2026, 3:00 PM',
            previousAppointmentDate: '09 Oct 2026, 2:00 PM',
            newStaffName: 'Stylist Jane',
            oldStaffName: 'Stylist John',
            bookingReference: 'BK-12345',
            previousStatus: 'Confirmed',
            currentStatus: 'Completed',
            reviewLink: 'https://rapi.unifinitylab.com/review',
            googleReviewUrl: 'https://maps.google.com',
            title: 'Order Status Update',
            body: 'Your booking has been updated.',
            orderNumber: 'ORD-999',
            deliveryMethodText: 'Home Delivery',
            statusTextBilingual: 'Delivered | تم التوصيل',
            trackingSectionHtml: '<div>Tracking: TRK-123</div>',
            pickupSectionHtml: '',
            actionHtml: '<a href="#">Action</a>',
            greeting: 'Hello',
            message: 'Your account needs attention.',
            reportTitle: 'Monthly Sales Report',
            generatedAt: '08 Oct 2026, 12:00 PM',
            summaryLine: 'Total: 10,000 SAR',
            rowCount: '50',
            recordCount: '50',
            dashboardUrl: 'https://radmin.unifinitylab.com',
            briefingTitle: 'Executive Summary',
            summaryHtml: '<p>Good health</p>',
            healthScore: '95',
            kpiHtml: '<div>KPIs</div>',
            alertsHtml: '<div>No alerts</div>',
            recommendationsHtml: '<div>Keep going</div>',
            actionsHtml: '<div>Take action</div>',
            periodLine: 'October 2026',
            resetUrl: 'https://rtenantv2.unifinitylab.com/reset',
            expiresInMinutes: '60',
            reason: 'Missing tax document',
            resubmitUrl: 'https://rtenantv2.unifinitylab.com/resubmit'
        };

        templateFiles.forEach(fileName => {
            const templatePath = path.join(templatesDir, fileName);
            let html = fs.readFileSync(templatePath, 'utf8');

            Object.keys(sampleData).forEach(k => {
                html = html.replace(new RegExp(`{{${k}}}`, 'g'), sampleData[k]);
            });

            expect(html).not.toMatch(/\bRefah\b/i);
            expect(html).not.toMatch(/\bRifah\b/i);
            expect(html).toBeDefined();
        });
    });

    test('BRAND_IDENTITY exports correct values', () => {
        expect(emailService.BRAND_IDENTITY.name).toBe('BARSPA');
        expect(emailService.BRAND_IDENTITY.nameAr).toBe('BARSPA');
        expect(emailService.BRAND_IDENTITY.logoFileName).toBe('barspalogo.png');
    });

    test('BARSPA logo asset exists in root, templates, and uploads', () => {
        const rootLogo = path.resolve(__dirname, '../../../../barspalogo.png');
        const templateLogo = path.resolve(__dirname, '../../templates/emails/barspalogo.png');
        const uploadsLogo = path.resolve(__dirname, '../../../uploads/assets/barspalogo.png');

        expect(fs.existsSync(rootLogo)).toBe(true);
        expect(fs.existsSync(templateLogo)).toBe(true);
        expect(fs.existsSync(uploadsLogo)).toBe(true);

        const rootSize = fs.statSync(rootLogo).size;
        expect(rootSize).toBeGreaterThan(100000);
        expect(fs.statSync(templateLogo).size).toBe(rootSize);
        expect(fs.statSync(uploadsLogo).size).toBe(rootSize);
    });

    test('sendEmail formats sender display name as BARSPA and attaches logo', async () => {
        let capturedPayload = null;
        mockSend.mockImplementation(async (payload) => {
            capturedPayload = payload;
            return { data: { id: 'msg_123' }, error: null };
        });

        const result = await emailService.sendWelcomeEmail({
            email: 'newtenant@example.com',
            name_en: 'New Salon',
            name_ar: 'صالون جديد'
        });

        expect(result.success).toBe(true);
        expect(capturedPayload).toBeDefined();
        expect(capturedPayload.from).toBe('BARSPA <noreply@unifinitylab.com>');
        expect(capturedPayload.subject).toContain('BARSPA');
        expect(capturedPayload.subject).not.toMatch(/\bRefah\b/i);
        expect(capturedPayload.subject).not.toMatch(/\bRifah\b/i);
        expect(capturedPayload.html).toContain('cid:logo');
        expect(capturedPayload.html).not.toMatch(/\bRefah\b/i);
        expect(capturedPayload.html).not.toMatch(/\bRifah\b/i);

        const logoAttachment = capturedPayload.attachments.find(a => a.inlineContentId === 'logo');
        expect(logoAttachment).toBeDefined();
        expect(logoAttachment.filename).toBe('barspalogo.png');
    });

    test('sendApprovalEmail and sendPaymentReminderEmail use BARSPA subjects in Arabic and English', async () => {
        let capturedPayload = null;
        mockSend.mockImplementation(async (payload) => {
            capturedPayload = payload;
            return { data: { id: 'msg_456' }, error: null };
        });

        // Test English approval
        await emailService.sendApprovalEmail({
            email: 'tenant_en@example.com',
            name_en: 'En Salon',
            settings: { language: 'en' }
        }, { isFree: true });

        expect(capturedPayload.subject).toBe('BARSPA account approved');
        expect(capturedPayload.from).toBe('BARSPA <noreply@unifinitylab.com>');

        // Test Arabic approval
        await emailService.sendApprovalEmail({
            email: 'tenant_ar@example.com',
            name_ar: 'صالون عربي',
            settings: { language: 'ar' }
        }, { isFree: true });

        expect(capturedPayload.subject).toBe('تم قبول حساب BARSPA');

        // Test Arabic payment reminder
        await emailService.sendPaymentReminderEmail({
            email: 'tenant_ar@example.com',
            name_ar: 'صالون عربي',
            settings: { language: 'ar' }
        }, { bill: { billNumber: 'BILL-100' } });

        expect(capturedPayload.subject).toBe('BARSPA - تذكير بسداد الفاتورة BILL-100');
    });
});
