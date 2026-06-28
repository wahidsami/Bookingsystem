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

function drawGenericTable(doc, title, columns, rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return;
    }

    drawSimpleTable(doc, title, columns, rows);
}

function toMoney(value) {
    return formatMoney(value);
}

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function safePlainClone(value) {
    try {
        return JSON.parse(JSON.stringify(value ?? {}));
    } catch (_) {
        return {};
    }
}

function generateReportPdfBuffer(payload) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        try {
            const data = payload?.data || {};

            drawCover(doc, payload);
            doc.addPage();

            const overview = data.overview;
            if (overview) {
                drawSectionTitle(doc, 'Overview');
                drawKeyValueGrid(doc, [
                    ['Total Revenue', toMoney(overview.totalRevenue)],
                    ['Tenant Revenue', toMoney(overview.totalTenantRevenue)],
                    ['Net Revenue', toMoney(overview.netRevenue)],
                    ['Total Bookings', overview.totalBookings || 0],
                    ['Completed Bookings', overview.completedBookings || 0],
                    ['Cancelled Bookings', overview.cancelledBookings || 0],
                    ['No-show Bookings', overview.noShowBookings || 0],
                    ['Unique Customers', overview.uniqueCustomers || 0],
                ]);
            }

            if (data.dailyRevenue?.length) {
                drawGenericTable(
                    doc,
                    'Daily Revenue',
                    ['Date', 'Bookings', 'Orders', 'Revenue', 'Tenant Revenue'],
                    data.dailyRevenue.map((row) => [
                        row.date || '-',
                        row.bookings ?? 0,
                        row.orders ?? 0,
                        toMoney(row.revenue),
                        toMoney(row.tenantRevenue),
                    ])
                );
            }

            if (data.bookingTrends?.length) {
                drawGenericTable(
                    doc,
                    'Booking Trends',
                    ['Date', 'Bookings', 'Completed', 'Revenue'],
                    data.bookingTrends.map((row) => [
                        row.date || '-',
                        row.bookings ?? 0,
                        row.completed ?? 0,
                        toMoney(row.revenue),
                    ])
                );
            }

            if (data.paymentMethods?.rows?.length) {
                drawGenericTable(
                    doc,
                    'Payment Methods',
                    ['Method', 'Revenue', 'Transactions'],
                    data.paymentMethods.rows.map((row) => [
                        row.paymentMethodLabel || row.paymentMethod || '-',
                        toMoney(row.revenue),
                        row.transactionCount ?? 0,
                    ])
                );
            }

            if (data.refunds?.rows?.length) {
                drawGenericTable(
                    doc,
                    'Refunds',
                    ['Date', 'Customer', 'Reference', 'Amount', 'Method'],
                    data.refunds.rows.map((row) => [
                        row.date ? new Date(row.date).toLocaleDateString('en-GB') : '-',
                        row.customer || '-',
                        row.reference || '-',
                        toMoney(row.amount),
                        row.paymentMethodLabel || '-',
                    ])
                );
            }

            if (data.customerSales?.rows?.length) {
                drawGenericTable(
                    doc,
                    'Customer Sales',
                    ['Customer', 'Bookings', 'Completed', 'Revenue'],
                    data.customerSales.rows.map((row) => [
                        row.customerName || row.customer || row.name || '-',
                        row.bookings ?? 0,
                        row.completed ?? 0,
                        toMoney(row.revenue),
                    ])
                );
            }

            if (data.rebookings?.rows?.length) {
                drawGenericTable(
                    doc,
                    'Rebookings',
                    ['Date', 'Customer', 'Reference', 'Revenue'],
                    data.rebookings.rows.map((row) => [
                        row.date ? new Date(row.date).toLocaleDateString('en-GB') : '-',
                        row.customer || row.customerName || '-',
                        row.reference || '-',
                        toMoney(row.revenue ?? row.amount),
                    ])
                );
            }

            if (data.discounts) {
                const discounts = data.discounts;
                drawSectionTitle(doc, 'Discounts');
                drawKeyValueGrid(doc, [
                    ['Total Discounts', toMoney(discounts.totalDiscountAmount)],
                    ['Booking Discounts', toMoney(discounts.appointmentDiscountAmount)],
                    ['Order Discounts', toMoney(discounts.orderDiscountAmount)],
                    ['Average Discount', toMoney(discounts.averageDiscountAmount)],
                ]);

                drawGenericTable(
                    doc,
                    'Top Discounted Services',
                    ['Service', 'Bookings', 'Discount'],
                    safeArray(discounts.topDiscountedServices).map((service) => [
                        service.name_en || service.name_ar || '-',
                        service.bookingCount ?? 0,
                        toMoney(service.discountAmount),
                    ])
                );

                drawGenericTable(
                    doc,
                    'Top Discounted Orders',
                    ['Order', 'Base Amount', 'Discount'],
                    safeArray(discounts.topDiscountedOrders).map((order) => [
                        order.orderNumber || order.id || '-',
                        toMoney(order.baseAmount),
                        toMoney(order.discountAmount),
                    ])
                );
            }

            drawGenericTable(
                doc,
                'Employee Revenue',
                ['Employee', 'Bookings', 'Revenue', 'Commission'],
                safeArray(data.employees).map((e) => [
                    e.name || '-',
                    e.totalBookings ?? 0,
                    toMoney(e.totalRevenueGenerated ?? e.revenue),
                    toMoney(e.totalCommission),
                ])
            );

            drawGenericTable(
                doc,
                'Service Revenue',
                ['Service', 'Bookings', 'Revenue', 'Tenant Revenue'],
                safeArray(data.services).map((s) => [
                    s.name_en || s.name_ar || '-',
                    s.totalBookings ?? 0,
                    toMoney(s.totalRevenue),
                    toMoney(s.totalTenantRevenue),
                ])
            );

            drawGenericTable(
                doc,
                'Product Revenue',
                ['Product', 'Orders', 'Quantity', 'Revenue'],
                safeArray(data.products).map((p) => [
                    p.name_en || p.name_ar || '-',
                    p.totalOrders ?? 0,
                    p.totalQuantity ?? 0,
                    toMoney(p.totalRevenue),
                ])
            );

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

function generateFallbackReportPdfBuffer(payload) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        try {
            drawCover(doc, payload);
            doc.addPage();
            drawSectionTitle(doc, 'Report summary');
            drawKeyValueGrid(doc, [
                ['Tenant', payload.tenantName || 'Tenant'],
                ['Report', payload.reportTitle || 'Business Report'],
                ['Period', `${payload.startDate || '-'} -> ${payload.endDate || '-'}`],
                ['Generated at', payload.generatedAt || '-'],
                ['Selected sections', Array.isArray(payload.sections) ? payload.sections.join(', ') : '-'],
            ]);
            if (payload.errorMessage) {
                drawSectionTitle(doc, 'Export notice');
                doc.fontSize(11).fillColor('#6B7280').text(
                    `The report data loaded, but PDF rendering hit a recovery path: ${payload.errorMessage}`
                );
            }
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

function generateEmergencyReportPdfBuffer(payload) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        try {
            const safePayload = safePlainClone(payload);
            doc.fontSize(24).fillColor('#111827').text('Refah Report', 50, 60);
            doc.moveDown(0.6);
            doc.fontSize(14).fillColor('#374151').text(safePayload.tenantName || 'Tenant');
            doc.moveDown(0.6);
            doc.fontSize(11).fillColor('#6B7280').text(`Period: ${safePayload.startDate || '-'} -> ${safePayload.endDate || '-'}`);
            doc.fontSize(11).fillColor('#6B7280').text(`Generated at: ${safePayload.generatedAt || '-'}`);
            if (safePayload.errorMessage) {
                doc.moveDown(1);
                doc.fontSize(11).fillColor('#991B1B').text(`Report PDF fallback was used: ${safePayload.errorMessage}`);
            }
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    generateReportPdfBuffer,
    generateFallbackReportPdfBuffer,
    generateEmergencyReportPdfBuffer,
    resolveUploadPath,
    sanitizeFileNamePart,
    safePlainClone,
};
