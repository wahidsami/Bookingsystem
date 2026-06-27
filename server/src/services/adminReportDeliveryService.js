'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('../models');
const { sendEmail } = require('../utils/emailService');
const { sanitizeFileNamePart } = require('./tenantReportPdfService');

function formatMoney(value) {
    const amount = Number(value || 0);
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}

function xmlEscape(value) {
    return `${value ?? ''}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function createReportPdfBuffer(report, preview) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 42 });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.rect(0, 0, doc.page.width, 84).fill('#0F172A');
        doc.fillColor('#FFFFFF').fontSize(20).text(report.title || 'Scheduled Report', 42, 30);
        doc.fillColor('#CBD5E1').fontSize(10).text(`Generated ${new Date().toLocaleString('en-GB')}`, 42, 58);

        doc.moveDown(3);
        doc.fillColor('#0F172A').fontSize(16).text('Summary');
        doc.moveDown(0.5);
        const summaryRows = Object.entries(preview?.summary || {}).map(([key, value]) => [key, value]);
        if (!summaryRows.length) {
            doc.fontSize(10).fillColor('#64748B').text('No summary data available.');
        } else {
            summaryRows.forEach(([key, value]) => {
                doc.fontSize(11).fillColor('#334155').text(`${key}: ${formatMoney(value)}`);
            });
        }

        doc.moveDown(1.5);
        doc.fontSize(16).fillColor('#0F172A').text('Top Rows');
        doc.moveDown(0.5);
        const rows = Array.isArray(preview?.rows) ? preview.rows.slice(0, 20) : [];
        if (!rows.length) {
            doc.fontSize(10).fillColor('#64748B').text('No rows available.');
        } else {
            const headers = Object.keys(rows[0]);
            const columnWidth = Math.floor((doc.page.width - 84) / Math.max(headers.length, 1));
            let y = doc.y;
            doc.fontSize(8).fillColor('#334155');
            headers.forEach((header, index) => {
                doc.text(header, 42 + (index * columnWidth), y, { width: columnWidth - 4 });
            });
            y += 16;
            rows.forEach((row) => {
                headers.forEach((header, index) => {
                    const value = row[header];
                    doc.fontSize(8).fillColor('#111827').text(`${value ?? '-'}`, 42 + (index * columnWidth), y, { width: columnWidth - 4 });
                });
                y += 14;
                if (y > 760) {
                    doc.addPage();
                    y = 42;
                }
            });
        }

        doc.end();
    });
}

function createWorkbookXml(report, preview) {
    const rows = Array.isArray(preview?.rows) ? preview.rows : [];
    const headers = rows.length ? Object.keys(rows[0]) : ['metric', 'value'];
    const summaryRows = Object.entries(preview?.summary || {}).map(([key, value]) => [key, value]);
    const allRows = [
        ['Report Title', report.title || 'Scheduled Report'],
        ['Generated At', new Date().toISOString()],
        ['Summary', ''],
        ...summaryRows.map(([key, value]) => [key, value]),
        [],
        headers,
        ...rows.map((row) => headers.map((header) => row[header] ?? ''))
    ];

    const cells = allRows.map((row, rowIndex) => {
        if (!row || row.length === 0) {
            return `<Row><Cell><Data ss:Type="String"></Data></Cell></Row>`;
        }

        return `<Row>${
            row.map((cell, colIndex) => {
                const isNumber = typeof cell === 'number' && Number.isFinite(cell);
                return `<Cell ss:Index="${colIndex + 1}"><Data ss:Type="${isNumber ? 'Number' : 'String'}">${xmlEscape(cell)}</Data></Cell>`;
            }).join('')
        }</Row>`;
    }).join('');

    return Buffer.from(`<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Report">
    <Table>
      ${cells}
    </Table>
  </Worksheet>
</Workbook>`, 'utf8');
}

function buildAttachments(report, preview, exportFormats = []) {
    const normalizedFormats = Array.isArray(exportFormats) && exportFormats.length > 0 ? exportFormats : ['pdf', 'excel'];
    const attachments = [];
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = sanitizeFileNamePart(report.title || 'scheduled-report');

    if (normalizedFormats.includes('pdf')) {
        attachments.push({
            filename: `${baseName}-${stamp}.pdf`,
            content: null,
            contentType: 'application/pdf',
            _buffer: () => createReportPdfBuffer(report, preview)
        });
    }

    if (normalizedFormats.includes('excel')) {
        attachments.push({
            filename: `${baseName}-${stamp}.xls`,
            content: null,
            contentType: 'application/vnd.ms-excel',
            _buffer: async () => createWorkbookXml(report, preview)
        });
    }

    return attachments;
}

async function renderAttachments(report, preview, exportFormats = []) {
    const attachments = buildAttachments(report, preview, exportFormats);
    const rendered = [];

    for (const attachment of attachments) {
        const buffer = await attachment._buffer();
        rendered.push({
            filename: attachment.filename,
            content: buffer.toString('base64'),
            contentType: attachment.contentType
        });
    }

    return rendered;
}

function normalizeDeliveryChannels(scheduleConfig = {}) {
    const channels = Array.isArray(scheduleConfig.deliveryChannels) ? scheduleConfig.deliveryChannels : [];
    const normalized = channels.map((value) => `${value}`.trim().toLowerCase()).filter(Boolean);
    return normalized.length > 0 ? normalized : ['email', 'dashboard_inbox'];
}

function normalizeExportFormats(scheduleConfig = {}) {
    const formats = Array.isArray(scheduleConfig.exportFormats) ? scheduleConfig.exportFormats : [];
    const normalized = formats.map((value) => `${value}`.trim().toLowerCase()).filter(Boolean);
    return normalized.length > 0 ? normalized : ['pdf', 'excel'];
}

async function createDashboardInboxNotification(savedReport, preview, deliverySummary = {}) {
    const dedupeKey = `scheduled_report:${savedReport.id}:${new Date().toISOString()}`;
    const summaryText = Object.entries(preview?.summary || {})
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${Number(value || 0).toLocaleString('en-US')}`)
        .join(', ');

    return db.AdminNotification.create({
        type: 'scheduled_report_ready',
        severity: 'info',
        titleAr: 'تقرير مجدول جاهز',
        titleEn: 'Scheduled report ready',
        messageAr: `تم تجهيز التقرير "${savedReport.title}" بنجاح. ${summaryText}`,
        messageEn: `Scheduled report "${savedReport.title}" is ready. ${summaryText}`,
        entityType: 'admin_saved_report',
        entityId: savedReport.id,
        actionUrl: '/dashboard/financial/reports/builder',
        dedupeKey,
        metadata: {
            reportId: savedReport.id,
            reportTitle: savedReport.title,
            deliverySummary
        }
    });
}

async function sendScheduledReportEmail(savedReport, preview, recipients, exportFormats = []) {
    if (!Array.isArray(recipients) || recipients.length === 0) {
        return { success: false, skipped: true, reason: 'no_recipients' };
    }

    const attachments = await renderAttachments(savedReport, preview, exportFormats);
    const summaryLine = Object.entries(preview?.summary || {})
        .slice(0, 4)
        .map(([key, value]) => `${key}: ${Number(value || 0).toLocaleString('en-US')}`)
        .join(' | ');

    const result = await sendEmail({
        to: recipients,
        subject: `Rifah scheduled report: ${savedReport.title}`,
        template: 'admin_report_delivery',
        data: {
            reportTitle: savedReport.title,
            generatedAt: new Date().toLocaleString('en-GB'),
            summaryLine: summaryLine || 'No summary data available.',
            dashboardUrl: `${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000'}/dashboard/financial/reports/builder`,
            rowCount: preview?.totals?.rows || 0,
            recordCount: preview?.totals?.recordCount || 0
        },
        attachments
    });

    return result;
}

async function deliverScheduledReport(savedReport, preview) {
    const scheduleConfig = savedReport.scheduleConfig || {};
    const deliveryChannels = normalizeDeliveryChannels(scheduleConfig);
    const exportFormats = normalizeExportFormats(scheduleConfig);
    const recipients = Array.isArray(scheduleConfig.recipients) ? scheduleConfig.recipients.filter(Boolean) : [];
    const deliverySummary = {
        channels: deliveryChannels,
        formats: exportFormats,
        recipients
    };

    const emailChannel = deliveryChannels.includes('email');
    const inboxChannel = deliveryChannels.includes('dashboard_inbox');

    let emailResult = { success: false, skipped: true, reason: 'not_requested' };
    let inboxResult = { success: false, skipped: true, reason: 'not_requested' };

    if (emailChannel) {
        emailResult = await sendScheduledReportEmail(savedReport, preview, recipients, exportFormats);
    }

    if (inboxChannel) {
        await createDashboardInboxNotification(savedReport, preview, deliverySummary);
        inboxResult = { success: true };
    }

    return {
        success: Boolean(emailResult?.success || inboxResult?.success),
        email: emailResult,
        inbox: inboxResult,
        deliverySummary
    };
}

module.exports = {
    deliverScheduledReport,
    normalizeDeliveryChannels,
    normalizeExportFormats,
    renderAttachments
};
