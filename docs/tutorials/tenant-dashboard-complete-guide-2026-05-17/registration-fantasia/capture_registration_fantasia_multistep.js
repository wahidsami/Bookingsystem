const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = 'https://rtenant.unifinitylab.com/ar/register';
const outDir = path.resolve('docs/tutorials/tenant-dashboard-complete-guide-2026-05-17/registration-fantasia/images');
fs.mkdirSync(outDir, { recursive: true });

const ts = Date.now();
const tenantNameAr = `فانتازيا ${ts}`;
const tenantNameEn = `Fantasia ${ts}`;
const email = `fantasia.${ts}@example.com`;
const password = 'Fantasia@2727';
const phone = '0555555555';
const uploadFile = path.resolve('RifahNewLogoColor.png');

async function shot(page, file) {
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  console.log('saved', file);
}

async function fillIfFound(page, selectors, value) {
  for (const s of selectors) {
    const el = page.locator(s).first();
    if (await el.count()) {
      try {
        await el.fill(value);
        return true;
      } catch {}
    }
  }
  return false;
}

async function clickFirst(page, selectors) {
  for (const s of selectors) {
    const el = page.locator(s).first();
    if (await el.count()) {
      try {
        await el.click({ timeout: 2000 });
        return true;
      } catch {}
    }
  }
  return false;
}

async function fillCurrentStep(page) {
  await fillIfFound(page, ['input[name="name_ar"]','input[name="businessNameAr"]','input[placeholder*="اسم" i]'], tenantNameAr);
  await fillIfFound(page, ['input[name="name_en"]','input[name="businessNameEn"]','input[placeholder*="Business" i]'], tenantNameEn);
  await fillIfFound(page, ['input[name="ownerNameAr"]','input[name="contactPersonNameAr"]','input[placeholder*="المالك" i]','input[placeholder*="المسؤول" i]'], 'مديرة فانتازيا');
  await fillIfFound(page, ['input[name="ownerNameEn"]','input[name="contactPersonNameEn"]','input[placeholder*="Owner" i]'], 'Fantasia Manager');
  await fillIfFound(page, ['input[type="email"]','input[name="email"]'], email);
  await fillIfFound(page, ['input[type="tel"]','input[name="phone"]','input[name="mobile"]'], phone);

  const pwds = page.locator('input[type="password"]');
  const pc = await pwds.count();
  if (pc >= 1) { try { await pwds.nth(0).fill(password); } catch {} }
  if (pc >= 2) { try { await pwds.nth(1).fill(password); } catch {} }

  // dropdown/selects
  await clickFirst(page, ['select[name="businessType"]','button:has-text("نوع النشاط")','button:has-text("Business Type")']);
  await clickFirst(page, ['option:has-text("صالون")','option:has-text("Salon")','li:has-text("صالون")','li:has-text("Salon")']);

  // file uploads
  const files = page.locator('input[type="file"]');
  const fc = await files.count();
  for (let i = 0; i < fc; i++) {
    try { await files.nth(i).setInputFiles(uploadFile); } catch {}
  }

  // checkboxes
  const cbs = page.locator('input[type="checkbox"]');
  const cc = await cbs.count();
  for (let i = 0; i < cc; i++) {
    try {
      const cb = cbs.nth(i);
      if (!(await cb.isChecked())) await cb.check();
    } catch {}
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2000);
  await shot(page, '01_register_step_01_open.png');

  // Try up to 8 transitions
  for (let step = 1; step <= 8; step++) {
    await fillCurrentStep(page);
    await page.waitForTimeout(700);
    await shot(page, `02_register_step_${String(step).padStart(2,'0')}_filled.png`);

    const moved = await clickFirst(page, [
      'button:has-text("التالي")',
      'button:has-text("Next")',
      'button:has-text("استمرار")',
      'button:has-text("Continue")',
      'button:has-text("تسجيل")',
      'button:has-text("Register")',
      'button[type="submit"]'
    ]);

    if (!moved) break;
    await page.waitForTimeout(2500);
    await shot(page, `03_register_step_${String(step).padStart(2,'0')}_after_click.png`);

    // if redirected away from register or success message appears, stop
    const u = page.url();
    const bodyText = (await page.locator('body').innerText()).slice(0, 4000);
    if (!u.includes('/register') || /تم التسجيل|success|pending|بانتظار|شكراً|thank/i.test(bodyText)) {
      await shot(page, '99_register_final_state.png');
      break;
    }
  }

  fs.writeFileSync(path.join(outDir, 'registration_payload_used_v2.txt'), [
    `tenantNameAr=${tenantNameAr}`,
    `tenantNameEn=${tenantNameEn}`,
    `email=${email}`,
    `phone=${phone}`,
    `password=${password}`
  ].join('\n'));

  await browser.close();
})();
