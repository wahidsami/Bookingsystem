const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const uploadsRoot = path.resolve(__dirname, '../../uploads');
const refahLogoFallbackPath = path.resolve(__dirname, '../templates/emails/RifahNewLogoWhite.png');

function sanitizeFileNamePart(value, fallback = 'report') {
    return `${value || fallback}`
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || fallback;
}

function resolveUploadPath(relativePath) {
    if (!relativePath) return null;
    const normalized = `${relativePath}`
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/^uploads\//, '');
    const absolute = path.resolve(uploadsRoot, normalized);
    if (!absolute.startsWith(uploadsRoot)) return null;
    return absolute;
}

function formatMoney(value) {
    const amount = Number(value || 0);
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}

function drawCover(doc, payload) {
    const { tenantName, reportTitle, startDate, endDate, generatedAt, tenantLogoPath } = payload;

    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#F8FAFC');
    doc.rect(0, 0, doc.page.width, 180).fill('#7C3AED');

    if (fs.existsSync(refahLogoFallbackPath)) {
        try {
            doc.image(refahLogoFallbackPath, 50, 40, { fit: [130, 56] });
        } catch (_) {}
    }

    if (tenantLogoPath && fs.existsSync(tenantLogoPath)) {
        try {
            doc.image(tenantLogoPath, doc.page.width - 180, 36, { fit: [120, 60] });
        } catch (_) {}
    }

    doc.fillColor('#FFFFFF').fontSize(28).text('Refah Reports', 50, 100, { align: 'left' });

    doc.fillColor('#0F172A').fontSize(30).text(reportTitle || 'Business Report', 50, 240);
    doc.moveDown(0.4);
    doc.fontSize(16).fillColor('#334155').text(tenantName || 'Tenant');
    doc.moveDown(0.8);
    doc.fontSize(13).fillColor('#475569').text(`Period: ${startDate} -> ${endDate}`);
    doc.fontSize(13).fillColor('#475569').text(`Generated at: ${generatedAt}`);
}

function drawSectionTitle(doc, title) {
    if (doc.y > 700) doc.addPage();
    doc.moveDown(1);
    doc.fillColor('#111827').fontSize(18).text(title);
    doc.moveDown(0.4);
}

function drawKeyValueGrid(doc, rows) {
    rows.forEach(([label, value]) => {
        if (doc.y > 740) doc.addPage();
        doc.fontSize(11).fillColor('#6B7280').text(label, 56, doc.y, { continued: true });
        doc.fillColor('#111827').text(`  ${value}`);
        doc.moveDown(0.2);
    });
}

function drawSimpleTable(doc, title, columns, rows) {
    drawSectionTitle(doc, title);
    if (!rows || rows.length === 0) {
        doc.fontSize(11).fillColor('#6B7280').text('No data in selected period.');
        return;
    }

    const tableX = 56;
    const tableWidth = 500;
    const colWidth = Math.floor(tableWidth / columns.length);
    let y = doc.y;

    doc.rect(tableX, y, tableWidth, 24).fill('#EEF2FF');
    columns.forEach((col, idx) => {
        doc.fillColor('#334155').fontSize(10).text(col, tableX + idx * colWidth + 6, y + 7, { width: colWidth - 12 });
    });
    y += 24;

    rows.slice(0, 80).forEach((row) => {
        if (y > 760) {
            doc.addPage();
            y = 56;
        }
        doc.rect(tableX, y, tableWidth, 22).stroke('#E5E7EB');
        row.forEach((cell, idx) => {
            doc.fillColor('#111827').fontSize(9).text(`${cell ?? '-'}`, tableX + idx * colWidth + 6, y + 6, { width: colWidth - 12 });
        });
        y += 22;
    });

    doc.y = y + 4;
}

function generateReportPdfBuffer(payload) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        drawCover(doc, payload);
        doc.addPage();

        const overview = payload.data?.overview;
        if (overview) {
            drawSectionTitle(doc, 'Overview');
            drawKeyValueGrid(doc, [
                ['Total Revenue', formatMoney(overview.totalRevenue)],
                ['Tenant Revenue', formatMoney(overview.totalTenantRevenue)],
                ['Net Revenue', formatMoney(overview.netRevenue)],
                ['Total Bookings', overview.totalBookings || 0],
                ['Completed Bookings', overview.completedBookings || 0],
                ['Cancelled Bookings', overview.cancelledBookings || 0],
                ['No-show Bookings', overview.noShowBookings || 0],
                ['Unique Customers', overview.uniqueCustomers || 0],
            ]);
        }

        if (Array.isArray(payload.data?.employees)) {
            drawSimpleTable(
                doc,
                'Employee Revenue',
                ['Employee', 'Bookings', 'Revenue', 'Commission'],
                payload.data.employees.map((e) => [
                    e.name,
                    e.totalBookings ?? 0,
                    formatMoney(e.totalRevenueGenerated),
                    formatMoney(e.totalCommission),
                ])
            );
        }

        if (Array.isArray(payload.data?.services)) {
            drawSimpleTable(
                doc,
                'Service Revenue',
                ['Service', 'Bookings', 'Revenue', 'Tenant Revenue'],
                payload.data.services.map((s) => [
                    s.name_en || s.name_ar,
                    s.totalBookings ?? 0,
                    formatMoney(s.totalRevenue),
                    formatMoney(s.totalTenantRevenue),
                ])
            );
        }

        if (Array.isArray(payload.data?.products)) {
            drawSimpleTable(
                doc,
                'Product Revenue',
                ['Product', 'Orders', 'Quantity', 'Revenue'],
                payload.data.products.map((p) => [
                    p.name_en || p.name_ar,
                    p.totalOrders ?? 0,
                    p.totalQuantity ?? 0,
                    formatMoney(p.totalRevenue),
                ])
            );
        }

        doc.end();
    });
}

module.exports = {
    generateReportPdfBuffer,
    resolveUploadPath,
    sanitizeFileNamePart,
};

