const fs = require('fs');

const path = 'Tenant-v2/src/components/employee-profile/TeamMemberProfileDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/triggerToast\(/g, 'onToast?.(');

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully replaced triggerToast with onToast');
