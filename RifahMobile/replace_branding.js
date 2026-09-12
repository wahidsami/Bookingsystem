const fs = require('fs');

function replaceInFile(path, replacements) {
    let content = fs.readFileSync(path, 'utf8');
    for (let r of replacements) {
        content = content.replace(r.search, r.replace);
    }
    fs.writeFileSync(path, content, 'utf8');
}

// 1. translations.ts
replaceInFile('src/i18n/translations.ts', [
    { search: \"that Refah guarantees.\", replace: \"that BarSpa guarantees.\" },
    { search: \"'Welcome to Refah!'\", replace: \"'Welcome to BarSpa!'\" },
    { search: \"'Welcome to Refah'\", replace: \"'Welcome to BarSpa'\" },
    { search: \"'Follow Refah'\", replace: \"'Follow BarSpa'\" },
    { search: \"'For support, please contact the Refah team\", replace: \"'For support, please contact the BarSpa team\" },
    { search: \"'Refah values your privacy\", replace: \"'BarSpa values your privacy\" },
    { search: \"'Refah is a Saudi beauty\", replace: \"'BarSpa is a Saudi beauty\" },
    { search: \"'مرحباً بك في رفاه!'\", replace: \"'مرحباً بك في بارسبا!'\" },
    { search: \"'مرحباً بك في رفاه'\", replace: \"'مرحباً بك في بارسبا'\" },
    { search: \"'تابع رفاه'\", replace: \"'تابع بارسبا'\" },
    { search: \"مع فريق رفاه عبر قناة الدعم\", replace: \"مع فريق بارسبا عبر قناة الدعم\" },
    { search: \"تحرص رفاه على خصوصيتك\", replace: \"تحرص بارسبا على خصوصيتك\" },
    { search: \"رفاه منصة سعودية للحجوزات\", replace: \"بارسبا منصة سعودية للحجوزات\" }
]);

// 2. GiftsScreen.tsx
replaceInFile('src/screens/GiftsScreen.tsx', [
    { search: /'رصيد رفاه'/g, replace: \"'رصيد بارسبا'\" },
    { search: /'Refah Balance'/g, replace: \"'BarSpa Balance'\" },
    { search: /'بطاقات رفاه ✨'/g, replace: \"'بطاقات بارسبا ✨'\" },
    { search: /'Refah Gift Cards ✨'/g, replace: \"'BarSpa Gift Cards ✨'\" },
    { search: /'مستخدم رفاه'/g, replace: \"'مستخدم بارسبا'\" },
    { search: /'Refah User'/g, replace: \"'BarSpa User'\" }
]);

// 3. WalletBalanceDetailsScreen.tsx
replaceInFile('src/screens/WalletBalanceDetailsScreen.tsx', [
    { search: /'رصيد رفاه'/g, replace: \"'رصيد بارسبا'\" },
    { search: /'Refah Balance'/g, replace: \"'BarSpa Balance'\" }
]);

// 4. MoreScreen.tsx
replaceInFile('src/screens/MoreScreen.tsx', [
    { search: \"Refah v1.0.0\", replace: \"BarSpa v1.0.0\" },
    { search: \"© 2024 Refah Platform\", replace: \"© 2024 BarSpa Platform\" }
]);

// 5. TenantScreen.tsx
replaceInFile('src/screens/TenantScreen.tsx', [
    { search: /tenant\.name \|\| 'Refah'/g, replace: \"tenant.name || 'BarSpa'\" }
]);

// 6. AppointmentInviteScreen.tsx
replaceInFile('src/screens/AppointmentInviteScreen.tsx', [
    { search: /invite\.tenant\?\.name \|\| 'Refah'/g, replace: \"invite.tenant?.name || 'BarSpa'\" }
]);

// 7. ServiceDetailsScreen.tsx
replaceInFile('src/screens/ServiceDetailsScreen.tsx', [
    { search: /tenant\?\.name \|\| 'Refah'/g, replace: \"tenant?.name || 'BarSpa'\" }
]);
console.log('Replacements completed successfully.');
