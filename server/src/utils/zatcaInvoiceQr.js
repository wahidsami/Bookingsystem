const QRCode = require('qrcode');

function toMoneyString(value) {
    const parsed = Number.parseFloat(value);
    const safeValue = Number.isFinite(parsed) ? parsed : 0;
    return safeValue.toFixed(2);
}

function formatSaudiIsoTimestamp(dateValue) {
    const sourceDate = dateValue ? new Date(dateValue) : new Date();
    const timestampMs = sourceDate.getTime();
    const safeDate = Number.isFinite(timestampMs) ? sourceDate : new Date();
    const saudiDate = new Date(safeDate.getTime() + (3 * 60 * 60 * 1000));

    const year = saudiDate.getUTCFullYear();
    const month = String(saudiDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(saudiDate.getUTCDate()).padStart(2, '0');
    const hours = String(saudiDate.getUTCHours()).padStart(2, '0');
    const minutes = String(saudiDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(saudiDate.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+03:00`;
}

function encodeTlvField(tag, value) {
    const stringValue = (value || '').toString();
    const valueBuffer = Buffer.from(stringValue, 'utf8');

    if (valueBuffer.length > 255) {
        throw new Error(`ZATCA QR TLV value for tag ${tag} is too long`);
    }

    return Buffer.concat([
        Buffer.from([tag]),
        Buffer.from([valueBuffer.length]),
        valueBuffer
    ]);
}

function buildZatcaPhase1QrPayload({
    sellerName,
    vatNumber,
    invoiceTimestamp,
    totalAmount,
    vatAmount
}) {
    const tlvBuffer = Buffer.concat([
        encodeTlvField(1, sellerName || ''),
        encodeTlvField(2, vatNumber || ''),
        encodeTlvField(3, formatSaudiIsoTimestamp(invoiceTimestamp)),
        encodeTlvField(4, toMoneyString(totalAmount)),
        encodeTlvField(5, toMoneyString(vatAmount))
    ]);

    return tlvBuffer.toString('base64');
}

async function generateZatcaQrImageBuffer(qrPayload) {
    if (!qrPayload) return null;

    return QRCode.toBuffer(qrPayload, {
        type: 'png',
        margin: 1,
        width: 220,
        errorCorrectionLevel: 'M',
        color: {
            dark: '#0f172a',
            light: '#ffffff'
        }
    });
}

module.exports = {
    buildZatcaPhase1QrPayload,
    formatSaudiIsoTimestamp,
    generateZatcaQrImageBuffer
};
