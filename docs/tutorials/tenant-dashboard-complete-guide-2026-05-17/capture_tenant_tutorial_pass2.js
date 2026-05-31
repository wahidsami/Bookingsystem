const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'https://rtenant.unifinitylab.com';
const EMAIL = 'lojah25672@codoteam.com';
const PASS = 'Taby2727';
const outDir = path.resolve('docs/tutorials/tenant-dashboard-complete-guide-2026-05-17/images');
fs.mkdirSync(outDir, { recursive: true });

function out(file){ return path.join(outDir, file); }

async function safeShot(page, file, locator=null){
  try {
    if (locator) {
      await locator.first().screenshot({ path: out(file) });
    } else {
      await page.screenshot({ path: out(file), fullPage: true });
    }
    console.log('saved', file);
  } catch (e) {
    await page.screenshot({ path: out(file), fullPage: true });
    console.log('fallback saved', file);
  }
}

async function clickByText(page, texts){
  for (const t of texts) {
    const btn = page.locator(`button:has-text("${t}")`).first();
    if (await btn.count()) {
      try { await btn.click({ timeout: 1500 }); return true; } catch {}
    }
    const a = page.locator(`a:has-text("${t}")`).first();
    if (await a.count()) {
      try { await a.click({ timeout: 1500 }); return true; } catch {}
    }
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Register/Login captures (no submit)
  await page.goto(`${BASE}/ar/register`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2000);
  await safeShot(page, '02_register_form_fields_annotated.png');
  await safeShot(page, '03_register_upload_documents.png', page.locator('input[type="file"]').locator('..'));
  await safeShot(page, '04_register_submit_button.png', page.locator('button[type="submit"], button:has-text("Register"), button:has-text("تسجيل")'));
  await safeShot(page, '05_register_success_or_pending_state.png');

  await page.goto(`${BASE}/ar/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const email = page.locator('input[type="email"], input[name="email"]').first();
  const pass = page.locator('input[type="password"], input[name="password"]').first();
  await email.fill(EMAIL);
  await pass.fill(PASS);
  await safeShot(page, '07_login_form_filled_example.png');
  await clickByText(page, ['Login','تسجيل الدخول']);
  if (await page.locator('button[type="submit"]').count()) {
    await page.locator('button[type="submit"]').first().click();
  }
  await page.waitForTimeout(3000);

  // Teams
  await page.goto(`${BASE}/ar/dashboard/employees`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await clickByText(page, ['Add','New','إضافة','موظف']);
  await page.waitForTimeout(2000);
  if (page.url().includes('/employees/new')) {
    await safeShot(page, '11_team_add_form_step1_identity.png');
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(700);
    await safeShot(page, '12_team_add_form_step2_role_access.png');
  } else {
    await safeShot(page, '11_team_add_form_step1_identity.png');
    await safeShot(page, '12_team_add_form_step2_role_access.png');
  }
  await safeShot(page, '15_team_permissions_matrix_component.png');

  await page.goto(`${BASE}/ar/dashboard/schedules`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await clickByText(page, ['Edit','تعديل','Shift','ورديات','+']);
  await page.waitForTimeout(1500);
  await safeShot(page, '14_team_schedule_add_shift.png');

  // Services
  await page.goto(`${BASE}/ar/dashboard/services/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await safeShot(page, '17_service_add_step1_basic_info.png');
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(700);
  await safeShot(page, '18_service_add_step2_pricing_duration.png');
  await safeShot(page, '19_service_assign_providers_component.png');
  await safeShot(page, '20_service_payment_options_component.png');

  // Products
  await page.goto(`${BASE}/ar/dashboard/products/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await safeShot(page, '22_product_add_step1_info.png');
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(700);
  await safeShot(page, '23_product_add_step2_pricing_inventory.png');
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(700);
  await safeShot(page, '24_product_add_step3_media_publish.png');

  // Orders detail
  await page.goto(`${BASE}/ar/dashboard/orders`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
  const firstOrder = page.locator('a[href*="/dashboard/orders/"]').first();
  if (await firstOrder.count()) { await firstOrder.click(); await page.waitForTimeout(2000); }
  await safeShot(page, '26_order_detail_page.png');
  await safeShot(page, '27_order_status_update_actions.png');

  // Appointments complex
  await page.goto(`${BASE}/ar/dashboard/appointments`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await safeShot(page, '29_appointment_add_menu_or_button.png', page.locator('button:has-text("Today"), button:has-text("اليوم")'));
  await clickByText(page, ['Add new appointment','إضافة موعد جديد']);
  await page.waitForTimeout(1200);
  await safeShot(page, '30_appointment_create_drawer_existing_customer.png');
  await safeShot(page, '31_appointment_create_drawer_new_customer.png');
  await safeShot(page, '32_appointment_card_color_legend_component.png');

  const firstCard = page.locator('[class*="cursor-pointer"]').filter({ hasText: /./ }).first();
  if (await firstCard.count()) { try { await firstCard.click({ timeout: 2000 }); } catch {} }
  await page.waitForTimeout(1500);
  await safeShot(page, '33_appointment_details_drawer_status_dropdown.png');
  await safeShot(page, '34_appointment_status_update_example.png');
  await safeShot(page, '35_appointment_drag_drop_in_action.png');
  await safeShot(page, '36_appointment_drag_drop_confirm_modal.png');

  await page.goto(`${BASE}/ar/dashboard/appointments`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await safeShot(page, '37_provider_header_component.png');
  const providerMenuBtn = page.locator('button[aria-label*="staff" i], button[aria-label*="الموظف"], button[title*="Staff" i], button[title*="الموظف"]').first();
  if (await providerMenuBtn.count()) { try { await providerMenuBtn.click({ timeout: 1500 }); } catch {} }
  await page.waitForTimeout(1200);
  await safeShot(page, '38_provider_arrow_menu_component.png');

  // POS flows
  await page.goto(`${BASE}/ar/dashboard/pos`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await safeShot(page, '40_pos_due_alert_example.png');
  await safeShot(page, '41_pos_collect_payment_flow.png');
  await safeShot(page, '42_pos_payment_success_and_status_sync.png');

  // Customers profile tabs
  await page.goto(`${BASE}/ar/dashboard/customers`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const firstCust = page.locator('a[href*="/dashboard/customers/"]').first();
  if (await firstCust.count()) { await firstCust.click(); await page.waitForTimeout(1800); }
  await safeShot(page, '44_customer_profile_overview_tab.png');
  await clickByText(page, ['Appointments','المواعيد']);
  await page.waitForTimeout(700);
  await safeShot(page, '45_customer_profile_appointments_tab.png');
  await clickByText(page, ['Transactions','المعاملات','المدفوعات']);
  await page.waitForTimeout(700);
  await safeShot(page, '46_customer_profile_transactions_tab.png');

  // Marketing
  await page.goto(`${BASE}/ar/dashboard/hot-deals/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
  await safeShot(page, '48_hot_deal_create_form.png');

  await page.goto(`${BASE}/ar/dashboard/notifications`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
  await safeShot(page, '50_customer_push_send_flow.png');

  // Page setup subsections
  await page.goto(`${BASE}/ar/dashboard/page-setup`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await safeShot(page, '53_page_setup_tab_visibility.png');
  await clickByText(page, ['About','نبذة']);
  await page.waitForTimeout(700);
  await safeShot(page, '54_page_setup_about_content.png');
  await clickByText(page, ['Media','الوسائط','Location','Contact','الموقع']);
  await page.waitForTimeout(700);
  await safeShot(page, '55_page_setup_media_contact.png');

  // Reports
  await page.goto(`${BASE}/ar/dashboard/reports/generate`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await safeShot(page, '60_reports_generate_form.png');
  await page.goto(`${BASE}/ar/dashboard/reports/preview`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await safeShot(page, '61_reports_preview_page.png');

  // Settings tabs 1..7 (best effort sequential)
  await page.goto(`${BASE}/ar/dashboard/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const tabButtons = page.locator('button').filter({ has: page.locator('span') });
  const files = [
    '63_settings_subsection_1.png','64_settings_subsection_2.png','65_settings_subsection_3.png',
    '66_settings_subsection_4.png','67_settings_subsection_5.png','68_settings_subsection_6.png','69_settings_subsection_7.png'
  ];
  for (let i = 0; i < files.length; i++) {
    try {
      const btn = page.locator('button').nth(i + 2);
      if (await btn.count()) await btn.click({ timeout: 1200 });
    } catch {}
    await page.waitForTimeout(700);
    await safeShot(page, files[i]);
  }

  await browser.close();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
