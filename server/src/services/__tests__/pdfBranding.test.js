const fs = require('fs');
const path = require('path');
const db = require('../../models');
const { renderBillPdf } = require('../billDocumentService');
const { generateReportPdfBuffer, generateFallbackReportPdfBuffer, generateEmergencyReportPdfBuffer } = require('../tenantReportPdfService');

jest.mock('../../models', () => ({
    Bill: {
        update: jest.fn().mockResolvedValue([1]),
        findByPk: jest.fn()
    },
    GlobalSettings: {
        findOne: jest.fn().mockResolvedValue({
            invoiceSellerNameAr: 'بارسبا',
            invoiceSellerNameEn: 'BARSPA',
            invoiceVatNumber: '310123456700003',
            invoiceCrNumber: '1010123456',
            invoiceAddressAr: 'الرياض، المملكة العربية السعودية',
            invoiceAddressEn: 'Riyadh, Saudi Arabia',
            invoiceCity: 'Riyadh',
            invoiceCountry: 'Saudi Arabia',
            invoiceEmail: 'billing@barspa.com',
            invoicePhone: '+966500000000',
            invoicePrefix: 'INV',
            invoiceFooterNoteAr: 'شكراً لاختياركم بارسبا',
            invoiceFooterNoteEn: 'Thank you for choosing BARSPA',
            invoiceLogoPath: '/uploads/assets/barspalogo.png',
            taxRate: 15
        })
    }
}));

describe('PDF Branding & Generation Verification', () => {
    const testBill = {
        id: 'test-bill-barspa-001',
        tenantId: 'test-tenant-001',
        billNumber: 'INV-2026-0001',
        amount: 575.00,
        subtotalAmount: 500.00,
        vatAmount: 75.00,
        currency: 'SAR',
        status: 'PAID',
        paidAt: new Date().toISOString(),
        dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        invoiceIssuedAt: new Date().toISOString(),
        paymentProvider: 'card',
        paymentMethod: 'visa',
        paymentReference: 'TXN-BARSPA-12345',
        type: 'initial',
        sellerSnapshot: {
            sellerNameAr: 'بارسبا',
            sellerNameEn: 'BARSPA',
            vatNumber: '310123456700003',
            crNumber: '1010123456',
            addressAr: 'الرياض',
            addressEn: 'Riyadh',
            email: 'billing@barspa.com',
            phone: '+966500000000',
            logoPath: '/uploads/assets/barspalogo.png'
        },
        buyerSnapshot: {
            businessNameAr: 'صالون الأناقة',
            businessNameEn: 'Elegance Salon',
            vatNumber: '399999999900003',
            city: 'Riyadh',
            country: 'Saudi Arabia'
        },
        lineItemsSnapshot: [
            {
                descriptionAr: 'باقة اشتراك بارسبا الماسية',
                descriptionEn: 'BARSPA Diamond Subscription Package',
                totalAmount: 575.00,
                subtotalAmount: 500.00,
                vatAmount: 75.00,
                vatRate: 15,
                periodStart: '2026-01-01',
                periodEnd: '2026-02-01'
            }
        ],
        metadata: {
            zatca: {
                qrPayload: 'AQZCQVJTUEECEzMxMDEyMzQ1NjcwMDAwMxDTMjAyNi0xMC0wN1QwMDowMDowMFoFBDU3NS4wBgU3NS4w'
            }
        }
    };

    it('generates a BARSPA invoice PDF with BARSPA metadata and logo', async () => {
        const result = await renderBillPdf(testBill, 'invoice');
        expect(result).toHaveProperty('absolutePath');
        expect(fs.existsSync(result.absolutePath)).toBe(true);

        const pdfBuffer = fs.readFileSync(result.absolutePath);
        expect(pdfBuffer.length).toBeGreaterThan(5000);

        const rawContent = pdfBuffer.toString('binary');
        // Check PDF metadata
        expect(rawContent).toContain('BARSPA');
        expect(rawContent).not.toMatch(/\/Author \((?:Refah|Rifah)\)/);
        expect(rawContent).not.toMatch(/\/Title \((?:Refah|Rifah) Invoice\)/);

        // Clean up created test file
        try { fs.unlinkSync(result.absolutePath); } catch (_) {}
    });

    it('generates a BARSPA receipt PDF with status and footer', async () => {
        const result = await renderBillPdf(testBill, 'receipt');
        expect(result).toHaveProperty('absolutePath');
        expect(fs.existsSync(result.absolutePath)).toBe(true);

        const pdfBuffer = fs.readFileSync(result.absolutePath);
        expect(pdfBuffer.length).toBeGreaterThan(5000);

        const rawContent = pdfBuffer.toString('binary');
        expect(rawContent).toContain('BARSPA');

        try { fs.unlinkSync(result.absolutePath); } catch (_) {}
    });

    it('generates tenant reports containing BARSPA Reports branding', async () => {
        const reportPayload = {
            tenantName: 'BARSPA Salon',
            reportTitle: 'Monthly Performance',
            startDate: '2026-09-01',
            endDate: '2026-09-30',
            generatedAt: new Date().toISOString(),
            sections: ['overview'],
            data: {
                overview: {
                    totalRevenue: 5000,
                    netRevenue: 4500,
                    totalBookings: 50,
                    completedBookings: 48
                }
            }
        };

        const buffer = await generateReportPdfBuffer(reportPayload);
        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer.length).toBeGreaterThan(1000);

        const raw = buffer.toString('binary');
        expect(raw).toContain('BARSPA');
        expect(raw).not.toContain('Refah Reports');
    });

    it('generates report fallback and emergency buffers with BARSPA branding', async () => {
        const fallbackBuffer = await generateFallbackReportPdfBuffer({
            tenantName: 'BARSPA Salon',
            reportTitle: 'Fallback Overview',
            startDate: '2026-09-01',
            endDate: '2026-09-30',
            generatedAt: new Date().toISOString(),
            sections: ['overview'],
            errorMessage: 'Test error'
        });
        expect(Buffer.isBuffer(fallbackBuffer)).toBe(true);
        const fallbackRaw = fallbackBuffer.toString('binary');
        expect(fallbackRaw).toContain('BARSPA');
        expect(fallbackRaw).not.toContain('Refah Report');

        const emergencyBuffer = await generateEmergencyReportPdfBuffer({
            tenantName: 'BARSPA Salon',
            reportTitle: 'Emergency Overview',
            startDate: '2026-09-01',
            endDate: '2026-09-30',
            generatedAt: new Date().toISOString(),
            sections: ['overview'],
            errorMessage: 'Test emergency'
        });
        expect(Buffer.isBuffer(emergencyBuffer)).toBe(true);
        const emergencyRaw = emergencyBuffer.toString('binary');
        expect(emergencyRaw).toContain('BARSPA');
        expect(emergencyRaw).not.toContain('Refah Report');
    });
});
