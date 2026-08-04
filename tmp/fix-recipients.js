const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../server/src/services/customerNotificationService.js');
let content = fs.readFileSync(filePath, 'utf8');

const oldVars = `    const sentToIds = [];
    const recipientResults = [];
    const skippedReasons = {};`;

const newVars = `    const sentToIds = [];
    const recipientResults = [];
    const skippedReasons = {};

    const customers = await db.Customer.findAll({
        where: { tenantId, platformUserId: { [Op.in]: uniqueUserIds } },
        attributes: ['platformUserId', 'firstName', 'lastName', 'phone'],
        raw: true
    });
    const customerMap = {};
    for (const c of customers) {
        customerMap[c.platformUserId] = {
            name: \`\${c.firstName || ''} \${c.lastName || ''}\`.trim() || 'Unknown',
            phone: c.phone || 'No Phone'
        };
    }`;

content = content.replace(oldVars, newVars);

const oldPush = `        recipientResults.push({
            platformUserId,
            success,`;

const newPush = `        recipientResults.push({
            platformUserId,
            name: customerMap[platformUserId]?.name || 'Unknown Customer',
            phone: customerMap[platformUserId]?.phone || 'No Phone',
            success,`;

content = content.replace(oldPush, newPush);

const oldUpdate = `            await campaign.update({
                recipientCount: uniqueUserIds.length,
                sentAt: new Date()
            });`;

const newUpdate = `            payload.counts = {
                sent: sent,
                delivered: sent,
                skipped: skippedRecipients,
                failed: failedRecipients
            };
            payload.skippedReasons = skippedReasons;
            payload.recipientResults = recipientResults;
            await campaign.update({
                recipientCount: uniqueUserIds.length,
                sentAt: new Date(),
                data: payload
            });`;

content = content.replace(oldUpdate, newUpdate);

fs.writeFileSync(filePath, content);
console.log('Fixed recipients logic successfully');
