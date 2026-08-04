const cp = require('child_process');

try {
    console.log('Adding files...');
    cp.execSync('git add server/src/models/orderItem.js server/migrations/20260804125722-change-order-item-product-image-to-text.js');
    
    console.log('Committing...');
    cp.execSync('git commit -m "fix(schema): change OrderItem.productImage from VARCHAR(255) to TEXT to accommodate long JSONB URLs"');
    
    console.log('Pushing...');
    cp.execSync('git push');
    
    console.log('Successfully committed and pushed.');
} catch (e) {
    console.error('Git operation failed:', e.message);
    if (e.stdout) console.error(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
}
