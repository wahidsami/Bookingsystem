'use strict';

const SUPPORT_TAXONOMY_CATALOG = [
    {
        key: 'dashboard',
        name: 'Dashboard',
        nameAr: 'لوحة التحكم',
        icon: '📊',
        featureKey: 'dashboard_home',
        featureRoute: '/dashboard?view=home',
        children: [
            { key: 'dashboard_overview', name: 'Overview', nameAr: 'نظرة عامة', icon: '🏠', featureKey: 'dashboard_overview', featureRoute: '/dashboard?view=home' },
            { key: 'dashboard_quick_search', name: 'Quick Search', nameAr: 'بحث سريع', icon: '🔎', featureKey: 'dashboard_quick_search', featureRoute: '/dashboard' }
        ]
    },
    {
        key: 'appointments',
        name: 'Appointments',
        nameAr: 'المواعيد',
        icon: '📅',
        featureKey: 'appointments',
        featureRoute: '/dashboard/appointments',
        children: [
            { key: 'appointments_calendar', name: 'Appointment Board', nameAr: 'لوحة المواعيد', icon: '🗓️', featureKey: 'appointments_calendar', featureRoute: '/dashboard/appointments' },
            { key: 'appointments_create', name: 'Create Appointment', nameAr: 'إنشاء موعد', icon: '➕', featureKey: 'appointments_create', featureRoute: '/dashboard/appointments/new' },
            { key: 'appointments_details', name: 'Appointment Details', nameAr: 'تفاصيل الموعد', icon: '🪪', featureKey: 'appointments_details', featureRoute: '/dashboard/appointments/[id]' },
            { key: 'appointments_reschedule', name: 'Reschedule', nameAr: 'إعادة الجدولة', icon: '🔁', featureKey: 'appointments_reschedule', featureRoute: '/dashboard/appointments/[id]' },
            { key: 'appointments_cancel', name: 'Cancellation', nameAr: 'الإلغاء', icon: '✖️', featureKey: 'appointments_cancel', featureRoute: '/dashboard/appointments/[id]' },
            { key: 'appointments_block_time', name: 'Block Time', nameAr: 'حظر وقت', icon: '⛔', featureKey: 'appointments_block_time', featureRoute: '/dashboard/appointments' },
            { key: 'appointments_guest_participants', name: 'Guest Participants', nameAr: 'المشاركون', icon: '👥', featureKey: 'appointments_guest_participants', featureRoute: '/dashboard/appointments/new' },
            { key: 'appointments_checkout_payment', name: 'Checkout & Payment', nameAr: 'الدفع وإنهاء الخدمة', icon: '💳', featureKey: 'appointments_checkout_payment', featureRoute: '/dashboard/appointments/[id]' }
        ]
    },
    {
        key: 'customers',
        name: 'Customers',
        nameAr: 'العملاء',
        icon: '👤',
        featureKey: 'customers',
        featureRoute: '/dashboard/customers',
        children: [
            { key: 'customers_list', name: 'Customer List', nameAr: 'قائمة العملاء', icon: '📋', featureKey: 'customers_list', featureRoute: '/dashboard/customers' },
            { key: 'customers_details', name: 'Customer Details', nameAr: 'تفاصيل العميل', icon: '🪪', featureKey: 'customers_details', featureRoute: '/dashboard/customers/[id]' },
            { key: 'customers_wallet', name: 'Wallet', nameAr: 'المحفظة', icon: '👛', featureKey: 'customers_wallet', featureRoute: '/dashboard/customers/[id]/wallet' },
            { key: 'customers_history', name: 'History', nameAr: 'السجل', icon: '🕓', featureKey: 'customers_history', featureRoute: '/dashboard/customers/[id]' },
            { key: 'customers_transactions', name: 'Transactions', nameAr: 'المعاملات', icon: '💸', featureKey: 'customers_transactions', featureRoute: '/dashboard/customers/[id]' }
        ]
    },
    {
        key: 'services',
        name: 'Services',
        nameAr: 'الخدمات',
        icon: '✂️',
        featureKey: 'services',
        featureRoute: '/dashboard/services',
        children: [
            { key: 'services_list', name: 'Service List', nameAr: 'قائمة الخدمات', icon: '📋', featureKey: 'services_list', featureRoute: '/dashboard/services' },
            { key: 'services_create', name: 'Create Service', nameAr: 'إضافة خدمة', icon: '➕', featureKey: 'services_create', featureRoute: '/dashboard/services/new' },
            { key: 'services_details', name: 'Service Details', nameAr: 'تفاصيل الخدمة', icon: '🪪', featureKey: 'services_details', featureRoute: '/dashboard/services/[id]' },
            { key: 'services_pricing', name: 'Pricing Variants', nameAr: 'الأسعار والخيارات', icon: '💰', featureKey: 'services_pricing', featureRoute: '/dashboard/services/[id]' },
            { key: 'services_team', name: 'Team Assignment', nameAr: 'إسناد الفريق', icon: '👥', featureKey: 'services_team', featureRoute: '/dashboard/services/[id]' }
        ]
    },
    {
        key: 'products',
        name: 'Products',
        nameAr: 'المنتجات',
        icon: '🛍️',
        featureKey: 'products',
        featureRoute: '/dashboard/products',
        children: [
            { key: 'products_list', name: 'Product List', nameAr: 'قائمة المنتجات', icon: '📋', featureKey: 'products_list', featureRoute: '/dashboard/products' },
            { key: 'products_create', name: 'Create Product', nameAr: 'إضافة منتج', icon: '➕', featureKey: 'products_create', featureRoute: '/dashboard/products/new' },
            { key: 'products_details', name: 'Product Details', nameAr: 'تفاصيل المنتج', icon: '🪪', featureKey: 'products_details', featureRoute: '/dashboard/products/[id]' },
            { key: 'products_inventory', name: 'Inventory', nameAr: 'المخزون', icon: '📦', featureKey: 'products_inventory', featureRoute: '/dashboard/products/[id]' },
            { key: 'products_orders', name: 'Orders', nameAr: 'الطلبات', icon: '🧾', featureKey: 'products_orders', featureRoute: '/dashboard/orders' }
        ]
    },
    {
        key: 'employees',
        name: 'Employees',
        nameAr: 'الموظفون',
        icon: '👥',
        featureKey: 'employees',
        featureRoute: '/dashboard/employees',
        children: [
            { key: 'employees_list', name: 'Employee List', nameAr: 'قائمة الموظفين', icon: '📋', featureKey: 'employees_list', featureRoute: '/dashboard/employees' },
            { key: 'employees_create', name: 'Create Employee', nameAr: 'إضافة موظف', icon: '➕', featureKey: 'employees_create', featureRoute: '/dashboard/employees/new' },
            { key: 'employees_details', name: 'Employee Details', nameAr: 'تفاصيل الموظف', icon: '🪪', featureKey: 'employees_details', featureRoute: '/dashboard/employees/[id]' },
            { key: 'employees_schedule', name: 'Weekly Schedule', nameAr: 'الجدول الأسبوعي', icon: '🗓️', featureKey: 'employees_schedule', featureRoute: '/dashboard/schedules' },
            { key: 'employees_permissions', name: 'Permissions', nameAr: 'الصلاحيات', icon: '🔐', featureKey: 'employees_permissions', featureRoute: '/dashboard/employees/[id]' }
        ]
    },
    {
        key: 'pos',
        name: 'POS',
        nameAr: 'نقطة البيع',
        icon: '💳',
        featureKey: 'pos',
        featureRoute: '/dashboard/pos',
        children: [
            { key: 'pos_checkout', name: 'POS Checkout', nameAr: 'الدفع عبر POS', icon: '🛒', featureKey: 'pos_checkout', featureRoute: '/dashboard/pos' },
            { key: 'pos_collections', name: 'Collections', nameAr: 'التحصيل', icon: '💰', featureKey: 'pos_collections', featureRoute: '/dashboard/pos' },
            { key: 'pos_closing', name: 'Closing & Settlement', nameAr: 'الإغلاق والتسوية', icon: '🧾', featureKey: 'pos_closing', featureRoute: '/dashboard/pos' }
        ]
    },
    {
        key: 'finance',
        name: 'Finance',
        nameAr: 'المالية',
        icon: '💰',
        featureKey: 'finance',
        featureRoute: '/dashboard/financial',
        children: [
            { key: 'finance_overview', name: 'Financial Overview', nameAr: 'نظرة مالية عامة', icon: '📊', featureKey: 'finance_overview', featureRoute: '/dashboard/financial' },
            { key: 'finance_ledger', name: 'Ledger', nameAr: 'دفتر القيود', icon: '📒', featureKey: 'finance_ledger', featureRoute: '/dashboard/financial/ledger' }
        ]
    },
    {
        key: 'reports',
        name: 'Reports',
        nameAr: 'التقارير',
        icon: '📈',
        featureKey: 'reports',
        featureRoute: '/dashboard/reports',
        children: [
            { key: 'reports_sales_summary', name: 'Sales Overview', nameAr: 'ملخص المبيعات', icon: '📊', featureKey: 'reports_sales_summary', featureRoute: '/dashboard/reports/sales/summary' },
            { key: 'reports_sales_list', name: 'Sales List', nameAr: 'قائمة المبيعات', icon: '📄', featureKey: 'reports_sales_list', featureRoute: '/dashboard/reports/sales/list' },
            { key: 'reports_sales_log', name: 'Sales Log Details', nameAr: 'تفاصيل السجل البيعي', icon: '🧾', featureKey: 'reports_sales_log', featureRoute: '/dashboard/reports/sales/log-details' },
            { key: 'reports_discounts', name: 'Discount Summary', nameAr: 'ملخص الخصومات', icon: '🏷️', featureKey: 'reports_discounts', featureRoute: '/dashboard/reports/sales/discounts' },
            { key: 'reports_taxes', name: 'Tax Summary', nameAr: 'ملخص الضرائب', icon: '🧾', featureKey: 'reports_taxes', featureRoute: '/dashboard/reports/sales/taxes' },
            { key: 'reports_gift_cards', name: 'Gift Card List', nameAr: 'قائمة بطاقات الهدايا', icon: '🎁', featureKey: 'reports_gift_cards', featureRoute: '/dashboard/reports/sales/gift-cards' },
            { key: 'reports_payment_transactions', name: 'Payment Transactions', nameAr: 'المعاملات المالية', icon: '💳', featureKey: 'reports_payment_transactions', featureRoute: '/dashboard/reports/financial/payment-transactions' },
            { key: 'reports_cash_flow', name: 'Cash Flow Summary', nameAr: 'ملخص التدفقات النقدية', icon: '💸', featureKey: 'reports_cash_flow', featureRoute: '/dashboard/reports/financial/cash-flow' },
            { key: 'reports_customer_sales', name: 'Customer Sales', nameAr: 'مبيعات العملاء', icon: '👥', featureKey: 'reports_customer_sales', featureRoute: '/dashboard/reports/customer-sales' },
            { key: 'reports_advanced_analytics', name: 'Advanced Analytics', nameAr: 'التحليلات المتقدمة', icon: '📈', featureKey: 'reports_advanced_analytics', featureRoute: '/dashboard/reports/advanced-analytics' }
        ]
    },
    {
        key: 'gift_cards',
        name: 'Gift Cards',
        nameAr: 'بطاقات الهدايا',
        icon: '🎁',
        featureKey: 'gift_cards',
        featureRoute: '/dashboard/gift-cards',
        children: [
            { key: 'gift_cards_packages', name: 'Gift Card Packages', nameAr: 'حزم بطاقات الهدايا', icon: '🎁', featureKey: 'gift_cards_packages', featureRoute: '/dashboard/gift-cards' },
            { key: 'gift_cards_issues', name: 'Issue Gift Card', nameAr: 'إصدار بطاقة هدية', icon: '✨', featureKey: 'gift_cards_issues', featureRoute: '/dashboard/appointments' },
            { key: 'gift_cards_transactions', name: 'Gift Card Transactions', nameAr: 'معاملات بطاقات الهدايا', icon: '💸', featureKey: 'gift_cards_transactions', featureRoute: '/dashboard/reports/sales/gift-cards' },
            { key: 'gift_cards_redemptions', name: 'Redemptions', nameAr: 'الاسترداد', icon: '♻️', featureKey: 'gift_cards_redemptions', featureRoute: '/dashboard/reports/sales/gift-cards' }
        ]
    },
    {
        key: 'marketing',
        name: 'Marketing',
        nameAr: 'التسويق',
        icon: '📣',
        featureKey: 'marketing',
        featureRoute: '/dashboard/marketing',
        children: [
            { key: 'marketing_hot_deals', name: 'Hot Deals', nameAr: 'العروض الساخنة', icon: '🔥', featureKey: 'marketing_hot_deals', featureRoute: '/dashboard/marketing' },
            { key: 'marketing_push_notifications', name: 'Push Notifications', nameAr: 'إشعارات الدفع', icon: '🔔', featureKey: 'marketing_push_notifications', featureRoute: '/dashboard/notifications' },
            { key: 'marketing_reviews', name: 'Reviews', nameAr: 'التقييمات', icon: '⭐', featureKey: 'marketing_reviews', featureRoute: '/dashboard/reviews' },
            { key: 'marketing_page_setup', name: 'Page Setup', nameAr: 'إعداد الصفحة', icon: '🧩', featureKey: 'marketing_page_setup', featureRoute: '/dashboard/page-setup' }
        ]
    },
    {
        key: 'notifications',
        name: 'Notifications',
        nameAr: 'الإشعارات',
        icon: '🔔',
        featureKey: 'notifications',
        featureRoute: '/dashboard/notifications',
        children: [
            { key: 'notifications_center', name: 'Notification Center', nameAr: 'مركز الإشعارات', icon: '🔔', featureKey: 'notifications_center', featureRoute: '/dashboard/notifications' },
            { key: 'notifications_history', name: 'History', nameAr: 'السجل', icon: '🕓', featureKey: 'notifications_history', featureRoute: '/dashboard/notifications' }
        ]
    },
    {
        key: 'payroll',
        name: 'Payroll',
        nameAr: 'الرواتب',
        icon: '🧾',
        featureKey: 'payroll',
        featureRoute: '/dashboard/payroll',
        children: [
            { key: 'payroll_overview', name: 'Payroll Overview', nameAr: 'نظرة الرواتب', icon: '📊', featureKey: 'payroll_overview', featureRoute: '/dashboard/payroll' },
            { key: 'payroll_records', name: 'Payroll Records', nameAr: 'سجلات الرواتب', icon: '🧾', featureKey: 'payroll_records', featureRoute: '/dashboard/payroll' }
        ]
    },
    {
        key: 'billing',
        name: 'Billing & Subscription',
        nameAr: 'الفواتير والاشتراكات',
        icon: '🧾',
        featureKey: 'billing',
        featureRoute: '/dashboard/bills',
        children: [
            { key: 'billing_bills', name: 'Bills', nameAr: 'الفواتير', icon: '🧾', featureKey: 'billing_bills', featureRoute: '/dashboard/bills' },
            { key: 'billing_subscription', name: 'Subscription', nameAr: 'الاشتراك', icon: '📦', featureKey: 'billing_subscription', featureRoute: '/dashboard/subscription' },
            { key: 'billing_upgrade', name: 'Upgrade', nameAr: 'الترقية', icon: '⬆️', featureKey: 'billing_upgrade', featureRoute: '/subscription/pay' }
        ]
    },
    {
        key: 'settings',
        name: 'Settings',
        nameAr: 'الإعدادات',
        icon: '⚙️',
        featureKey: 'settings',
        featureRoute: '/dashboard/settings',
        children: [
            { key: 'settings_general', name: 'General Settings', nameAr: 'الإعدادات العامة', icon: '⚙️', featureKey: 'settings_general', featureRoute: '/dashboard/settings' },
            { key: 'settings_dashboard_preferences', name: 'Dashboard Preferences', nameAr: 'تفضيلات لوحة التحكم', icon: '🧭', featureKey: 'settings_dashboard_preferences', featureRoute: '/dashboard/settings' },
            { key: 'settings_team_access', name: 'Team Access', nameAr: 'صلاحيات الفريق', icon: '👥', featureKey: 'settings_team_access', featureRoute: '/dashboard/settings' },
            { key: 'settings_password_security', name: 'Password Security', nameAr: 'أمان كلمة المرور', icon: '🔐', featureKey: 'settings_password_security', featureRoute: '/dashboard/settings' }
        ]
    },
    {
        key: 'support',
        name: 'Support',
        nameAr: 'الدعم',
        icon: '🎧',
        featureKey: 'support',
        featureRoute: '/dashboard/support',
        children: [
            { key: 'support_home', name: 'Support Home', nameAr: 'الصفحة الرئيسية للدعم', icon: '🏠', featureKey: 'support_home', featureRoute: '/dashboard/support' },
            { key: 'support_ticket_list', name: 'Ticket List', nameAr: 'قائمة التذاكر', icon: '🎫', featureKey: 'support_ticket_list', featureRoute: '/dashboard/support' },
            { key: 'support_ticket_details', name: 'Ticket Details', nameAr: 'تفاصيل التذكرة', icon: '🗨️', featureKey: 'support_ticket_details', featureRoute: '/dashboard/support/[id]' },
            { key: 'support_new_ticket', name: 'New Ticket', nameAr: 'تذكرة جديدة', icon: '➕', featureKey: 'support_new_ticket', featureRoute: '/dashboard/support' }
        ]
    },
    {
        key: 'ai',
        name: 'AI',
        nameAr: 'الذكاء الاصطناعي',
        icon: '🤖',
        featureKey: 'ai',
        featureRoute: '/dashboard/consultant',
        children: [
            { key: 'ai_consultant', name: 'Consultant', nameAr: 'المستشار', icon: '🧠', featureKey: 'ai_consultant', featureRoute: '/dashboard/consultant' },
            { key: 'ai_workflows', name: 'Workflows', nameAr: 'سير العمل', icon: '⚙️', featureKey: 'ai_workflows', featureRoute: '/dashboard/ai/consultant/workflows' },
            { key: 'ai_briefings', name: 'Briefings', nameAr: 'الملخصات', icon: '📝', featureKey: 'ai_briefings', featureRoute: '/dashboard/ai/consultant/briefings' }
        ]
    },
    {
        key: 'super_admin',
        name: 'Super Admin',
        nameAr: 'المشرف العام',
        icon: '🛡️',
        featureKey: 'super_admin',
        featureRoute: '/dashboard/clients-control',
        children: [
            { key: 'super_admin_clients_control', name: 'Clients Control', nameAr: 'إدارة العملاء', icon: '🎛️', featureKey: 'super_admin_clients_control', featureRoute: '/dashboard/clients-control' },
            { key: 'super_admin_clients', name: 'Clients', nameAr: 'العملاء', icon: '🏢', featureKey: 'super_admin_clients', featureRoute: '/dashboard/clients' },
            { key: 'super_admin_pending_clients', name: 'Pending Clients', nameAr: 'العملاء المعلقون', icon: '⏳', featureKey: 'super_admin_pending_clients', featureRoute: '/dashboard/clients/pending' },
            { key: 'super_admin_users', name: 'Users', nameAr: 'المستخدمون', icon: '👥', featureKey: 'super_admin_users', featureRoute: '/dashboard/users' },
            { key: 'super_admin_packages', name: 'Packages', nameAr: 'الباقات', icon: '📦', featureKey: 'super_admin_packages', featureRoute: '/dashboard/packages' },
            { key: 'super_admin_financial', name: 'Financial', nameAr: 'المالية', icon: '💰', featureKey: 'super_admin_financial', featureRoute: '/dashboard/financial' },
            { key: 'super_admin_activities', name: 'Activities', nameAr: 'الأنشطة', icon: '📋', featureKey: 'super_admin_activities', featureRoute: '/dashboard/activities' },
            { key: 'super_admin_notifications', name: 'Notifications', nameAr: 'الإشعارات', icon: '🔔', featureKey: 'super_admin_notifications', featureRoute: '/dashboard/notifications' }
        ]
    }
];

function cloneSupportTaxonomyNode(node) {
    return {
        ...node,
        children: Array.isArray(node.children) ? node.children.map(cloneSupportTaxonomyNode) : []
    };
}

function getSupportTaxonomyCatalog() {
    return SUPPORT_TAXONOMY_CATALOG.map(cloneSupportTaxonomyNode);
}

module.exports = {
    SUPPORT_TAXONOMY_CATALOG,
    getSupportTaxonomyCatalog
};
