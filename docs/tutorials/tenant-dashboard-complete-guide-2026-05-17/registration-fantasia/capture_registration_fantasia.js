const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://rtenant.unifinitylab.com/ar/register';
const outDir = path.resolve('docs/tutorials/tenant-dashboard-complete-guide-2026-05-17/registration-fantasia/images');
fs.mkdirSync(outDir, { recursive: true });

const ts = Date.now();
const tenantNameAr = 'فانتازيا';
const tenantNameEn = `Fantasia ${ts}`;
const email = `fantasia.${ts}@example.com`;
const password = 'Fantasia@2727';
const phone = '0555555555';

const uploadFile = path.resolve('RifahNewLogoColor.png');

async function shot(page, file){
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  console.log('saved', file);
}

async function fillFirst(page, selectors, value){
  for (const s of selectors) {
    const loc = page.locator(s).first();
    if (await loc.count()) {
      try {
        await loc.fill(value);
        return true;
      } catch {}
    }
  }
  return false;
}

async function clickFirst(page, selectors){
  for (const s of selectors) {
    const loc = page.locator(s).first();
    if (await loc.count()) {
      try {
        await loc.click();
        return true;
      } catch {}
    }
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  await shot(page, '01_register_open.png');

  // Fill likely fields (best effort across EN/AR placeholders/names)
  await fillFirst(page, [
    'input[name="businessNameAr"]',
    'input[name="name_ar"]',
    'input[placeholder*="اسم" i]',
    'input[placeholder*="المركز" i]'
  ], tenantNameAr);

  await fillFirst(page, [
    'input[name="businessNameEn"]',
    'input[name="name_en"]',
    'input[placeholder*="Business" i]',
    'input[placeholder*="English" i]'
  ], tenantNameEn);

  await fillFirst(page, [
    'input[name="ownerNameAr"]',
    'input[name="contactPersonNameAr"]',
    'input[placeholder*="المالك" i]',
    'input[placeholder*="المسؤول" i]'
  ], 'مديرة فانتازيا');

  await fillFirst(page, [
    'input[name="ownerNameEn"]',
    'input[name="contactPersonNameEn"]',
    'input[placeholder*="Owner" i]',
    'input[placeholder*="Contact" i]'
  ], 'Fantasia Manager');

  await fillFirst(page, [
    'input[type="email"]',
    'input[name="email"]'
  ], email);

  await fillFirst(page, [
    'input[name="phone"]',
    'input[name="mobile"]',
    'input[type="tel"]',
    'input[placeholder*="05"]'
  ], phone);

  // Password + confirm
  const pwdFields = page.locator('input[type="password"]');
  const pwdCount = await pwdFields.count();
  if (pwdCount >= 1) await pwdFields.nth(0).fill(password);
  if (pwdCount >= 2) await pwdFields.nth(1).fill(password);

  await shot(page, '02_register_filled_basic_data.png');

  // Try select business type / category if dropdown exists
  await clickFirst(page, [
    'select[name="businessType"]',
    'button:has-text("نوع النشاط")',
    'button:has-text("Business Type")'
  ]);
  // pick salon-like option if visible
  await clickFirst(page, [
    'option:has-text("صالون")',
    'option:has-text("Salon")',
    'li:has-text("صالون")',
    'li:has-text("Salon")'
  ]);

  await shot(page, '03_register_select_business_type.png');

  // Upload files if inputs exist
  const fileInputs = page.locator('input[type="file"]');
  const fileCount = await fileInputs.count();
  for (let i = 0; i < fileCount; i++) {
    try {
      await fileInputs.nth(i).setInputFiles(uploadFile);
    } catch {}
  }

  await shot(page, '04_register_uploads_done.png');

  // Agreements checkboxes
  const checkboxes = page.locator('input[type="checkbox"]');
  const cbCount = await checkboxes.count();
  for (let i = 0; i < cbCount; i++) {
    try {
      if (!(await checkboxes.nth(i).isChecked())) {
        await checkboxes.nth(i).check();
      }
    } catch {}
  }

  await shot(page, '05_register_before_submit.png');

  // Submit
  await clickFirst(page, [
    'button[type="submit"]',
    'button:has-text("تسجيل")',
    'button:has-text("Register")',
    'button:has-text("إنشاء")'
  ]);

  await page.waitForTimeout(5000);
  await shot(page, '06_register_after_submit_result.png');

  // Save payload info for reference
  fs.writeFileSync(path.join(outDir, 'registration_payload_used.txt'), [
    `tenantNameAr=${tenantNameAr}`,
    `tenantNameEn=${tenantNameEn}`,
    `email=${email}`,
    `phone=${phone}`,
    `password=${password}`,
    `timestamp=${ts}`
  ].join('\n'));

  await browser.close();
})();
