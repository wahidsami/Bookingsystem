const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.js') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(path.join(__dirname, 'src'));

const commercialKeywords = [
    'commissionRate', 'platformFee', 'taxRate', 'depositPercentage',
    'rawPrice', 'basePrice', 'price', 'taxAmount', 'dueAmount',
    'discountAmount', 'vatAmount', 'totalAmount', 'remainderAmount',
    'totalPaid', 'finalPrice', 'subtotal', 'shippingFee',
    'depositAmount', 'fee', 'discount', 'vat', 'remainingBalance',
    'employeeCommissionRate'
];

let changedFiles = [];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Pattern 1: object.property ||
    commercialKeywords.forEach(kw => {
        // e.g. service.commissionRate || 10
        // e.g. appointment?.price || 0
        const regex1 = new RegExp(`([a-zA-Z0-9_$.?]+\\.${kw})\\s*\\|\\|`, 'g');
        content = content.replace(regex1, '$1 ??');

        // Pattern 2: localVariable || 
        // We only want to match if it's a standalone variable, not part of another word
        // e.g. commissionRate || 10
        const regex2 = new RegExp(`\\b(${kw})\\s*\\|\\|`, 'g');
        content = content.replace(regex2, '$1 ??');
    });

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        changedFiles.push(file);
    }
});

console.log("Files changed:");
changedFiles.forEach(f => console.log(f));
