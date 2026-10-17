import React, { useState } from 'react';
import { Lock, Shield, CheckSquare, Square, Mail, KeyRound, Check, AlertCircle, X } from 'lucide-react';
import { TeamMemberData, STAFF_APP_PERMISSION_KEYS, StaffAppPermissionKey } from '../../types/employee';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';

interface AccessSecuritySectionProps {
  formData: TeamMemberData;
  setFormData: React.Dispatch<React.SetStateAction<TeamMemberData>>;
  isRtl: boolean;
  staffAppPermissions: Record<StaffAppPermissionKey, boolean>;
  setStaffAppPermissions: React.Dispatch<React.SetStateAction<Record<StaffAppPermissionKey, boolean>>>;
  formMode?: 'add' | 'edit';
}

export default function AccessSecuritySection({
  formData,
  setFormData,
  isRtl,
  staffAppPermissions,
  setStaffAppPermissions,
  formMode
}: AccessSecuritySectionProps) {
  const [actionStatus, setActionStatus] = useState<{ messageEn: string; messageAr: string; type: 'success' | 'error' } | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleSendAppInvite = async () => {
    if (!formData.id) return;
    try {
      setIsSendingInvite(true);
      const res = await tenantApiAdapter.sendEmployeeAppInvite(formData.id);
      if (res?.success) {
        setActionStatus({
          messageEn: 'App invite sent successfully via email.',
          messageAr: 'تم إرسال دعوة تسجيل الدخول بالتطبيق بنجاح عبر البريد الإلكتروني.',
          type: 'success'
        });
      } else {
        setActionStatus({
          messageEn: 'Failed to send invite.',
          messageAr: 'فشل في إرسال الدعوة، يرجى المحاولة لاحقاً.',
          type: 'error'
        });
      }
    } catch (err: any) {
      setActionStatus({
        messageEn: err.message || 'Error sending invite',
        messageAr: 'حدث خطأ أثناء إرسال الدعوة: ' + (err.message || ''),
        type: 'error'
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleExecutePasswordReset = async () => {
    if (!formData.id) return;
    setConfirmResetOpen(false);
    try {
      setIsResettingPassword(true);
      const res = await tenantApiAdapter.resetEmployeePassword(formData.id);
      if (res?.success) {
        setActionStatus({
          messageEn: 'Password reset successfully and sent to employee email.',
          messageAr: 'تم إعادة تعيين كلمة المرور وإرسالها للموظف بالبريد بنجاح.',
          type: 'success'
        });
      } else {
        setActionStatus({
          messageEn: 'Failed to reset password.',
          messageAr: 'فشل في إعادة تعيين كلمة المرور.',
          type: 'error'
        });
      }
    } catch (err: any) {
      setActionStatus({
        messageEn: err.message || 'Error resetting password',
        messageAr: 'حدث خطأ أثناء إعادة التعيين: ' + (err.message || ''),
        type: 'error'
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const applyRolePreset = (preset: string) => {
    setFormData(prev => {
      const clonedPerms = { ...prev.dashboardPermissions };
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
    <div className="space-y-5 animate-fade-in">
      <div className="border-b border-neutral-100 pb-3">
        <h4 className="text-sm font-black text-neutral-900 tracking-tight flex items-center gap-2">
          <Shield size={16} className="text-[#6537C0]" />
          <span>{isRtl ? 'أمان النظام ومسارات الوصول والصلاحيات' : 'Access Authorization & System Security'}</span>
        </h4>
        <p className="text-xs text-neutral-500 font-medium mt-0.5">
          {isRtl 
            ? 'تحديد قنوات تسجيل الدخول المعتمدة، كلمة المرور المؤقتة، ومصفوفة الصلاحيات حسب الدور الوظيفي.' 
            : 'Configure login channels, staff app credentials, and module permissions based on role designation.'}
        </p>
      </div>

      {/* In-app action feedback banner */}
      {actionStatus && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between animate-fade-in border ${
          actionStatus.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {actionStatus.type === 'success' ? <Check size={14} className="text-emerald-600" /> : <AlertCircle size={14} className="text-rose-600" />}
            <span>{isRtl ? actionStatus.messageAr : actionStatus.messageEn}</span>
          </div>
          <button type="button" onClick={() => setActionStatus(null)} className="text-neutral-400 hover:text-neutral-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Confirmation modal for password reset */}
      {confirmResetOpen && (
        <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-3 animate-fade-in">
          <p className="text-xs font-bold text-[#1D035F]">
            {isRtl 
              ? 'هل أنت متأكد من رغبتك في إعادة تعيين كلمة المرور؟ سيتم توليد كلمة سر جديدة وإرسالها لبريد الموظف.' 
              : 'Are you sure you want to reset the password? A new passcode will be generated and emailed.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExecutePasswordReset}
              className="px-3.5 py-1.5 bg-[#1D035F] hover:bg-[#2A0878] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-xs"
            >
              {isRtl ? 'تأكيد وإرسال' : 'Confirm & Send'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmResetOpen(false)}
              className="px-3 py-1.5 bg-white border border-neutral-200 text-neutral-600 text-xs font-bold rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Account Status Toggle (Active vs Suspended) */}
      <div className="p-4 bg-neutral-50/60 border border-neutral-200/80 rounded-2xl flex items-center justify-between text-xs gap-3">
        <div>
          <p className="font-extrabold text-neutral-900">{isRtl ? 'حالة نشاط الحساب وصلاحية الدخول' : 'Account Status & Access Clearance'}</p>
          <span className="text-[11px] text-neutral-500 font-medium block mt-0.5">
            {formData.isActive 
              ? (isRtl ? 'الحساب نشط ومصرح له بتسجيل الدخول وإجراء العمليات.' : 'Account active. Authorized to connect and perform operations.')
              : (isRtl ? 'الحساب موقوف حالياً ومحجوب عن تسجيل الدخول.' : 'Account suspended. System login is restricted.')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setFormData(p => ({ ...p, isActive: !p.isActive }))}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
            formData.isActive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'
              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70'
          }`}
        >
          {formData.isActive ? (isRtl ? '● نشط ومصرح' : '● ACTIVE') : (isRtl ? '○ معطل وموقوف' : '○ SUSPENDED')}
        </button>
      </div>

      {formData.position === 'service_provider' ? (
        /* Staff App passcode credentials path */
        <div className="p-4 bg-neutral-50/60 rounded-2xl border border-neutral-200/80 space-y-4 text-xs font-bold">
          <div className="flex items-center gap-2 text-[#1D035F]">
            <Lock size={15} className="text-[#6537C0]" />
            <span className="font-extrabold">{isRtl ? 'تطبيق الكادر الفني للهواتف (BarSpa Staff App)' : 'BarSpa Staff Mobile Application Access'}</span>
          </div>
          <p className="text-neutral-600 text-xs leading-relaxed font-medium">
            {isRtl 
              ? 'نظراً لأن هذا الموظف مصنف كـ "مقدم خدمة"، فإنه يقوم بتسجيل الدخول عبر تطبيق بارسبا المخصص للكادر. حدد رمز المرور أدناه.'
              : 'Because this employee is designated as a Service Provider, they log into the BarSpa Staff App. Set access passcode below.'}
          </p>

          <div className="space-y-1.5 max-w-sm">
            <label className="text-[11px] text-neutral-700 font-extrabold block">
              {isRtl ? 'رمز المرور المؤقت للتطبيق (٨ خانات على الأقل) *' : 'Temporary App Password (Min 8 Characters) *'}
            </label>
            <input
              type="text"
              required={formMode === 'add'}
              minLength={8}
              value={formData.staffAppPassword}
              onChange={e => setFormData(p => ({ ...p, staffAppPassword: e.target.value }))}
              placeholder={formMode === 'edit' ? (isRtl ? 'اتركه فارغاً، استخدم إجراءات الإدارة أدناه' : 'Leave blank, use management actions below') : ''}
              disabled={formMode === 'edit'}
              className={`w-full bg-white border border-neutral-200 rounded-xl p-2.5 text-xs font-mono font-bold text-neutral-900 focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0] ${formMode === 'edit' ? 'opacity-60 cursor-not-allowed bg-neutral-100/70' : ''}`}
            />
            {formMode === 'add' && formData.staffAppPassword && formData.staffAppPassword.length < 8 && (
              <p className="text-rose-600 text-[10px] font-bold mt-1">
                {isRtl ? '⚠️ يجب أن يتكون الرمز من ٨ خانات على الأقل' : '⚠️ Password must be at least 8 characters long'}
              </p>
            )}
          </div>

          {/* Granular Staff App Permissions */}
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 space-y-3">
            <div>
              <h5 className="text-xs font-black text-neutral-900">
                {isRtl ? 'صلاحيات تطبيق الموظف' : 'Staff App Permissions'}
              </h5>
              <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                {isRtl
                  ? 'هذه الصلاحيات تتحكم بالوظائف والشاشات المتاحة لهذا الموظف عبر تطبيق الهاتف.'
                  : 'These permissions control the features accessible in the staff mobile application.'}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STAFF_APP_PERMISSION_KEYS.map((key) => {
                const isReplyReviews = key === 'reply_reviews';
                const replyDisabled = isReplyReviews && !staffAppPermissions.view_reviews;
                const isChecked = !!staffAppPermissions[key as StaffAppPermissionKey];

                const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
                  const checked = event.target.checked;
                  setStaffAppPermissions((prev) => {
                    const next = { ...prev, [key]: checked };
                    if (key === 'view_reviews' && !checked) {
                      next.reply_reviews = false;
                    }
                    return next;
                  });
                };

                return (
                  <label
                    key={key}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                      replyDisabled 
                        ? 'border-neutral-150 bg-neutral-50 opacity-50 cursor-not-allowed' 
                        : isChecked 
                          ? 'border-purple-200 bg-purple-50/50' 
                          : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <span className="text-[11px] font-semibold text-neutral-800">
                      {key === 'view_earnings' && (isRtl ? 'عرض الأرباح والعمولات' : 'View earnings')}
                      {key === 'view_reviews' && (isRtl ? 'عرض التقييمات' : 'View reviews')}
                      {key === 'reply_reviews' && (
                        <span>
                          {isRtl ? 'الرد على التقييمات' : 'Reply to reviews'}
                          {replyDisabled && (
                            <span className="block text-[9px] text-neutral-400 font-medium mt-0.5">
                              {isRtl ? 'يتطلب تفعيل: عرض التقييمات' : 'Requires: View reviews'}
                            </span>
                          )}
                        </span>
                      )}
                      {key === 'view_clients' && (isRtl ? 'عرض قائمة العملاء' : 'View clients')}
                      {key === 'view_booking_notes' && (isRtl ? 'عرض ملاحظات المواعيد' : 'View booking notes')}
                      {key === 'can_start_service' && (isRtl ? 'زر بدء الخدمة' : 'Show Start button')}
                      {key === 'can_mark_no_show' && (isRtl ? 'زر عدم حضور العميل' : 'Show No-show button')}
                    </span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={replyDisabled}
                      onChange={handleChange}
                      className="h-4 w-4 rounded border-neutral-300 text-[#6537C0] focus:ring-[#6537C0] disabled:cursor-not-allowed"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Dashboard Admin permissions matrix with Role Presets */
        <div className="space-y-4">
          <div className="p-4 bg-neutral-50/60 rounded-2xl border border-neutral-200/80 text-xs font-bold text-neutral-800 space-y-1">
            <p className="flex items-center gap-1.5 text-[#1D035F] font-black">
              <Shield size={14} className="text-[#6537C0]" />
              <span>{isRtl ? 'بوابة لوحة تحكم المنشأة (Dashboard Admin)' : 'Tenant Management Dashboard Access'}</span>
            </p>
            <p className="text-[11px] text-neutral-500 leading-normal font-medium">
              {isRtl 
                ? 'هذا الموظف مصنف كـ "إداري لوحة التحكم". يمكنك اختيار قالب صلاحيات جاهز أو تخصيص التراخيص يدوياً.'
                : 'This staff member is designated as a Dashboard Admin. Select a predefined role preset or customize permissions.'}
            </p>
          </div>

          {/* Role Presets */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-600 font-extrabold block">
              {isRtl ? 'تطبيق قالب صلاحيات جاهز' : 'Role Preset Templates'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'manager', labelEn: 'General Manager', labelAr: 'مدير عام الفرع' },
                { key: 'accountant', labelEn: 'Accountant', labelAr: 'المحاسب المالي' },
                { key: 'receptionist', labelEn: 'Receptionist / Front Desk', labelAr: 'موظف الاستقبال' },
                { key: 'marketing', labelEn: 'Marketing Planner', labelAr: 'التسويق والعروض' },
                { key: 'hr', labelEn: 'HR / Personnel', labelAr: 'شؤون الموظفين' },
                { key: 'service_provider', labelEn: 'Specialist Standard', labelAr: 'أخصائي معتمد' }
              ].map(preset => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyRolePreset(preset.key)}
                  className="px-3 py-1.5 bg-neutral-100/80 hover:bg-purple-50 text-neutral-700 hover:text-[#1D035F] hover:border-purple-200 rounded-lg text-[10px] font-black cursor-pointer transition-all border border-neutral-200"
                >
                  {isRtl ? preset.labelAr : preset.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Detailed Permission Grid (All 20 keys) */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-600 font-extrabold block">
              {isRtl ? 'مصفوفة التراخيص والصلاحيات التفصيلية (٢٠ صلاحية)' : 'Granular Dashboard Permission Matrix (20 Keys)'}
            </label>
            
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
                        ...(perm.key === 'view_appointments' ? { manage_appointments: !isChecked } : {}),
                        ...(perm.key === 'view_financial' ? { manage_financials: !isChecked } : {}),
                        ...(perm.key === 'view_settings' ? { manage_settings: !isChecked } : {})
                      }
                    }))}
                    className={`p-3 rounded-xl text-xs font-bold text-start transition-all cursor-pointer border flex items-center justify-between gap-3 ${
                      isChecked
                        ? 'bg-purple-50/80 border-purple-200 text-[#1D035F] shadow-xs'
                        : 'bg-white hover:bg-neutral-50 text-neutral-600 border-neutral-200'
                    }`}
                  >
                    <span className="truncate">{isRtl ? perm.labelAr : perm.labelEn}</span>
                    {isChecked ? (
                      <CheckSquare size={15} className="text-[#6537C0] shrink-0" />
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

      {/* Consolidated Shared Access Management Actions for Existing Employees */}
      {formMode === 'edit' && formData.id && (
        <div className="pt-4 border-t border-neutral-200/80 space-y-2">
          <h5 className="text-xs font-black text-neutral-900">
            {isRtl ? 'إدارة الوصول وحساب الدخول' : 'Access & Credential Management'}
          </h5>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={isSendingInvite}
              onClick={handleSendAppInvite}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#1D035F] hover:bg-[#2A0878] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <Mail size={13} />
              <span>{isSendingInvite ? (isRtl ? 'جاري الإرسال...' : 'Sending...') : (isRtl ? 'إرسال دعوة تسجيل الدخول' : 'Send app invite')}</span>
            </button>
            <button
              type="button"
              disabled={isResettingPassword}
              onClick={() => setConfirmResetOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <KeyRound size={13} />
              <span>{isResettingPassword ? (isRtl ? 'جاري إعادة التعيين...' : 'Resetting...') : (isRtl ? 'إعادة تعيين كلمة المرور' : 'Reset password')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
