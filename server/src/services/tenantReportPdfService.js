const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const pdfMake = require('pdfmake');

const uploadsRoot = path.resolve(__dirname, '../../uploads');
const refahLogoFallbackPath = path.resolve(__dirname, '../templates/emails/RifahNewLogoWhite.png');
const pdfMakeRoot = path.dirname(require.resolve('pdfmake/package.json'));

pdfMake.setFonts({
    Roboto: {
        normal: path.join(pdfMakeRoot, 'fonts', 'Roboto', 'Roboto-Regular.ttf'),
        bold: path.join(pdfMakeRoot, 'fonts', 'Roboto', 'Roboto-Medium.ttf'),
        italics: path.join(pdfMakeRoot, 'fonts', 'Roboto', 'Roboto-Italic.ttf'),
        bolditalics: path.join(pdfMakeRoot, 'fonts', 'Roboto', 'Roboto-MediumItalic.ttf')
    }
});
pdfMake.setUrlAccessPolicy(() => false);
pdfMake.setLocalAccessPolicy((filePath) => typeof filePath === 'string' && path.isAbsolute(filePath));

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

function formatPercent(value) {
    const amount = Number(value || 0);
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function normalizePdfText(value) {
    if (value === null || value === undefined) return '-';
    if (Array.isArray(value)) {
        return value.map((item) => normalizePdfText(item)).filter(Boolean).join(', ') || '-';
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch (_) {
            return '-';
        }
    }
    const text = `${value}`;
    return text.trim() ? text : '-';
}

function fileToDataUrl(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
            ? 'image/webp'
            : 'image/png';
    const buffer = fs.readFileSync(filePath);
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function tableCell(value, options = {}) {
    return {
        text: normalizePdfText(value),
        fontSize: options.fontSize || 9,
        color: options.color || '#111827',
        bold: Boolean(options.bold),
        alignment: options.alignment || 'left',
        margin: options.margin || [0, 2, 0, 2]
    };
}

function buildMetricTable(rows) {
    return {
        table: {
            widths: ['*', 'auto'],
            body: rows.map(([label, value]) => [
                tableCell(label, { bold: true, color: '#475569' }),
                tableCell(value, { alignment: 'right' })
            ])
        },
        layout: {
            fillColor: (rowIndex) => (rowIndex % 2 === 0 ? '#FFFFFF' : '#F8FAFC'),
            hLineColor: () => '#E5E7EB',
            vLineColor: () => '#E5E7EB',
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 4,
            paddingBottom: () => 4
        },
        margin: [0, 0, 0, 10]
    };
}

function buildDataTable(title, headers, rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return [
            { text: title, style: 'sectionTitle', pageBreak: 'before' },
            { text: 'No data in selected period.', style: 'emptyText' }
        ];
    }

    return [
        { text: title, style: 'sectionTitle', pageBreak: 'before' },
        {
            table: {
                headerRows: 1,
                widths: headers.map(() => '*'),
                body: [
                    headers.map((header) => tableCell(header, { bold: true, color: '#1E293B', fontSize: 10 })),
                    ...rows.map((row) => row.map((cell) => tableCell(cell)))
                ]
            },
            layout: {
                fillColor: (rowIndex) => (rowIndex === 0 ? '#EDE9FE' : rowIndex % 2 === 0 ? '#FFFFFF' : '#F8FAFC'),
                hLineColor: () => '#E5E7EB',
                vLineColor: () => '#E5E7EB',
                paddingLeft: () => 7,
                paddingRight: () => 7,
                paddingTop: () => 4,
                paddingBottom: () => 4
            },
            margin: [0, 0, 0, 10]
        }
    ];
}

function buildCoverImageStack(tenantLogoPath) {
    const refahLogo = fileToDataUrl(refahLogoFallbackPath);
    const tenantLogo = fileToDataUrl(tenantLogoPath);

    return {
        columns: [
            refahLogo ? { image: refahLogo, fit: [150, 64], alignment: 'left' } : { text: '' },
            tenantLogo ? { image: tenantLogo, fit: [140, 64], alignment: 'right' } : { text: '' }
        ],
        margin: [0, 0, 0, 24]
    };
}

function buildPdfMakeDoc(payload) {
    const title = payload.reportTitle || 'Business Report';
    const tenantName = payload.tenantName || 'Tenant';
    const sections = Array.isArray(payload.sections) && payload.sections.length
        ? payload.sections.map((section) => normalizePdfText(section)).join(' • ')
        : 'overview';
    const coverBlocks = [
        { text: 'Refah Reports', style: 'coverBrand' },
        buildCoverImageStack(payload.tenantLogoPath),
        { text: title, style: 'coverTitle' },
        { text: tenantName, style: 'coverTenant' },
        { text: `Period: ${payload.startDate} -> ${payload.endDate}`, style: 'coverMeta' },
        { text: `Generated at: ${payload.generatedAt}`, style: 'coverMeta' },
        { text: `Sections: ${sections}`, style: 'coverMeta' }
    ];

    const overview = payload.data?.overview;
    const content = [
        {
            stack: coverBlocks,
            margin: [0, 60, 0, 0],
            pageBreak: 'after'
        }
    ];

    if (overview) {
        content.push(
            { text: 'Overview', style: 'sectionTitle', pageBreak: 'before' },
            { text: 'Financial summary', style: 'subsectionTitle' },
            buildMetricTable([
                ['Total Revenue', formatMoney(overview.totalRevenue)],
                ['Tenant Revenue', formatMoney(overview.totalTenantRevenue)],
                ['Net Revenue', formatMoney(overview.netRevenue)],
                ['Gross Appointment Revenue', formatMoney(overview.appointmentRevenue)],
                ['Order Revenue', formatMoney(overview.orderRevenue)],
                ['Gift Card Revenue', formatMoney(overview.giftCardRevenue)],
                ['Total Tax', formatMoney(overview.totalTax)],
                ['Platform Fees', formatMoney(overview.totalPlatformFees)],
                ['Employee Commissions', formatMoney(overview.totalEmployeeCommissions)]
            ]),
            { text: 'Booking summary', style: 'subsectionTitle' },
            buildMetricTable([
                ['Total Bookings', overview.totalBookings || 0],
                ['Completed Bookings', overview.completedBookings || 0],
                ['Cancelled Bookings', overview.cancelledBookings || 0],
                ['No-show Bookings', overview.noShowBookings || 0],
                ['Paid Bookings', overview.paidBookings || 0],
                ['Pending Payments', formatMoney(overview.pendingPayments)],
                ['Completion Rate', formatPercent(overview.completionRate)],
                ['Average Booking Value', formatMoney(overview.avgBookingValue)],
                ['Unique Customers', overview.uniqueCustomers || 0]
            ])
        );

        if (overview.discountTotals || overview.totalDiscountAmount != null) {
            const discounts = overview.discountTotals || overview;
            content.push(
                { text: 'Discount summary', style: 'subsectionTitle' },
                buildMetricTable([
                    ['Total Discounts', formatMoney(discounts.totalDiscountAmount)],
                    ['Appointment Discounts', formatMoney(discounts.appointmentDiscountAmount)],
                    ['Order Discounts', formatMoney(discounts.orderDiscountAmount)],
                    ['Discounted Bookings', discounts.discountedBookings || 0],
                    ['Discounted Orders', discounts.discountedOrders || 0],
                    ['Average Discount', formatMoney(discounts.averageDiscountAmount)]
                ])
            );

            if (Array.isArray(discounts.topDiscountedServices) && discounts.topDiscountedServices.length) {
                content.push(
                    ...buildDataTable(
                        'Top Discounted Services',
                        ['Service', 'Bookings', 'Discount'],
                        discounts.topDiscountedServices.map((service) => [
                            service.name_en || service.name_ar || '-',
                            service.bookingCount ?? 0,
                            formatMoney(service.discountAmount)
                        ])
                    )
                );
            }

            if (Array.isArray(discounts.topDiscountedOrders) && discounts.topDiscountedOrders.length) {
                content.push(
                    ...buildDataTable(
                        'Top Discounted Orders',
                        ['Order', 'Base Amount', 'Discount'],
                        discounts.topDiscountedOrders.map((order) => [
                            order.orderNumber || order.id || '-',
                            formatMoney(order.baseAmount),
                            formatMoney(order.discountAmount)
                        ])
                    )
                );
            }
        }
    }

    if (Array.isArray(payload.data?.dailyRevenue) && payload.data.dailyRevenue.length) {
        content.push(
            ...buildDataTable(
                'Daily Revenue',
                ['Date', 'Bookings', 'Orders', 'Revenue', 'Tenant Revenue'],
                payload.data.dailyRevenue.map((row) => [
                    row.date || '-',
                    row.bookings ?? 0,
                    row.orders ?? 0,
                    formatMoney(row.revenue),
                    formatMoney(row.tenantRevenue)
                ])
            )
        );
    }

    if (Array.isArray(payload.data?.bookingTrends) && payload.data.bookingTrends.length) {
        content.push(
            ...buildDataTable(
                'Booking Trends',
                ['Date', 'Bookings', 'Completed', 'Revenue'],
                payload.data.bookingTrends.map((row) => [
                    row.date || '-',
                    row.bookings ?? 0,
                    row.completed ?? 0,
                    formatMoney(row.revenue)
                ])
            )
        );
    }

    if (Array.isArray(payload.data?.paymentMethods?.rows) && payload.data.paymentMethods.rows.length) {
        content.push(
            ...buildDataTable(
                'Payment Methods',
                ['Method', 'Revenue', 'Transactions'],
                payload.data.paymentMethods.rows.map((row) => [
                    row.paymentMethodLabel || row.paymentMethod || '-',
                    formatMoney(row.revenue),
                    row.transactionCount ?? 0
                ])
            )
        );
    }

    if (Array.isArray(payload.data?.refunds?.rows) && payload.data.refunds.rows.length) {
        content.push(
            ...buildDataTable(
                'Refunds',
                ['Date', 'Customer', 'Reference', 'Amount', 'Method'],
                payload.data.refunds.rows.map((row) => [
                    row.date ? new Date(row.date).toLocaleDateString('en-GB') : '-',
                    row.customer || row.customerName || '-',
                    row.reference || '-',
                    formatMoney(row.amount),
                    row.paymentMethodLabel || '-'
                ])
            )
        );
    }

    if (Array.isArray(payload.data?.customerSales?.rows) && payload.data.customerSales.rows.length) {
        content.push(
            ...buildDataTable(
                'Customer Sales',
                ['Customer', 'Bookings', 'Completed', 'Revenue'],
                payload.data.customerSales.rows.map((row) => [
                    row.customerName || row.customer || row.name || '-',
                    row.bookings ?? 0,
                    row.completed ?? 0,
                    formatMoney(row.revenue)
                ])
            )
        );
    }

    if (Array.isArray(payload.data?.rebookings?.rows) && payload.data.rebookings.rows.length) {
        content.push(
            ...buildDataTable(
                'Rebookings',
                ['Date', 'Customer', 'Reference', 'Revenue'],
                payload.data.rebookings.rows.map((row) => [
                    row.date ? new Date(row.date).toLocaleDateString('en-GB') : '-',
                    row.customer || row.customerName || '-',
                    row.reference || '-',
                    formatMoney(row.revenue ?? row.amount)
                ])
            )
        );
    }

    if (payload.data?.discounts) {
        const discounts = payload.data.discounts;
        content.push(
            { text: 'Discounts', style: 'sectionTitle', pageBreak: 'before' },
            buildMetricTable([
                ['Total Discounts', formatMoney(discounts.totalDiscountAmount)],
                ['Booking Discounts', formatMoney(discounts.appointmentDiscountAmount)],
                ['Order Discounts', formatMoney(discounts.orderDiscountAmount)],
                ['Average Discount', formatMoney(discounts.averageDiscountAmount)]
            ])
        );

        if (Array.isArray(discounts.topDiscountedServices) && discounts.topDiscountedServices.length) {
            content.push(
                ...buildDataTable(
                    'Top Discounted Services',
                    ['Service', 'Bookings', 'Discount'],
                    discounts.topDiscountedServices.map((service) => [
                        service.name_en || service.name_ar || '-',
                        service.bookingCount ?? 0,
                        formatMoney(service.discountAmount)
                    ])
                )
            );
        }

        if (Array.isArray(discounts.topDiscountedOrders) && discounts.topDiscountedOrders.length) {
            content.push(
                ...buildDataTable(
                    'Top Discounted Orders',
                    ['Order', 'Base Amount', 'Discount'],
                    discounts.topDiscountedOrders.map((order) => [
                        order.orderNumber || order.id || '-',
                        formatMoney(order.baseAmount),
                        formatMoney(order.discountAmount)
                    ])
                )
            );
        }
    }

    if (Array.isArray(payload.data?.employees) && payload.data.employees.length) {
        content.push(
            ...buildDataTable(
                'Employee Revenue',
                ['Employee', 'Bookings', 'Revenue', 'Commission'],
                payload.data.employees.map((employee) => [
                    employee.name || '-',
                    employee.totalBookings ?? 0,
                    formatMoney(employee.totalRevenueGenerated ?? employee.revenue),
                    formatMoney(employee.totalCommission)
                ])
            )
        );
    }

    if (Array.isArray(payload.data?.services) && payload.data.services.length) {
        content.push(
            ...buildDataTable(
                'Service Revenue',
                ['Service', 'Bookings', 'Revenue', 'Tenant Revenue'],
                payload.data.services.map((service) => [
                    service.name_en || service.name_ar || '-',
                    service.totalBookings ?? 0,
                    formatMoney(service.totalRevenue),
                    formatMoney(service.totalTenantRevenue)
                ])
            )
        );
    }

    if (Array.isArray(payload.data?.products) && payload.data.products.length) {
        content.push(
            ...buildDataTable(
                'Product Revenue',
                ['Product', 'Orders', 'Quantity', 'Revenue'],
                payload.data.products.map((product) => [
                    product.name_en || product.name_ar || '-',
                    product.totalOrders ?? 0,
                    product.totalQuantity ?? 0,
                    formatMoney(product.totalRevenue)
                ])
            )
        );
    }

    const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 40, 40, 40],
        defaultStyle: {
            font: 'Roboto',
            fontSize: 10,
            color: '#0F172A'
        },
        content,
        styles: {
            coverBrand: {
                fontSize: 24,
                bold: true,
                color: '#7C3AED',
                alignment: 'center',
                margin: [0, 0, 0, 28]
            },
            coverTitle: {
                fontSize: 28,
                bold: true,
                color: '#111827',
                alignment: 'center',
                margin: [0, 12, 0, 10]
            },
            coverTenant: {
                fontSize: 18,
                color: '#334155',
                alignment: 'center',
                margin: [0, 0, 0, 12]
            },
            coverMeta: {
                fontSize: 11,
                color: '#475569',
                alignment: 'center',
                margin: [0, 2, 0, 2]
            },
            sectionTitle: {
                fontSize: 18,
                bold: true,
                color: '#111827',
                margin: [0, 0, 0, 10]
            },
            subsectionTitle: {
                fontSize: 13,
                bold: true,
                color: '#4C1D95',
                margin: [0, 8, 0, 6]
            },
            emptyText: {
                fontSize: 10,
                color: '#6B7280',
                margin: [0, 0, 0, 10]
            }
        },
        pageBreakBefore(currentNode) {
            return currentNode?.text === 'Overview';
        }
    };

    return docDefinition;
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
        try {
            const docDefinition = buildPdfMakeDoc(payload);
            const pdfDocument = pdfMake.createPdf(docDefinition);
            pdfDocument.getBuffer().then((buffer) => resolve(buffer)).catch(reject);
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
