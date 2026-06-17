const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('../models');

const uploadsRoot = path.resolve(__dirname, '../../uploads');
const invoicesRoot = path.join(uploadsRoot, 'customer-invoices');

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
    if (!absolutePath.startsWith(uploadsRoot)) return null;
    return absolutePath;
}

function formatMoney(value, currency = 'SAR') {
    const amount = Number(value || 0);
    const safe = Number.isFinite(amount) ? amount : 0;
    return `${safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatDateTime(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function getDocumentPaths(invoice, kind) {
    const tenantId = invoice.tenantId || 'shared';
    const safeNumber = `${invoice.invoiceNumber || invoice.id}`.replace(/[^a-zA-Z0-9-_]/g, '_');
    const fileName = `${kind}-${safeNumber}.pdf`;
    const relativePath = `/uploads/customer-invoices/${tenantId}/${fileName}`;
    const absolutePath = path.join(invoicesRoot, tenantId, fileName);
    return { relativePath, absolutePath };
}

async function renderCustomerInvoicePdf(invoiceRecord, kind = 'invoice') {
    const invoice = invoiceRecord?.toJSON ? invoiceRecord : invoiceRecord;
    const { relativePath, absolutePath } = getDocumentPaths(invoice, kind);
    ensureDirectory(path.dirname(absolutePath));

    const loadedInvoice = await db.CustomerInvoice.findByPk(invoice.id, {
        include: [
            { model: db.CustomerInvoiceItem, as: 'items', required: false },
            { model: db.PlatformUser, as: 'platformUser', required: false },
            { model: db.Tenant, as: 'tenant', required: false }
        ]
    });

    const rows = loadedInvoice?.items || [];
    const tenantName = loadedInvoice?.tenant?.name || loadedInvoice?.tenant?.name_en || loadedInvoice?.tenant?.name_ar || '-';
    const customerName = `${loadedInvoice?.platformUser?.firstName || ''} ${loadedInvoice?.platformUser?.lastName || ''}`.trim() || '-';
    const currency = loadedInvoice?.currency || 'SAR';

    await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const output = fs.createWriteStream(absolutePath);
        doc.pipe(output);
        output.on('finish', resolve);
        output.on('error', reject);
        doc.on('error', reject);

        const pageWidth = doc.page.width;
        const margin = 40;
        const accent = '#7c3aed';
        const accentSoft = '#f5f3ff';
        const text = '#111827';
        const muted = '#6b7280';
        const border = '#e5e7eb';

        const drawCard = (x, y, w, h, title, lines = []) => {
            doc.roundedRect(x, y, w, h, 16).fillAndStroke('#ffffff', border);
            doc.fillColor(muted).fontSize(8).font('Helvetica-Bold').text(title.toUpperCase(), x + 14, y + 12, { width: w - 28 });
            doc.fillColor(text).fontSize(10).font('Helvetica');
            let offsetY = y + 30;
            lines.forEach((line) => {
                doc.text(line, x + 14, offsetY, { width: w - 28 });
                offsetY += 14;
            });
        };

        const drawPill = (x, y, label, fill = accentSoft, color = accent) => {
            const width = Math.max(66, doc.widthOfString(label, { font: 'Helvetica-Bold', size: 9 }) + 22);
            doc.roundedRect(x, y, width, 24, 12).fillAndStroke(fill, fill);
            doc.fillColor(color).fontSize(9).font('Helvetica-Bold').text(label, x, y + 7, { width, align: 'center' });
            return width;
        };

        doc.rect(0, 0, pageWidth, 118).fill(accent);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text(kind === 'receipt' ? 'Payment Receipt' : 'Invoice', margin, 28);
        doc.fillColor('#ede9fe').font('Helvetica').fontSize(10).text(`Invoice #: ${loadedInvoice.invoiceNumber}`, margin, 60);
        doc.fillColor('#ede9fe').text(`Issued at: ${formatDateTime(loadedInvoice.issuedAt)}`, margin, 76);
        if (loadedInvoice.paidAt) {
            doc.fillColor('#ede9fe').text(`Paid at: ${formatDateTime(loadedInvoice.paidAt)}`, margin, 92);
        }
        drawPill(pageWidth - margin - 120, 34, loadedInvoice.status || 'DRAFT', '#ffffff', accent);

        const infoTop = 144;
        const infoCardWidth = (pageWidth - (margin * 2) - 12) / 2;
        drawCard(margin, infoTop, infoCardWidth, 90, 'Tenant', [
            tenantName,
            loadedInvoice?.tenant?.city ? `City: ${loadedInvoice.tenant.city}` : `Currency: ${currency}`
        ]);
        drawCard(margin + infoCardWidth + 12, infoTop, infoCardWidth, 90, 'Customer', [
            customerName,
            loadedInvoice?.platformUser?.email ? `Email: ${loadedInvoice.platformUser.email}` : '-',
            loadedInvoice?.platformUser?.phone ? `Phone: ${loadedInvoice.platformUser.phone}` : '-'
        ]);

        let cursorY = infoTop + 116;
        doc.fillColor(text).font('Helvetica-Bold').fontSize(12).text('Items', margin, cursorY);
        cursorY += 18;
        doc.moveTo(margin, cursorY).lineTo(pageWidth - margin, cursorY).strokeColor(border).stroke();
        cursorY += 10;

        if (rows.length === 0) {
            doc.fillColor(muted).font('Helvetica').fontSize(10).text('No line items', margin, cursorY);
            cursorY += 18;
        } else {
            rows.forEach((item, index) => {
                const name = item.nameEn || item.nameAr || `Item ${index + 1}`;
                const qty = Number(item.quantity || 1);
                const unit = formatMoney(item.unitPrice, currency);
                const total = formatMoney(item.lineTotal, currency);
                const rowHeight = 42;
                doc.roundedRect(margin, cursorY, pageWidth - (margin * 2), rowHeight, 12).fillAndStroke('#ffffff', border);
                doc.fillColor(text).font('Helvetica-Bold').fontSize(10).text(name, margin + 12, cursorY + 10, { width: 220 });
                doc.fillColor(muted).font('Helvetica').fontSize(9).text(`Qty ${qty}`, margin + 250, cursorY + 10);
                doc.text(`Unit ${unit}`, margin + 310, cursorY + 10);
                doc.fillColor(accent).font('Helvetica-Bold').text(total, pageWidth - margin - 110, cursorY + 10, { width: 100, align: 'right' });
                cursorY += rowHeight + 8;
            });
        }

        cursorY += 6;
        const summaryWidth = 220;
        const summaryX = pageWidth - margin - summaryWidth;
        doc.roundedRect(summaryX, cursorY, summaryWidth, 150, 16).fillAndStroke(accentSoft, border);
        doc.fillColor(text).font('Helvetica-Bold').fontSize(11).text('Summary', summaryX + 14, cursorY + 14);

        const summaryRows = [
            ['Subtotal', formatMoney(loadedInvoice.subtotalAmount, currency)],
            ['VAT', formatMoney(loadedInvoice.vatAmount, currency)],
            ['Total', formatMoney(loadedInvoice.totalAmount, currency)],
            ['Paid', formatMoney(loadedInvoice.paidAmount, currency)],
            ['Due', formatMoney(loadedInvoice.dueAmount, currency)],
        ];

        let summaryY = cursorY + 34;
        summaryRows.forEach(([label, value], index) => {
            const isTotal = index === 2;
            doc.fillColor(isTotal ? accent : muted)
                .font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(isTotal ? 11 : 9)
                .text(label, summaryX + 14, summaryY, { width: 100 });
            doc.fillColor(isTotal ? text : text)
                .font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(isTotal ? 11 : 9)
                .text(value, summaryX + 116, summaryY, { width: 90, align: 'right' });
            summaryY += isTotal ? 24 : 18;
            if (isTotal) {
                doc.moveTo(summaryX + 14, summaryY - 2).lineTo(summaryX + summaryWidth - 14, summaryY - 2).strokeColor(border).stroke();
            }
        });

        const footerY = Math.max(cursorY + 170, 730);
        doc.moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).strokeColor(border).stroke();
        doc.fillColor(muted).font('Helvetica').fontSize(8)
            .text('Generated by Refah platform', margin, footerY + 10, { align: 'center', width: pageWidth - (margin * 2) });
        doc.end();
    });

    if (kind === 'receipt') {
        await db.CustomerInvoice.update({ receiptPdfPath: relativePath }, { where: { id: invoice.id } });
    } else {
        await db.CustomerInvoice.update({ invoicePdfPath: relativePath }, { where: { id: invoice.id } });
    }

    return { relativePath, absolutePath };
}

async function ensureCustomerInvoicePdf(invoiceRecord) {
    const invoice = invoiceRecord?.toJSON ? invoiceRecord : await db.CustomerInvoice.findByPk(invoiceRecord?.id || invoiceRecord);
    if (!invoice) return null;

    const existingPath = resolveUploadPath(invoice.invoicePdfPath);
    if (existingPath && fs.existsSync(existingPath)) {
        return { relativePath: invoice.invoicePdfPath, absolutePath: existingPath };
    }
    return renderCustomerInvoicePdf(invoice, 'invoice');
}

async function ensureCustomerReceiptPdf(invoiceRecord) {
    const invoice = invoiceRecord?.toJSON ? invoiceRecord : await db.CustomerInvoice.findByPk(invoiceRecord?.id || invoiceRecord);
    if (!invoice) return null;

    if (!['PAID', 'PARTIALLY_PAID', 'REFUNDED'].includes(invoice.status)) {
        return null;
    }

    const existingPath = resolveUploadPath(invoice.receiptPdfPath);
    if (existingPath && fs.existsSync(existingPath)) {
        return { relativePath: invoice.receiptPdfPath, absolutePath: existingPath };
    }
    return renderCustomerInvoicePdf(invoice, 'receipt');
}

module.exports = {
    ensureCustomerInvoicePdf,
    ensureCustomerReceiptPdf,
    renderCustomerInvoicePdf,
    resolveUploadPath
};
