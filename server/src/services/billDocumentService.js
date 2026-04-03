const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('../models');
const { serializeBill, toNumber } = require('../utils/invoiceSnapshotBuilder');
const { generateZatcaQrImageBuffer } = require('../utils/zatcaInvoiceQr');

const uploadsRoot = path.resolve(__dirname, '../../uploads');
const billsRoot = path.join(uploadsRoot, 'bills');
const cairoFontPath = path.resolve(__dirname, '../templates/invoices/fonts/Cairo-Regular.ttf');
const logoFallbackPath = path.resolve(__dirname, '../templates/emails/RifahNewLogoWhite.png');

function ensureDirectory(directoryPath) {
    fs.mkdirSync(directoryPath, { recursive: true });
}

function normalizeRelativeUploadPath(relativePath) {
    if (!relativePath) return null;
    return relativePath
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/^uploads\//, '');
}

function resolveUploadPath(relativePath) {
    const normalizedRelativePath = normalizeRelativeUploadPath(relativePath);
    if (!normalizedRelativePath) return null;

    const absolutePath = path.resolve(uploadsRoot, normalizedRelativePath);
    if (!absolutePath.startsWith(uploadsRoot)) {
        return null;
    }

    return absolutePath;
}

function getDocumentPaths(bill, documentKind) {
    const tenantId = bill.tenantId || 'shared';
    const fileName = `${documentKind}-${bill.billNumber || bill.id}.pdf`;
    const relativePath = `/uploads/bills/${tenantId}/${fileName}`;
    const absolutePath = path.join(billsRoot, tenantId, fileName);
    return { relativePath, absolutePath };
}

function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-GB');
}

function formatDateTime(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

function formatMoney(amount, currency = 'SAR') {
    const numericAmount = toNumber(amount, 0);
    return `${numericAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })} ${currency}`;
}

function drawLabelValue(doc, x, y, width, labelAr, labelEn, value, options = {}) {
    const labelColor = options.labelColor || '#64748b';
    const valueColor = options.valueColor || '#0f172a';
    const labelSize = options.labelSize || 8;
    const valueSize = options.valueSize || 10;

    doc.fillColor(labelColor)
        .fontSize(labelSize)
        .text(`${labelAr} | ${labelEn}`, x, y, {
            width,
            align: 'right'
        });

    doc.fillColor(valueColor)
        .fontSize(valueSize)
        .text(value || '-', x, y + 13, {
            width,
            align: 'right'
        });
}

function getLogoPath(sellerSnapshot) {
    const logoPath = resolveUploadPath(sellerSnapshot?.logoPath);
    if (logoPath && fs.existsSync(logoPath)) {
        return logoPath;
    }

    if (fs.existsSync(logoFallbackPath)) {
        return logoFallbackPath;
    }

    return null;
}

function drawPageFrame(doc, bill, isPaidDocument) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    doc.rect(0, 0, pageWidth, 120).fill('#7C3AED');
    doc.rect(0, 120, pageWidth, pageHeight - 120).fill('#F8FAFC');

    const logoPath = getLogoPath(bill.sellerSnapshot);
    if (logoPath) {
        try {
            doc.image(logoPath, 48, 32, {
                fit: [88, 44]
            });
        } catch (error) {
            // Continue without logo if the image file cannot be decoded.
        }
    }

    doc.fillColor('#FFFFFF')
        .fontSize(18)
        .text(bill.invoiceTitle || 'Refah Invoice | فاتورة رفاه', 170, 36, {
            width: 350,
            align: 'right'
        });

    doc.fontSize(10)
        .text(`${bill.billNumber || '-'}`, 170, 66, {
            width: 350,
            align: 'right'
        });

    if (isPaidDocument) {
        doc.roundedRect(48, 78, 108, 28, 14).fill('#10B981');
        doc.fillColor('#FFFFFF')
            .fontSize(11)
            .text('PAID | مدفوعة', 56, 84, {
                width: 92,
                align: 'center'
            });
    }
}

function drawPartyCards(doc, bill) {
    const seller = bill.sellerSnapshot || {};
    const buyer = bill.buyerSnapshot || {};

    doc.roundedRect(36, 144, 250, 132, 16).fill('#FFFFFF').stroke('#E2E8F0');
    doc.roundedRect(310, 144, 250, 132, 16).fill('#FFFFFF').stroke('#E2E8F0');

    doc.fillColor('#7C3AED').fontSize(11).text('من Refah | From Refah', 52, 158, { width: 218, align: 'right' });
    doc.fillColor('#0F172A').fontSize(12).text(
        seller.sellerNameAr || seller.sellerNameEn || 'رفاه',
        52,
        180,
        { width: 218, align: 'right' }
    );
    doc.fillColor('#475569').fontSize(9).text(
        [
            seller.vatNumber ? `الرقم الضريبي | VAT: ${seller.vatNumber}` : null,
            seller.crNumber ? `السجل التجاري | CR: ${seller.crNumber}` : null,
            seller.addressAr || seller.addressEn || [seller.city, seller.country].filter(Boolean).join(', '),
            seller.email,
            seller.phone
        ].filter(Boolean).join('\n'),
        52,
        204,
        { width: 218, align: 'right', lineGap: 2 }
    );

    doc.fillColor('#EC4899').fontSize(11).text('إلى المركز | Bill To', 326, 158, { width: 218, align: 'right' });
    doc.fillColor('#0F172A').fontSize(12).text(
        buyer.businessNameAr || buyer.businessNameEn || '-',
        326,
        180,
        { width: 218, align: 'right' }
    );
    doc.fillColor('#475569').fontSize(9).text(
        [
            buyer.vatNumber ? `الرقم الضريبي | VAT: ${buyer.vatNumber}` : null,
            buyer.crNumber ? `السجل التجاري | CR: ${buyer.crNumber}` : null,
            buyer.addressAr || buyer.addressEn || [buyer.city, buyer.country].filter(Boolean).join(', '),
            buyer.email,
            buyer.phone
        ].filter(Boolean).join('\n'),
        326,
        204,
        { width: 218, align: 'right', lineGap: 2 }
    );
}

function drawInvoiceMeta(doc, bill) {
    doc.roundedRect(36, 292, 524, 84, 16).fill('#FFFFFF').stroke('#E2E8F0');

    drawLabelValue(doc, 376, 309, 160, 'تاريخ الإصدار', 'Issue Date', formatDate(bill.invoiceIssuedAt || bill.createdAt));
    drawLabelValue(doc, 212, 309, 140, 'تاريخ الاستحقاق', 'Due Date', formatDate(bill.dueDate));
    drawLabelValue(doc, 52, 309, 136, 'حالة الفاتورة', 'Invoice Status', `${bill.status || '-'}`);
    drawLabelValue(doc, 376, 341, 160, 'نوع الفاتورة', 'Invoice Type', `${bill.type || '-'}`);
    drawLabelValue(doc, 212, 341, 140, 'طريقة الدفع', 'Payment Method', bill.paymentMethod || '-');
    drawLabelValue(doc, 52, 341, 136, 'مرجع الدفع', 'Payment Ref.', bill.paymentReference || '-');
}

function drawLineItems(doc, bill) {
    const lineItem = Array.isArray(bill.lineItemsSnapshot) && bill.lineItemsSnapshot.length > 0
        ? bill.lineItemsSnapshot[0]
        : {};
    const planSnapshot = bill.planSnapshot || {};
    const description = [
        lineItem.descriptionAr || planSnapshot.packageNameAr,
        lineItem.descriptionEn || planSnapshot.packageName
    ].filter(Boolean).join(' | ') || 'Refah subscription package | باقة اشتراك رفاه';

    doc.roundedRect(36, 392, 524, 192, 16).fill('#FFFFFF').stroke('#E2E8F0');

    doc.rect(36, 392, 524, 36).fill('#F1F5F9');
    doc.fillColor('#475569').fontSize(9);
    doc.text('الإجمالي | Total', 48, 405, { width: 72, align: 'center' });
    doc.text('الضريبة | VAT', 122, 405, { width: 68, align: 'center' });
    doc.text('العمولة | Markup', 192, 405, { width: 74, align: 'center' });
    doc.text('قبل الضريبة | Subtotal', 268, 405, { width: 90, align: 'center' });
    doc.text('الفترة | Period', 360, 405, { width: 76, align: 'center' });
    doc.text('البند | Item', 438, 405, { width: 110, align: 'right' });

    doc.fillColor('#0F172A').fontSize(9);
    doc.text(formatMoney(lineItem.totalAmount ?? bill.totalAmount ?? bill.amount, bill.currency), 48, 446, { width: 72, align: 'center' });
    doc.text(
        `${formatMoney(lineItem.vatAmount ?? bill.vatAmount, bill.currency)}\n${toNumber(lineItem.vatRate ?? bill.vatRate, 0)}%`,
        122,
        440,
        { width: 68, align: 'center' }
    );
    doc.text(
        `${formatMoney(lineItem.platformMarkupAmount ?? bill.platformMarkupAmount, bill.currency)}\n${toNumber(lineItem.platformMarkupRate ?? bill.platformMarkupRate, 0)}%`,
        192,
        440,
        { width: 74, align: 'center' }
    );
    doc.text(formatMoney(lineItem.subtotalAmount ?? bill.subtotalAmount, bill.currency), 268, 446, { width: 90, align: 'center' });
    doc.text(
        `${formatDate(lineItem.periodStart || planSnapshot.periodStart)}\n${formatDate(lineItem.periodEnd || planSnapshot.periodEnd)}`,
        360,
        440,
        { width: 76, align: 'center' }
    );
    doc.text(description, 438, 438, {
        width: 110,
        align: 'right',
        lineGap: 3
    });

    const y = 528;
    drawLabelValue(doc, 394, y, 140, 'الإجمالي قبل الضريبة', 'Subtotal', formatMoney(bill.subtotalAmount, bill.currency));
    drawLabelValue(doc, 250, y, 120, 'قيمة ضريبة VAT', 'VAT Amount', formatMoney(bill.vatAmount, bill.currency));
    drawLabelValue(doc, 52, y, 176, 'الإجمالي النهائي', 'Grand Total', formatMoney(bill.totalAmount || bill.amount, bill.currency), {
        valueColor: '#7C3AED',
        valueSize: 12
    });
}

function drawZatcaQrPanel(doc, bill, qrImageBuffer) {
    const zatca = bill.metadata?.zatca || {};

    doc.roundedRect(36, 600, 524, 126, 16).fill('#FFFFFF').stroke('#E2E8F0');

    doc.fillColor('#7C3AED')
        .fontSize(11)
        .text('رمز QR للفاتورة | ZATCA QR Code', 178, 616, {
            width: 360,
            align: 'right'
        });

    doc.fillColor('#475569')
        .fontSize(8)
        .text(
            'جاهزية TLV للمرحلة الأولى فقط | Phase 1 TLV-ready metadata only',
            178,
            634,
            {
                width: 360,
                align: 'right'
            }
        );

    drawLabelValue(
        doc,
        366,
        654,
        172,
        'UUID الفاتورة',
        'Invoice UUID',
        zatca.invoiceUuid || bill.metadata?.invoiceUuid || '-',
        { labelSize: 7, valueSize: 8 }
    );
    drawLabelValue(
        doc,
        178,
        654,
        170,
        'وقت الإصدار',
        'Issue Timestamp',
        zatca.invoiceTimestamp || '-',
        { labelSize: 7, valueSize: 8 }
    );
    drawLabelValue(
        doc,
        178,
        686,
        360,
        'حالة تكامل ZATCA',
        'ZATCA Integration Status',
        zatca.clearanceStatus || 'not_integrated',
        { labelSize: 7, valueSize: 8 }
    );

    if (qrImageBuffer) {
        try {
            doc.image(qrImageBuffer, 56, 616, {
                fit: [96, 96]
            });
        } catch (error) {
            doc.fillColor('#DC2626')
                .fontSize(8)
                .text('QR unavailable', 56, 660, {
                    width: 96,
                    align: 'center'
                });
        }
    } else {
        doc.roundedRect(56, 618, 96, 96, 12).stroke('#CBD5E1');
        doc.fillColor('#64748B')
            .fontSize(8)
            .text('No QR payload', 64, 656, {
                width: 80,
                align: 'center'
            });
    }
}

function drawFooter(doc, bill) {
    const footerNote = [
        bill.sellerSnapshot?.footerNoteAr,
        bill.sellerSnapshot?.footerNoteEn
    ].filter(Boolean).join(' | ');

    doc.fillColor('#64748B')
        .fontSize(8)
        .text(
            footerNote || 'شكراً لاختياركم رفاه | Thank you for choosing Refah',
            36,
            786,
            {
                width: 524,
                align: 'center'
            }
        );
}

async function renderBillPdf(billRecord, documentKind = 'invoice') {
    const bill = serializeBill(billRecord, { includePaymentToken: true });
    const { relativePath, absolutePath } = getDocumentPaths(bill, documentKind);
    const qrImageBuffer = await generateZatcaQrImageBuffer(bill.metadata?.zatca?.qrPayload);

    ensureDirectory(path.dirname(absolutePath));

    await new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margin: 0,
            info: {
                Title: bill.invoiceTitle || bill.billNumber || 'Refah Invoice',
                Author: 'Refah',
                Subject: `${bill.billNumber || ''} ${bill.type || ''}`.trim()
            }
        });

        if (fs.existsSync(cairoFontPath)) {
            doc.registerFont('Cairo', cairoFontPath);
            doc.font('Cairo');
        }

        const output = fs.createWriteStream(absolutePath);
        doc.pipe(output);
        output.on('finish', resolve);
        output.on('error', reject);
        doc.on('error', reject);

        drawPageFrame(doc, bill, documentKind === 'receipt');
        drawPartyCards(doc, bill);
        drawInvoiceMeta(doc, bill);
        drawLineItems(doc, bill);
        drawZatcaQrPanel(doc, bill, qrImageBuffer);
        drawFooter(doc, bill);

        if (documentKind === 'receipt') {
            doc.fillColor('#10B981')
                .fontSize(10)
                .text(
                    `تم الدفع | Paid on ${formatDateTime(bill.paidAt)} | ${bill.paymentProvider || '-'} | ${bill.paymentReference || '-'}`,
                    36,
                    730,
                    {
                        width: 524,
                        align: 'center'
                    }
                );
        } else {
            doc.fillColor('#7C3AED')
                .fontSize(10)
                .text(
                    'يرجى سداد الفاتورة قبل تاريخ الاستحقاق | Please pay this invoice before the due date',
                    36,
                    730,
                    {
                        width: 524,
                        align: 'center'
                    }
                );
        }

        doc.end();
    });

    if (documentKind === 'receipt') {
        await db.Bill.update(
            { receiptPdfPath: relativePath },
            { where: { id: bill.id } }
        );
    } else {
        await db.Bill.update(
            { invoicePdfPath: relativePath },
            { where: { id: bill.id } }
        );
    }

    return {
        relativePath,
        absolutePath
    };
}

async function ensureInvoicePdf(billRecord) {
    const bill = billRecord?.toJSON ? billRecord : await db.Bill.findByPk(billRecord?.id || billRecord);
    if (!bill) return null;

    const existingPath = resolveUploadPath(bill.invoicePdfPath);
    if (existingPath && fs.existsSync(existingPath)) {
        return {
            relativePath: bill.invoicePdfPath,
            absolutePath: existingPath
        };
    }

    return renderBillPdf(bill, 'invoice');
}

async function ensureReceiptPdf(billRecord) {
    const bill = billRecord?.toJSON ? billRecord : await db.Bill.findByPk(billRecord?.id || billRecord);
    if (!bill) return null;

    if (bill.status !== 'PAID') {
        return null;
    }

    const existingPath = resolveUploadPath(bill.receiptPdfPath);
    if (existingPath && fs.existsSync(existingPath)) {
        return {
            relativePath: bill.receiptPdfPath,
            absolutePath: existingPath
        };
    }

    return renderBillPdf(bill, 'receipt');
}

module.exports = {
    ensureInvoicePdf,
    ensureReceiptPdf,
    renderBillPdf,
    resolveUploadPath
};
