const fs = require('fs');
const path = require('path');
try {
    require('./server/src/index.js');
    fs.writeFileSync(path.join(__dirname, 'boot_error.txt'), 'BOOTED OK');
} catch (e) {
    fs.writeFileSync(path.join(__dirname, 'boot_error.txt'), e.stack);
}
setTimeout(() => process.exit(0), 2000);
