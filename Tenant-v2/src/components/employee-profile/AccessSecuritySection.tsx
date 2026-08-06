import React from 'react';
import { Lock, Shield, CheckSquare, Square } from 'lucide-react';
import { TeamMemberData, STAFF_APP_PERMISSION_KEYS, StaffAppPermissionKey } from '../../types/employee';

interface AccessSecuritySectionProps {
  formData: TeamMemberData;
  setFormData: React.Dispatch<React.SetStateAction<TeamMemberData>>;
  isRtl: boolean;
  staffAppPermissions: Record<StaffAppPermissionKey, boolean>;
  setStaffAppPermissions: React.Dispatch<React.SetStateAction<Record<StaffAppPermissionKey, boolean>>>;
}

export default function AccessSecuritySection({
  formData,
  setFormData,
  isRtl,
  staffAppPermissions,
  setStaffAppPermissions
}: AccessSecuritySectionProps) {

  const applyRolePreset = (preset: string) => {
    // We map preset to a set of boolean flags.
    // For simplicity, we just clone current dashboardPermissions and override based on preset.
    setFormData(prev => {
      const clonedPerms = { ...prev.dashboardPermissions };
      // Reset all to false first for a clean preset application
      (Object.keys(clonedPerms) as Array<keyof typeof clonedPerms>).forEach(k => {
        if (typeof clonedPerms[k] === 'boolean') {
          clonedPerms[k] = false;
        }
      });
      
      if (preset === 'manager') {
        Object.keys(clonedPerms).forEach(k => {
          if (typeof clonedPerms[k as keyof typeof clonedPerms] === 'boolean') {
            clonedPerms[k as keyof typeof clonedPerms] = true;
          }
        });
      } else if (preset === 'accountant') {
        clonedPerms.view_dashboard = true;
        clonedPerms.view_financial = true;
        clonedPerms.view_bills = true;
        clonedPerms.view_payroll = true;
        clonedPerms.view_orders = true;
        clonedPerms.manage_financials = true;
      } else if (preset === 'receptionist') {
        clonedPerms.view_dashboard = true;
        clonedPerms.view_appointments = true;
        clonedPerms.view_customers = true;
        clonedPerms.view_pos = true;
        clonedPerms.view_orders = true;
        clonedPerms.manage_appointments = true;
      } else if (preset === 'marketing') {
        clonedPerms.view_dashboard = true;
        clonedPerms.view_customers = true;
        clonedPerms.view_reviews = true;
        clonedPerms.view_hot_deals = true;
      } else if (preset === 'hr') {
        clonedPerms.view_dashboard = true;
        clonedPerms.view_employees = true;
        clonedPerms.view_schedules = true;
        clonedPerms.view_payroll = true;
      } else if (preset === 'service_provider') {
        clonedPerms.view_dashboard = true;
        clonedPerms.view_appointments = true;
        clonedPerms.manage_appointments = true;
      }

      return { ...prev, dashboardPermissions: clonedPerms };
    });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="border-b border-neutral-100 pb-2">
        <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">{isRtl ? 'أمان النظام ومسارات الوصول والصلاحيات' : 'Security Accounts & Access Authorization'}</h4>
        <p className="text-[11px] text-neutral-400 font-medium font-mono">Reconcile login paths based on organization position role. Set staff app passcodes or allocate precise dashboard module permissions.</p>
      </div>

      {/* Account Status Toggle (Active vs Suspended) */}
      <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-between text-xs gap-3">
        <div>
          <p className="font-extrabold text-neutral-800">{isRtl ? 'حالة نشاط الحساب وصلاحية الدخول' : 'Account Activation & Credential Status'}</p>
          <span className="text-[10px] text-neutral-400 font-bold block mt-0.5">
            {formData.isActive 
              ? (isRtl ? 'الحساب مفعل ويمكنه تسجيل الدخول فوراً' : 'Account active. Authorized to establish secure connection.')
              : (isRtl ? 'الحساب معطل حالياً ومحجوب عن النظام' : 'Account temporarily frozen. Revokes all system privileges.')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setFormData(p => ({ ...p, isActive: !p.isActive }))}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
            formData.isActive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {formData.isActive ? (isRtl ? '● نشط ومصرح' : '● ACTIVE / ENABLED') : (isRtl ? '○ معطل وموقوف' : '○ DISABLED / SUSPENDED')}
        </button>
      </div>

      {formData.position === 'service_provider' ? (
        /* Staff App passcode credentials path */
        <div className="p-5 bg-indigo-50/40 rounded-2xl border border-indigo-100 space-y-4 text-xs font-bold">
          <div className="flex items-center gap-2 text-indigo-900">
            <Lock size={15} />
            <span>{isRtl ? 'تطبيق الكادر الفني للهواتف (Refah Staff App)' : 'Refah Staff Mobile Application Access'}</span>
          </div>
          <p className="text-neutral-600 text-[11px] leading-relaxed font-medium">
            Because this roster position is flagged as a <strong>Service Provider</strong>, they will log into the Refah mobile app. Set their access passcode below.
          </p>

          <div className="space-y-1.5 max-w-sm">
            <label className="text-[10px] text-indigo-900 font-extrabold block">{isRtl ? 'رمز المرور المؤقت للتطبيق (الحد الأدنى ٨ خانات) *' : 'Temporary App Password (Min 8 Characters) *'}</label>
            <input
              type="text"
              required
              minLength={8}
              value={formData.staffAppPassword}
              onChange={e => setFormData(p => ({ ...p, staffAppPassword: e.target.value }))}
              className="w-full bg-white border border-indigo-200 rounded-xl p-3 text-xs font-bold font-mono text-neutral-800 focus:ring-1 focus:ring-indigo-500"
            />
            {formData.staffAppPassword && formData.staffAppPassword.length < 8 && (
              <p className="text-rose-600 text-[10px] font-bold mt-1">
                {isRtl ? '⚠️ يجب أن يتكون الرمز من ٨ خانات على الأقل!' : '⚠️ Password must be at least 8 characters long!'}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-white/90 p-4 space-y-3">
            <div>
              <h5 className="text-[11px] font-black text-neutral-800">
                {isRtl ? 'صلاحيات تطبيق الموظف' : 'Staff app permissions'}
              </h5>
              <p className="text-[10px] text-neutral-500 font-medium">
                {isRtl
                  ? 'هذه الصلاحيات تتحكم بما يظهر في تطبيق الموظف لهذا العضو.'
                  : 'These permissions control what this employee can access in the staff app.'}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STAFF_APP_PERMISSION_KEYS.map((key) => (
                <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-neutral-700">
                    {key === 'view_earnings' && (isRtl ? 'عرض الأرباح' : 'View earnings')}
                    {key === 'view_reviews' && (isRtl ? 'عرض التقييمات' : 'View reviews')}
                    {key === 'reply_reviews' && (isRtl ? 'الرد على التقييمات' : 'Reply to reviews')}
                    {key === 'view_clients' && (isRtl ? 'عرض العملاء' : 'View clients')}
                    {key === 'view_booking_notes' && (isRtl ? 'عرض ملاحظات الحجز' : 'View booking notes')}
                    {key === 'can_start_service' && (isRtl ? 'إظهار زر بدء الخدمة' : 'Show Start button')}
                    {key === 'can_mark_no_show' && (isRtl ? 'إظهار زر عدم الحضور' : 'Show No-show button')}
                  </span>
                  <input
                    type="checkbox"
                    checked={staffAppPermissions[key as StaffAppPermissionKey]}
                    onChange={(event) => setStaffAppPermissions((prev) => ({
                      ...prev,
                      [key]: event.target.checked
                    }))}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Dashboard Admin permissions matrix with Role Presets */
        <div className="space-y-4">
          <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-200/40 text-xs font-bold text-amber-900 space-y-1">
            <p className="flex items-center gap-1.5"><Shield size={14} /> {isRtl ? 'بوابة لوحة تحكم الإدارة العليا والموظفين' : 'Tenant Admin Dashboard Access Link'}</p>
            <p className="text-[11px] text-neutral-600 leading-normal font-medium">This specialist is designated as a <strong>Dashboard Admin</strong>. Select a predefined role preset or customize module permissions manually.</p>
          </div>

          {/* Role Presets */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'تطبيق قالب صلاحيات جاهز' : 'Apply Role Preset Template'}</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'manager', labelEn: 'General Manager', labelAr: 'مدير عام الفرع' },
                { key: 'accountant', labelEn: 'Accountant', labelAr: 'المحاسب المالي' },
                { key: 'receptionist', labelEn: 'Receptionist / Front Desk', labelAr: 'موظف الاستقبال' },
                { key: 'marketing', labelEn: 'Marketing Planner', labelAr: 'التسويق والعروض' },
                { key: 'hr', labelEn: 'HR / Personnel', labelAr: 'شؤون الموظفين' },
                { key: 'service_provider', labelEn: 'Senior Specialist', labelAr: 'الأخصائية الكبرى' }
              ].map(preset => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyRolePreset(preset.key)}
                  className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 rounded-lg text-[10px] font-black cursor-pointer transition-all border border-neutral-200"
                >
                  {isRtl ? preset.labelAr : preset.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Detailed Permission Grid (All 20 keys) */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'مصفوفة التراخيص والصلاحيات التفصيلية (٢٠ مفتاح)' : 'Granular Dashboard Permission Matrix (20 Keys)'}</label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-1">
              {[
                { key: 'view_dashboard', labelEn: 'Access Main Dashboard', labelAr: 'الوصول للوحة التحكم الرئيسية' },
                { key: 'view_appointments', labelEn: 'Manage Customer Appointments', labelAr: 'إدارة وحجز مواعيد العملاء' },
                { key: 'view_schedules', labelEn: 'Manage Shifts & Rosters', labelAr: 'إدارة جداول وشيفتات الموظفين' },
                { key: 'view_employees', labelEn: 'Manage Team Directory', labelAr: 'عرض وإدارة ملفات الموظفين' },
                { key: 'view_customers', labelEn: 'Manage Client Profile Records', labelAr: 'سجلات وملفات العملاء' },
                { key: 'view_services', labelEn: 'Configure Service Catalog', labelAr: 'إعداد وتحديث قائمة الخدمات' },
                { key: 'view_products', labelEn: 'Manage Premium Products Inventory', labelAr: 'مستودع ومخزن المنتجات' },
                { key: 'view_orders', labelEn: 'Track Client Orders & Invoices', labelAr: 'مبيعات وفواتير الخدمات بالتفصيل' },
                { key: 'view_financial', labelEn: 'Reconcile Financial Ledgers', labelAr: 'السجلات المالية وحساب العمولات' },
                { key: 'view_bills', labelEn: 'Manage Operating Branch Expenses', labelAr: 'المصاريف وفواتير التشغيل اليومية' },
                { key: 'view_pos', labelEn: 'Access Cashier Register (POS)', labelAr: 'بوابة المبيعات المباشرة كاشير' },
                { key: 'view_messages', labelEn: 'Client Messaging & Chats', labelAr: 'رسائل ومحادثات العملاء' },
                { key: 'view_reviews', labelEn: 'Moderate Client Reviews', labelAr: 'تقييمات وملاحظات العملاء' },
                { key: 'view_hot_deals', labelEn: 'Campaigns & Dynamic Promos', labelAr: 'الحملات التسويقية والعروض الخاصة' },
                { key: 'view_notifications', labelEn: 'Access Workspace Notifications', labelAr: 'تنبيهات وإشعارات الفرع' },
                { key: 'view_reports', labelEn: 'Analytical Performance Reports', labelAr: 'التقارير الإحصائية والتحليلات' },
                { key: 'view_payroll', labelEn: 'Manage Payroll & Base Salaries', labelAr: 'مسيرات الرواتب والمستحقات والعمولات' },
                { key: 'view_subscription', labelEn: 'Configure Plan & Subscription', labelAr: 'باقة الاشتراك والحدود المسموحة' },
                { key: 'view_settings', labelEn: 'Configure core portal settings', labelAr: 'إعداد خصائص ومحددات النظام' },
                { key: 'manage_accounts', labelEn: 'Security & Staff Access Accounts', labelAr: 'أمن حسابات المشرفين والمدراء' }
              ].map(perm => {
                const isChecked = !!(formData.dashboardPermissions as any)[perm.key];
                return (
                  <button
                    key={perm.key}
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      dashboardPermissions: {
                        ...prev.dashboardPermissions,
                        [perm.key]: !isChecked,
                        // Mirror to existing legacy keys for backward compatibility
                        ...(perm.key === 'view_appointments' ? { manage_appointments: !isChecked } : {}),
                        ...(perm.key === 'view_financial' ? { manage_financials: !isChecked } : {}),
                        ...(perm.key === 'view_settings' ? { manage_settings: !isChecked } : {})
                      }
                    }))}
                    className={`p-3 rounded-xl text-xs font-black text-start transition-all cursor-pointer border flex items-center justify-between gap-3 ${
                      isChecked
                        ? 'bg-zinc-900 border-zinc-950 text-white shadow-sm'
                        : 'bg-white hover:bg-neutral-50 text-neutral-500 border-slate-200'
                    }`}
                  >
                    <span className="truncate">{isRtl ? perm.labelAr : perm.labelEn}</span>
                    {isChecked ? (
                      <CheckSquare size={15} className="text-indigo-400 shrink-0" />
                    ) : (
                      <Square size={15} className="text-neutral-300 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
