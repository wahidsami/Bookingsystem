const fs = require('fs');

function replaceInFile(path, replacements) {
    let content = fs.readFileSync(path, 'utf8');
    for (let r of replacements) {
        content = content.replace(r.search, r.replace);
    }
    fs.writeFileSync(path, content, 'utf8');
}

replaceInFile('src/i18n/translations.ts', [
    { search: /that Refah guarantees\./g, replace: "that BarSpa guarantees." },
    { search: /'Welcome to Refah!'/g, replace: "'Welcome to BarSpa!'" },
    { search: /'Welcome to Refah'/g, replace: "'Welcome to BarSpa'" },
    { search: /'Follow Refah'/g, replace: "'Follow BarSpa'" },
    { search: /'For support, please contact the Refah team/g, replace: "'For support, please contact the BarSpa team" },
    { search: /'Refah values your privacy/g, replace: "'BarSpa values your privacy" },
    { search: /'Refah is a Saudi beauty/g, replace: "'BarSpa is a Saudi beauty" },
    { search: /'مرحباً بك في رفاه!'/g, replace: "'مرحباً بك في بارسبا!'" },
    { search: /'مرحباً بك في رفاه'/g, replace: "'مرحباً بك في بارسبا'" },
    { search: /'تابع رفاه'/g, replace: "'تابع بارسبا'" },
    { search: /مع فريق رفاه عبر قناة الدعم/g, replace: "مع فريق بارسبا عبر قناة الدعم" },
    { search: /تحرص رفاه على خصوصيتك/g, replace: "تحرص بارسبا على خصوصيتك" },
    { search: /رفاه منصة سعودية للحجوزات/g, replace: "بارسبا منصة سعودية للحجوزات" },
    { search: /'New to Refah'/g, replace: "'New to BarSpa'" },
    { search: /'About Refah'/g, replace: "'About BarSpa'" },
    { search: /'جديد في رفاه'/g, replace: "'جديد في بارسبا'" },
    { search: /'عن رفاه'/g, replace: "'عن بارسبا'" },
    { search: /'عن رفاه'/g, replace: "'عن بارسبا'" },
    { search: /use Refah with this profile/g, replace: "use BarSpa with this profile" },
    { search: /مشترياتك عبر رفاه/g, replace: "مشترياتك عبر بارسبا" },
    { search: /purchases across Refah/g, replace: "purchases across BarSpa" },
    { search: /لاستخدام رفاه بهذا الملف/g, replace: "لاستخدام بارسبا بهذا الملف" }
]);

replaceInFile('src/i18n/authTranslations.ts', [
    { search: /'مرحباً بك في رفاه'/g, replace: "'مرحباً بك في بارسبا'" },
    { search: /'انضم إلى رفاه اليوم'/g, replace: "'انضم إلى بارسبا اليوم'" }
]);

console.log('Replacements completed successfully.');
