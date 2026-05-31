const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://rtenant.unifinitylab.com';
const EMAIL = 'lojah25672@codoteam.com';
const PASS = 'Taby2727';
const outDir = path.resolve('docs/tutorials/tenant-dashboard-complete-guide-2026-05-17/images');
fs.mkdirSync(outDir, { recursive: true });

const shots = [
  { file: '01_register_page_full_hd.png', url: `${BASE}/ar/register` },
  { file: '06_login_page_full_hd.png', url: `${BASE}/ar/login` },
  { file: '08_dashboard_overview_layout_hd.png', url: `${BASE}/ar/dashboard` },
  { file: '09_sidebar_navigation_map.png', url: `${BASE}/ar/dashboard` },
  { file: '10_teams_main_page_hd.png', url: `${BASE}/ar/dashboard/employees` },
  { file: '13_team_schedule_editor_weekly.png', url: `${BASE}/ar/dashboard/schedules` },
  { file: '16_services_main_page_hd.png', url: `${BASE}/ar/dashboard/services` },
  { file: '21_products_main_page_hd.png', url: `${BASE}/ar/dashboard/products` },
  { file: '25_orders_main_page_hd.png', url: `${BASE}/ar/dashboard/orders` },
  { file: '28_appointments_board_view_hd.png', url: `${BASE}/ar/dashboard/appointments` },
  { file: '39_pos_main_page_hd.png', url: `${BASE}/ar/dashboard/pos` },
  { file: '43_customers_main_page_hd.png', url: `${BASE}/ar/dashboard/customers` },
  { file: '47_hot_deals_main_page.png', url: `${BASE}/ar/dashboard/hot-deals` },
  { file: '49_customer_push_main_page.png', url: `${BASE}/ar/dashboard/notifications` },
  { file: '51_reviews_main_page.png', url: `${BASE}/ar/dashboard/reviews` },
  { file: '52_page_setup_main_page.png', url: `${BASE}/ar/dashboard/page-setup` },
  { file: '56_billing_my_bills_page.png', url: `${BASE}/ar/dashboard/bills` },
  { file: '57_billing_my_subscription_page.png', url: `${BASE}/ar/dashboard/subscription` },
  { file: '58_billing_financial_page.png', url: `${BASE}/ar/dashboard/financial` },
  { file: '59_reports_main_page.png', url: `${BASE}/ar/dashboard/reports` },
  { file: '62_settings_overview_main_page.png', url: `${BASE}/ar/dashboard/settings` }
];

async function clickIfVisible(page, selectors){
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try { await el.click({ timeout: 2000 }); return true; } catch {}
    }
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE}/ar/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(1500);

  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  const passInput = page.locator('input[type="password"], input[name="password"]').first();
  await emailInput.fill(EMAIL);
  await passInput.fill(PASS);

  const loginSelectors = [
    'button:has-text("Login")',
    'button:has-text("تسجيل الدخول")',
    'button[type="submit"]'
  ];
  await clickIfVisible(page, loginSelectors);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  for (const s of shots) {
    await page.goto(s.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2500);

    // Try to close random overlays/modals if they appear
    await clickIfVisible(page, [
      'button:has-text("Close")',
      'button:has-text("إغلاق")',
      'button[aria-label="Close"]',
      'button[title="Close"]'
    ]);

    const out = path.join(outDir, s.file);
    await page.screenshot({ path: out, fullPage: true });
    console.log(`saved ${s.file}`);
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
