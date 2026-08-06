import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { House, LoaderCircle, LogIn } from 'lucide-react';
import type { Language } from '../../types';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';
import PublicWizardEngine, { type PublicWizardStepDefinition } from './PublicWizardEngine';
import PublicFileUploadField from './PublicFileUploadField';

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

const SAUDI_REGIONS_AND_CITIES = [
  { id: 'riyadh', en: 'Riyadh Region', ar: 'منطقة الرياض', cities: [{ en: 'Riyadh', ar: 'الرياض' }, { en: 'Al Kharj', ar: 'الخرج' }, { en: 'Diriyah', ar: 'الدرعية' }, { en: "Al Majma'ah", ar: 'المجمعة' }] },
  { id: 'makkah', en: 'Makkah Region', ar: 'منطقة مكة المكرمة', cities: [{ en: 'Mecca', ar: 'مكة المكرمة' }, { en: 'Jeddah', ar: 'جدة' }, { en: 'Taif', ar: 'الطائف' }, { en: 'Yanbu', ar: 'ينبع' }] },
  { id: 'madinah', en: 'Madinah Region', ar: 'منطقة المدينة المنورة', cities: [{ en: 'Medina', ar: 'المدينة المنورة' }, { en: 'Yanbu', ar: 'ينبع' }] },
  { id: 'eastern', en: 'Eastern Province', ar: 'المنطقة الشرقية', cities: [{ en: 'Dammam', ar: 'الدمام' }, { en: 'Al Khobar', ar: 'الخبر' }, { en: 'Dhahran', ar: 'الظهران' }, { en: 'Al Jubail', ar: 'الجبيل' }, { en: 'Al Hofuf', ar: 'الهفوف' }, { en: 'Al Mubarraz', ar: 'المبرز' }, { en: 'Al Qatif', ar: 'القطيف' }, { en: 'Hafr Al Batin', ar: 'حفر الباطن' }] },
  { id: 'asir', en: 'Asir Region', ar: 'منطقة عسير', cities: [{ en: 'Abha', ar: 'أبها' }, { en: 'Khamis Mushait', ar: 'خميس مشيط' }] },
  { id: 'jazan', en: 'Jazan Region', ar: 'منطقة جازان', cities: [{ en: 'Jizan', ar: 'جازان' }] },
  { id: 'najran', en: 'Najran Region', ar: 'منطقة نجران', cities: [{ en: 'Najran', ar: 'نجران' }] },
  { id: 'tabuk', en: 'Tabuk Region', ar: 'منطقة تبوك', cities: [{ en: 'Tabuk', ar: 'تبوك' }] },
  { id: 'hail', en: 'Hail Region', ar: 'منطقة حائل', cities: [{ en: 'Hail', ar: 'حائل' }] },
  { id: 'qassim', en: 'Al-Qassim Region', ar: 'منطقة القصيم', cities: [{ en: 'Buraydah', ar: 'بريدة' }] },
  { id: 'jawf', en: 'Al Jawf Region', ar: 'منطقة الجوف', cities: [{ en: 'Qurayyat', ar: 'القريات' }] }
];

type PackageRecord = Record<string, any>;

type RegistrationFormData = {
  name_en: string;
  name_ar: string;
  businessType: string[];
  phone: string;
  mobile: string;
  email: string;
  website: string;
  password: string;
  confirmPassword: string;
  buildingNumber: string;
  district: string;
  street: string;
  region: string;
  city: string;
  country: string;
  googleMapLink: string;
  crNumber: string;
  taxNumber: string;
  contactPersonNameAr: string;
  contactPersonNameEn: string;
  contactPersonEmail: string;
  contactPersonMobile: string;
  contactPersonPosition: string;
  ownerNameAr: string;
  ownerNameEn: string;
  ownerPhone: string;
  ownerEmail: string;
  ownerNationalId: string;
  providesHomeServices: boolean;
  staffCount: string;
  mainService: string;
  sellsProducts: boolean;
  hasOwnPaymentGateway: boolean;
  serviceRanking: number;
  advertiseOnSocialMedia: boolean;
  wantsRifahPromotion: boolean;
  selectedPackageId: string;
  selectedBillingPeriod: 'monthly' | 'sixMonth' | 'annual';
  acceptedServiceAgreement: boolean;
};

const initialFormData: RegistrationFormData = {
  name_en: '',
  name_ar: '',
  businessType: [],
  phone: '',
  mobile: '',
  email: '',
  website: '',
  password: '',
  confirmPassword: '',
  buildingNumber: '',
  district: '',
  street: '',
  region: '',
  city: '',
  country: 'Saudi Arabia',
  googleMapLink: '',
  crNumber: '',
  taxNumber: '',
  contactPersonNameAr: '',
  contactPersonNameEn: '',
  contactPersonEmail: '',
  contactPersonMobile: '',
  contactPersonPosition: '',
  ownerNameAr: '',
  ownerNameEn: '',
  ownerPhone: '',
  ownerEmail: '',
  ownerNationalId: '',
  providesHomeServices: false,
  staffCount: '',
  mainService: '',
  sellsProducts: false,
  hasOwnPaymentGateway: false,
  serviceRanking: 0,
  advertiseOnSocialMedia: false,
  wantsRifahPromotion: false,
  selectedPackageId: '',
  selectedBillingPeriod: 'monthly',
  acceptedServiceAgreement: false
};

interface PublicRegistrationWizardProps {
  lang: Language;
  onNavigate: (path: string) => void;
}

function sanitizePhone(value: string): string {
  return value.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value: string): boolean {
  return /^\+?[0-9]{8,15}$/.test(value.trim());
}

function isValidUrl(value: string): boolean {
  const raw = value.trim();
  if (!raw) return true;
  try {
    const candidate = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
    const parsed = new URL(candidate);
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function Field({
  label,
  required,
  error,
  children,
  hint
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-zinc-200">
          {label} {required ? <span className="text-rose-400">*</span> : null}
        </span>
        {hint ? <span className="text-[11px] text-zinc-500">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </label>
  );
}

const wizardStepDefinitions = (isRtl: boolean): PublicWizardStepDefinition[] => [
  { id: 'business', title: isRtl ? 'هوية المنشأة' : 'Business identity' },
  { id: 'documents', title: isRtl ? 'المستندات الرسمية' : 'Official documents' },
  { id: 'contact', title: isRtl ? 'بيانات التواصل' : 'Contact details' },
  { id: 'owner', title: isRtl ? 'بيانات المالك' : 'Owner profile' },
  { id: 'plan', title: isRtl ? 'اختيار الباقة' : 'Choose package' },
  { id: 'agreement', title: isRtl ? 'المراجعة والإرسال' : 'Review & submit' }
];

const premiumFieldClass =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-zinc-500 transition focus:border-amber-300/50 focus:bg-white/10 focus:ring-2 focus:ring-amber-300/20';

const premiumSelectClass =
  'w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20';

export default function PublicRegistrationWizard({ lang, onNavigate }: PublicRegistrationWizardProps) {
  const isRtl = lang === 'ar';
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'monthly' | 'sixMonth' | 'annual'>('monthly');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<RegistrationFormData>(initialFormData);
  const [files, setFiles] = useState<Record<string, File | null>>({
    logo: null,
    crDocument: null,
    taxDocument: null,
    nationalAddressDocument: null
  });

  const stepDefinitions = useMemo(() => wizardStepDefinitions(isRtl), [isRtl]);
  const totalSteps = stepDefinitions.length;

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const data = await tenantApiAdapter.getSubscriptionPackages();
        const payload = data?.data || data || {};
        const packageList = Array.isArray(payload?.packages) ? payload.packages : [];
        if (mounted) {
          setPackages(packageList.filter((pkg: PackageRecord) => pkg?.isActive !== false));
        }
      } catch (fetchError) {
        console.error('Failed to fetch subscription packages:', fetchError);
      } finally {
        if (mounted) {
          setPackagesLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleFieldChange = (name: keyof RegistrationFormData, value: string | boolean | string[]) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }) as RegistrationFormData);

    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = event.target;
    const checked = (event.target as HTMLInputElement).checked;
    const phoneFields = new Set(['phone', 'mobile', 'contactPersonMobile', 'ownerPhone']);
    const normalizedValue = phoneFields.has(name) ? sanitizePhone(value) : value;
    handleFieldChange(name as keyof RegistrationFormData, type === 'checkbox' ? checked : normalizedValue);
  };

  const handleFileSelected = (name: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [name]: file }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const getPackagePrice = (pkg: PackageRecord) => {
    if (selectedTab === 'monthly') return Number(pkg?.monthlyPrice ?? 0);
    if (selectedTab === 'sixMonth') return Number(pkg?.sixMonthPrice ?? 0);
    return Number(pkg?.annualPrice ?? 0);
  };

  const getPackageSavings = (pkg: PackageRecord) => {
    if (selectedTab === 'monthly') return 0;
    const monthly = Number(pkg?.monthlyPrice ?? 0);
    const sixMonth = Number(pkg?.sixMonthPrice ?? 0);
    const annual = Number(pkg?.annualPrice ?? 0);
    return selectedTab === 'sixMonth' ? monthly * 6 - sixMonth : monthly * 12 - annual;
  };

  const validateStep = (step: WizardStep) => {
    const nextErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.name_en.trim()) nextErrors.name_en = isRtl ? 'اسم المنشأة بالإنجليزية مطلوب' : 'English business name is required';
      if (!formData.name_ar.trim()) nextErrors.name_ar = isRtl ? 'اسم المنشأة بالعربية مطلوب' : 'Arabic business name is required';
      if (!formData.businessType.length) nextErrors.businessType = isRtl ? 'اختر نوع النشاط' : 'Please select at least one business type';
      if (formData.phone && !isValidPhone(formData.phone)) nextErrors.phone = isRtl ? 'رقم الهاتف غير صحيح' : 'Invalid phone number';
      if (!formData.mobile.trim()) nextErrors.mobile = isRtl ? 'رقم الجوال مطلوب' : 'Mobile is required';
      if (formData.mobile && !isValidPhone(formData.mobile)) nextErrors.mobile = isRtl ? 'رقم الجوال غير صحيح' : 'Invalid mobile number';
      if (!formData.email.trim()) nextErrors.email = isRtl ? 'البريد الإلكتروني مطلوب' : 'Email is required';
      if (formData.email && !isValidEmail(formData.email)) nextErrors.email = isRtl ? 'صيغة البريد الإلكتروني غير صحيحة' : 'Invalid email format';
      if (formData.website && !isValidUrl(formData.website)) nextErrors.website = isRtl ? 'رابط الموقع غير صحيح' : 'Invalid website URL';
      if (formData.googleMapLink && !isValidUrl(formData.googleMapLink)) nextErrors.googleMapLink = isRtl ? 'رابط خرائط Google غير صحيح' : 'Invalid Google Maps URL';
      if (!formData.password.trim()) nextErrors.password = isRtl ? 'كلمة المرور مطلوبة' : 'Password is required';
      if (formData.password.length < 8) nextErrors.password = isRtl ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters';
      if (formData.password !== formData.confirmPassword) nextErrors.confirmPassword = isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match';
    }

    if (step === 2) {
      if (!formData.crNumber.trim()) nextErrors.crNumber = isRtl ? 'رقم السجل التجاري مطلوب' : 'Commercial registration number is required';
      if (!formData.taxNumber.trim()) nextErrors.taxNumber = isRtl ? 'الرقم الضريبي مطلوب' : 'Tax number is required';
      if (!files.crDocument) nextErrors.crDocument = isRtl ? 'أرفق مستند السجل التجاري' : 'Commercial registration file is required';
      if (!files.taxDocument) nextErrors.taxDocument = isRtl ? 'أرفق المستند الضريبي' : 'Tax certificate file is required';
      if (!files.nationalAddressDocument) nextErrors.nationalAddressDocument = isRtl ? 'أرفق ملف العنوان الوطني' : 'National Address file is required';
    }

    if (step === 3) {
      if (!formData.contactPersonNameAr.trim()) nextErrors.contactPersonNameAr = isRtl ? 'اسم جهة الاتصال بالعربية مطلوب' : 'Contact name in Arabic is required';
      if (!formData.contactPersonNameEn.trim()) nextErrors.contactPersonNameEn = isRtl ? 'اسم جهة الاتصال بالإنجليزية مطلوب' : 'Contact name in English is required';
      if (!formData.contactPersonEmail.trim()) nextErrors.contactPersonEmail = isRtl ? 'بريد جهة الاتصال مطلوب' : 'Contact email is required';
      if (formData.contactPersonEmail && !isValidEmail(formData.contactPersonEmail)) nextErrors.contactPersonEmail = isRtl ? 'بريد جهة الاتصال غير صحيح' : 'Invalid contact email format';
      if (!formData.contactPersonMobile.trim()) nextErrors.contactPersonMobile = isRtl ? 'جوال جهة الاتصال مطلوب' : 'Contact mobile is required';
      if (formData.contactPersonMobile && !isValidPhone(formData.contactPersonMobile)) nextErrors.contactPersonMobile = isRtl ? 'جوال جهة الاتصال غير صحيح' : 'Invalid contact mobile number';
      if (!formData.contactPersonPosition.trim()) nextErrors.contactPersonPosition = isRtl ? 'المسمى الوظيفي مطلوب' : 'Contact position is required';
    }

    if (step === 4) {
      if (!formData.ownerNameAr.trim()) nextErrors.ownerNameAr = isRtl ? 'اسم المالك بالعربية مطلوب' : 'Owner name in Arabic is required';
      if (!formData.ownerNameEn.trim()) nextErrors.ownerNameEn = isRtl ? 'اسم المالك بالإنجليزية مطلوب' : 'Owner name in English is required';
      if (!formData.ownerPhone.trim()) nextErrors.ownerPhone = isRtl ? 'رقم جوال المالك مطلوب' : 'Owner phone is required';
      if (formData.ownerPhone && !isValidPhone(formData.ownerPhone)) nextErrors.ownerPhone = isRtl ? 'رقم جوال المالك غير صحيح' : 'Invalid owner phone number';
      if (!formData.ownerEmail.trim()) nextErrors.ownerEmail = isRtl ? 'بريد المالك مطلوب' : 'Owner email is required';
      if (formData.ownerEmail && !isValidEmail(formData.ownerEmail)) nextErrors.ownerEmail = isRtl ? 'صيغة بريد المالك غير صحيحة' : 'Invalid owner email format';
      if (!formData.ownerNationalId.trim()) nextErrors.ownerNationalId = isRtl ? 'رقم الهوية الوطنية مطلوب' : 'Owner national ID is required';
    }

    if (step === 5) {
      if (!formData.selectedPackageId) nextErrors.selectedPackageId = isRtl ? 'اختر باقة الاشتراك' : 'Please select a subscription package';
    }

    if (step === 6 && !formData.acceptedServiceAgreement) {
      nextErrors.acceptedServiceAgreement = isRtl ? 'يجب قبول اتفاقية الخدمة' : 'You must accept the service agreement';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setError(Object.values(nextErrors)[0]);
      return false;
    }

    setError('');
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps) as WizardStep);
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1) as WizardStep);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!validateStep(currentStep)) {
      return;
    }

    if (currentStep < totalSteps) {
      nextStep();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const submitData = new FormData();

      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'confirmPassword') return;
        if (Array.isArray(value)) {
          submitData.append(key, JSON.stringify(value));
          return;
        }
        submitData.append(key, typeof value === 'boolean' ? String(value) : String(value ?? ''));
      });

      Object.entries(files).forEach(([key, file]) => {
        if (file instanceof File) {
          submitData.append(key, file);
        }
      });

      submitData.append('preferredLanguage', lang);

      const response = await tenantApiAdapter.registerTenant(submitData);
      if (!response?.success) {
        throw new Error(response?.message || (isRtl ? 'فشل التسجيل' : 'Registration failed'));
      }

      onNavigate('/register/success');
    } catch (submitError: any) {
      console.error('Registration error:', submitError);
      setError(submitError?.message || (isRtl ? 'حدث خطأ أثناء التسجيل' : 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  };

  const currentStepContent = (() => {
    if (currentStep === 1) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={isRtl ? 'اسم المنشأة بالعربية' : 'Business name (Arabic)'} required error={errors.name_ar}>
            <input value={formData.name_ar} onChange={handleChange} name="name_ar" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'اسم المنشأة بالإنجليزية' : 'Business name (English)'} required error={errors.name_en}>
            <input value={formData.name_en} onChange={handleChange} name="name_en" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'نوع النشاط' : 'Business types'} required error={errors.businessType} hint={isRtl ? 'اختيارات متعددة' : 'Multi-select'}>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { value: 'salon', label: isRtl ? 'صالون' : 'Salon', emoji: '💇', note: isRtl ? 'خدمات شعر وجمال' : 'Hair and beauty services' },
                { value: 'spa', label: isRtl ? 'سبا' : 'Spa', emoji: '🧖', note: isRtl ? 'عافية واسترخاء' : 'Wellness and relaxation' },
                { value: 'beauty_center', label: isRtl ? 'مركز تجميل' : 'Beauty center', emoji: '💅', note: isRtl ? 'تجميل شامل' : 'Full-service beauty' },
                { value: 'barbershop', label: isRtl ? 'حلاقة' : 'Barbershop', emoji: '💈', note: isRtl ? 'حلاقة وعناية' : 'Barbering and grooming' },
                { value: 'clinic', label: isRtl ? 'عيادة' : 'Clinic', emoji: '🏥', note: isRtl ? 'خدمات متخصصة' : 'Specialized services' }
              ].map((type) => {
                const checked = formData.businessType.includes(type.value);
                return (
                  <label
                    key={type.value}
                    className={`group flex min-h-[88px] cursor-pointer items-center gap-3 rounded-[1.5rem] border px-4 py-4 transition ${
                      checked
                        ? 'border-amber-300/70 bg-amber-400/10 text-white shadow-[0_14px_40px_rgba(251,191,36,0.12)]'
                        : 'border-white/10 bg-white/5 text-zinc-300 hover:-translate-y-0.5 hover:bg-white/10'
                    }`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${checked ? 'border-amber-300/40 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-black/20 text-zinc-300'}`}>
                      <span>{type.emoji}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-white">{type.label}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? formData.businessType.filter((item) => item !== type.value)
                              : [...formData.businessType, type.value];
                            handleFieldChange('businessType', next);
                          }}
                          className="h-4 w-4 rounded border-white/20 bg-zinc-950 text-amber-400 accent-amber-400"
                        />
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-zinc-400">{type.note}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </Field>
          <Field label={isRtl ? 'الشعار' : 'Logo'} hint={isRtl ? 'اختياري' : 'Optional'}>
            <PublicFileUploadField
              inputId="logo-upload"
              label={isRtl ? 'رفع شعار المنشأة' : 'Business logo upload'}
              file={files.logo}
              accept="image/*"
              hint={isRtl ? 'PNG / JPG / SVG' : 'PNG / JPG / SVG'}
              onChange={(file) => handleFileSelected('logo', file)}
            />
          </Field>
          <Field label={isRtl ? 'البريد الإلكتروني' : 'Email'} required error={errors.email}>
            <input type="email" value={formData.email} onChange={handleChange} name="email" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'الهاتف' : 'Phone'} required error={errors.phone}>
            <input type="tel" value={formData.phone} onChange={handleChange} name="phone" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'الجوال' : 'Mobile'} required error={errors.mobile}>
            <input type="tel" value={formData.mobile} onChange={handleChange} name="mobile" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'الموقع الإلكتروني' : 'Website'} error={errors.website}>
            <input type="url" value={formData.website} onChange={handleChange} name="website" className={premiumFieldClass} placeholder="https://" />
          </Field>
          <Field label={isRtl ? 'رابط خرائط Google' : 'Google Maps link'} error={errors.googleMapLink}>
            <input type="url" value={formData.googleMapLink} onChange={handleChange} name="googleMapLink" className={premiumFieldClass} placeholder="https://maps.google.com/..." />
          </Field>
          <Field label={isRtl ? 'كلمة المرور' : 'Password'} required error={errors.password}>
            <input type="password" value={formData.password} onChange={handleChange} name="password" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'تأكيد كلمة المرور' : 'Confirm password'} required error={errors.confirmPassword}>
            <input type="password" value={formData.confirmPassword} onChange={handleChange} name="confirmPassword" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'الحي' : 'District'} error={errors.district}>
            <input value={formData.district} onChange={handleChange} name="district" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'الشارع' : 'Street'} error={errors.street}>
            <input value={formData.street} onChange={handleChange} name="street" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'رقم المبنى' : 'Building number'} error={errors.buildingNumber}>
            <input value={formData.buildingNumber} onChange={handleChange} name="buildingNumber" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'المنطقة' : 'Region'} error={errors.region}>
            <select value={formData.region} onChange={(e) => { handleChange(e); handleFieldChange('city', ''); }} name="region" className={premiumSelectClass}>
              <option value="">{isRtl ? 'اختر المنطقة' : 'Select region'}</option>
              {SAUDI_REGIONS_AND_CITIES.map((region) => (
                <option key={region.id} value={region.id}>
                  {isRtl ? region.ar : region.en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={isRtl ? 'المدينة' : 'City'} error={errors.city}>
            <select value={formData.city} onChange={handleChange} name="city" className={premiumSelectClass} disabled={!formData.region}>
              <option value="">{isRtl ? 'اختر المدينة' : 'Select city'}</option>
              {formData.region && SAUDI_REGIONS_AND_CITIES.find(r => r.id === formData.region)?.cities.sort((a,b) => a.en.localeCompare(b.en)).map((city) => (
                <option key={city.en} value={city.en}>
                  {isRtl ? city.ar : city.en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={isRtl ? 'الدولة' : 'Country'}>
            <input value={formData.country} disabled className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/80 opacity-90" />
          </Field>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={isRtl ? 'رقم السجل التجاري' : 'Commercial registration number'} required error={errors.crNumber}>
            <input value={formData.crNumber} onChange={handleChange} name="crNumber" className={premiumFieldClass} />
          </Field>
          <PublicFileUploadField
            inputId="cr-document-upload"
            label={isRtl ? 'السجل التجاري' : 'Commercial registration file'}
            required
            error={errors.crDocument}
            file={files.crDocument}
            onChange={(file) => handleFileSelected('crDocument', file)}
            hint={isRtl ? 'مستند رسمي مطلوب' : 'Required official file'}
          />
          <Field label={isRtl ? 'الرقم الضريبي' : 'Tax number'} required error={errors.taxNumber}>
            <input value={formData.taxNumber} onChange={handleChange} name="taxNumber" className={premiumFieldClass} />
          </Field>
          <PublicFileUploadField
            inputId="tax-document-upload"
            label={isRtl ? 'المستند الضريبي' : 'Tax certificate file'}
            required
            error={errors.taxDocument}
            file={files.taxDocument}
            onChange={(file) => handleFileSelected('taxDocument', file)}
            hint={isRtl ? 'PDF أو صورة' : 'PDF or image'}
          />
          <PublicFileUploadField
            inputId="na-document-upload"
            label={isRtl ? 'العنوان الوطني' : 'National Address'}
            required
            error={errors.nationalAddressDocument}
            file={files.nationalAddressDocument}
            onChange={(file) => handleFileSelected('nationalAddressDocument', file)}
            hint={isRtl ? 'PDF أو صورة' : 'PDF or image'}
          />
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={isRtl ? 'اسم جهة الاتصال بالعربية' : 'Contact name (Arabic)'} required error={errors.contactPersonNameAr}>
            <input value={formData.contactPersonNameAr} onChange={handleChange} name="contactPersonNameAr" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'اسم جهة الاتصال بالإنجليزية' : 'Contact name (English)'} required error={errors.contactPersonNameEn}>
            <input value={formData.contactPersonNameEn} onChange={handleChange} name="contactPersonNameEn" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'البريد الإلكتروني' : 'Email'} required error={errors.contactPersonEmail}>
            <input type="email" value={formData.contactPersonEmail} onChange={handleChange} name="contactPersonEmail" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'الجوال' : 'Mobile'} required error={errors.contactPersonMobile}>
            <input type="tel" value={formData.contactPersonMobile} onChange={handleChange} name="contactPersonMobile" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'المسمى الوظيفي' : 'Position'} required error={errors.contactPersonPosition}>
            <input value={formData.contactPersonPosition} onChange={handleChange} name="contactPersonPosition" className={premiumFieldClass} />
          </Field>
        </div>
      );
    }

    if (currentStep === 4) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={isRtl ? 'اسم المالك بالعربية' : 'Owner name (Arabic)'} required error={errors.ownerNameAr}>
            <input value={formData.ownerNameAr} onChange={handleChange} name="ownerNameAr" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'اسم المالك بالإنجليزية' : 'Owner name (English)'} required error={errors.ownerNameEn}>
            <input value={formData.ownerNameEn} onChange={handleChange} name="ownerNameEn" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'جوال المالك' : 'Owner phone'} required error={errors.ownerPhone}>
            <input type="tel" value={formData.ownerPhone} onChange={handleChange} name="ownerPhone" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'بريد المالك' : 'Owner email'} required error={errors.ownerEmail}>
            <input type="email" value={formData.ownerEmail} onChange={handleChange} name="ownerEmail" className={premiumFieldClass} />
          </Field>
          <Field label={isRtl ? 'رقم الهوية الوطنية' : 'National ID'} required error={errors.ownerNationalId}>
            <input value={formData.ownerNationalId} onChange={handleChange} name="ownerNationalId" className={premiumFieldClass} />
          </Field>
        </div>
      );
    }

    if (currentStep === 5) {
      return (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
            {(['monthly', 'sixMonth', 'annual'] as const).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setSelectedTab(period)}
                className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  selectedTab === period ? 'border border-amber-300/40 bg-amber-400/10 text-amber-100' : 'border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {period === 'monthly'
                  ? (isRtl ? 'شهري' : 'Monthly')
                  : period === 'sixMonth'
                    ? (isRtl ? '6 أشهر' : '6 Months')
                    : (isRtl ? 'سنوي' : 'Annual')}
              </button>
            ))}
          </div>

          {packagesLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-center text-zinc-300">
              <LoaderCircle size={18} className="mx-auto mb-3 animate-spin text-amber-300" />
              {isRtl ? 'جارٍ تحميل الباقات...' : 'Loading subscription packages...'}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {packages.map((pkg) => {
                const price = getPackagePrice(pkg);
                const savings = getPackageSavings(pkg);
                const selected = formData.selectedPackageId === pkg.id && formData.selectedBillingPeriod === selectedTab;

                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        selectedPackageId: pkg.id,
                        selectedBillingPeriod: selectedTab
                      }))
                    }
                    className={`rounded-[1.75rem] border p-5 text-start transition ${
                      selected
                        ? 'border-amber-300/70 bg-amber-400/10 shadow-[0_18px_45px_rgba(251,191,36,0.12)]'
                        : 'border-white/10 bg-white/5 hover:-translate-y-0.5 hover:bg-white/10'
                    }`}
                  >
                    {pkg?.isFeatured ? (
                      <div className="mb-3 inline-flex rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold text-amber-200">
                        {isRtl ? 'الأكثر شعبية' : 'Most popular'}
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-white">{pkg?.name || (isRtl ? 'باقة' : 'Plan')}</h3>
                      <p className="text-sm leading-6 text-zinc-300">{pkg?.description || ''}</p>
                      <p className="text-3xl font-black text-white">
                        <span className="text-sm font-medium text-zinc-400">SAR</span> {Number(price || 0).toFixed(2)}
                      </p>
                      {savings > 0 ? (
                        <p className="text-xs font-semibold text-emerald-300">
                          {isRtl ? 'توفير' : 'Save'} SAR {Number(savings).toFixed(2)}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-4 grid gap-2 text-xs text-zinc-400">
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">{isRtl ? 'الحد الأقصى للحجوزات' : 'Bookings limit'}: {pkg?.limits?.maxBookingsPerMonth === -1 ? (isRtl ? 'غير محدود' : 'Unlimited') : `${pkg?.limits?.maxBookingsPerMonth ?? 0}/mo`}</div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">{isRtl ? 'الفرق' : 'Staff'}: {pkg?.limits?.maxStaff === -1 ? (isRtl ? 'غير محدود' : 'Unlimited') : pkg?.limits?.maxStaff ?? 0}</div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">{isRtl ? 'الخدمات' : 'Services'}: {pkg?.limits?.maxServices === -1 ? (isRtl ? 'غير محدود' : 'Unlimited') : pkg?.limits?.maxServices ?? 0}</div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">{isRtl ? 'العمولة' : 'Commission'}: {pkg?.platformCommission ?? 0}%</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {errors.selectedPackageId ? <p className="text-sm text-rose-300">{errors.selectedPackageId}</p> : null}
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
          <h3 className="text-xl font-bold text-white">{isRtl ? 'اتفاقية الخدمة' : 'Service agreement'}</h3>
          <p className="mt-2 text-sm leading-7 text-zinc-300">
            {isRtl
              ? 'هذا ملخص مرئي للاتفاقية. سيبقى المحتوى القانوني كما هو في backend الإنتاج.'
              : 'A visual agreement summary. The legal content remains owned by the production backend.'}
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
          <input
            type="checkbox"
            checked={formData.acceptedServiceAgreement}
            onChange={handleChange}
            name="acceptedServiceAgreement"
            className="mt-1 h-4 w-4 rounded border-white/20 bg-zinc-950 text-amber-400 focus:ring-amber-400/50"
          />
          <span className="text-sm leading-7 text-zinc-200">
            {isRtl
              ? 'أوافق على اتفاقية الخدمة وشروط الاشتراك.'
              : 'I agree to the service agreement and subscription terms.'}
          </span>
        </label>

        {errors.acceptedServiceAgreement ? <p className="text-sm text-rose-300">{errors.acceptedServiceAgreement}</p> : null}
      </div>
    );
  })();

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.2),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(244,114,182,0.16),_transparent_24%),linear-gradient(135deg,_rgba(9,9,11,0.98),_rgba(24,24,27,0.92))]" />
      <div className="relative z-10 min-h-screen">
        <header className="px-4 pt-5 md:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-full border border-white/10 bg-white/5 px-4 py-3 shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-left transition hover:border-amber-300/40 hover:bg-white/10"
            >
              <img src="/RifahNewLogoWhite.png" alt="Rifah" className="h-9 w-auto sm:h-10" />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('/')}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <House size={16} />
                <span>{isRtl ? 'الرئيسية' : 'Home'}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/login')}
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/20"
              >
                <LogIn size={16} />
                <span>{isRtl ? 'تسجيل الدخول' : 'Login'}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 pb-10 pt-6 md:px-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <section className="rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 shadow-[0_16px_45px_rgba(0,0,0,0.18)] backdrop-blur-xl md:px-6 md:py-5">
              <h2 className="text-2xl font-black leading-tight text-white md:text-[2rem]">
                {isRtl ? 'ابدأ التسجيل بثقة' : 'Start registration with confidence'}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-7 text-zinc-300 md:text-[0.98rem]">
                {isRtl
                  ? 'أكمل بيانات منشأتك وابدأ الإعداد بخطوات واضحة وسريعة.'
                  : 'Tell us about your business and complete setup in a calm, guided flow.'}
              </p>
            </section>

            <form onSubmit={handleSubmit} className="space-y-5">
              <PublicWizardEngine
                langDirection={isRtl ? 'rtl' : 'ltr'}
                steps={stepDefinitions}
                activeStepIndex={currentStep - 1}
                loading={loading}
                error={error}
                isFirstStep={currentStep === 1}
                isLastStep={currentStep === totalSteps}
                onBack={prevStep}
                onNext={nextStep}
                backLabel={isRtl ? 'السابق' : 'Previous'}
                nextLabel={isRtl ? 'التالي' : 'Next'}
                submitLabel={isRtl ? 'إرسال الطلب' : 'Submit application'}
              >
                {currentStepContent}
              </PublicWizardEngine>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
