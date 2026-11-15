import { useState, type ComponentType } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Award,
  Users,
  Receipt,
  Gift,
  Clock,
  Layers,
  HeartHandshake,
  Building2,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  Check,
  BadgeCheck,
  Sparkle
} from 'lucide-react';
import barspaLogo from '../../assets/barspa_logo.png';
import barspaIcon from '../../assets/barspa_app_icon.png';
import type { PublicLandingSectionComponentMap, PublicLandingSectionProps } from './landing.types';

// Helper for smooth anchor scrolling
function scrollToAnchor(anchor: string) {
  if (typeof window === 'undefined') return;
  const element = document.querySelector(anchor);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ==========================================
// B2B BILINGUAL MARKETING DICTIONARY
// ==========================================

const b2bCopy = {
  ar: {
    hero: {
      badge: 'المنصة السحابية المتقدمة لصالونات ومراكز التجميل والسبا',
      title: 'ارتقِ بإدارة مركزك مع بارسبا',
      subtitle: 'منصة متكاملة تساعد صالونات التجميل والسبا ومراكز العناية على تنظيم عملياتها، جدولة مواعيدها، وإدارة أعمالها من مكان واحد بكل وضوح وسهولة.',
      primaryCta: 'انضم إلى بارسبا',
      secondaryCta: 'اكتشف المنصة',
      preview: {
        windowTitle: 'لوحة التحكم والعمليات اليومية — نظام بارسبا السحابي',
        liveStatus: 'النظام متصل ونشط',
        todayRoster: 'فريق العمل في الخدمة',
        rosterActive: '5 أخصائيات معتمدات',
        scheduleMetric: 'جدول المواعيد المجدولة',
        scheduleDesc: 'تنظيم لحظي يمنع تعارض المواعيد',
        posMetric: 'نقاط البيع والتحصيل',
        posDesc: 'فوترة إلكترونية مبسطة متوافقة',
        recentActionLabel: 'سير العمليات المباشر',
        sampleSlot1: 'جلسة عناية — غرفة الاسترخاء 1 (مشغولة)',
        sampleSlot2: 'موعد تصفيف — محطة العناية 2 (مؤكد)',
        sampleSlot3: 'فحص متاح — غرفة الاستراحة 2 (شاغرة)'
      }
    },
    capabilities: {
      badge: 'المنظومة التشغيلية',
      title: 'كل ما تحتاجه لإدارة منشأتك بكفاءة واحترافية',
      subtitle: 'أدوات متخصصة صُممت بدقة لتلبية أدق تفاصيل العمل اليومي في صالونات ومراكز التجميل والاستجمام الراقية.',
      items: [
        {
          id: 'cap-scheduling',
          icon: CalendarDays,
          title: 'جدولة ذكية للمواعيد والتقويم',
          desc: 'تنظيم المواعيد اليومية والأسبوعية بمرونة تامة، وتوزيع أوقات الخدمات على الأخصائيات لمنع أي تعارض تشغيلي.',
          tag: 'تنظيم آلي'
        },
        {
          id: 'cap-roster',
          icon: Users,
          title: 'إدارة الكادر والمناوبات والموارد',
          desc: 'ضبط جداول دوام الموظفات، فترات الاستراحة، وحجز الغرف الفيزيائية ومحطات الخدمة بكفاءة عالية.',
          tag: 'كفاءة الفريق'
        },
        {
          id: 'cap-pos',
          icon: Receipt,
          title: 'نقاط البيع والفوترة المبسطة',
          desc: 'إصدار سريع للفواتير الضريبية الداعمة لرمز الاستجابة السريعة (QR)، دعم وسائل الدفع المتعددة، وطباعة الإيصالات.',
          tag: 'تحصيل فوري'
        },
        {
          id: 'cap-marketing',
          icon: Gift,
          title: 'بطاقات الهدايا الرقمية والباقات',
          desc: 'تنشيط مبيعات صالونك من خلال باقات الخدمات المتكاملة وبطاقات الهدايا الإلكترونية التي تدعم ولاء العملاء.',
          tag: 'تنمية المبيعات'
        }
      ]
    },
    showcase: {
      badge: 'واجهة النظام التشغيلية',
      title: 'رؤية تشغيلية واضحة ومصممة لدقة التفاصيل',
      subtitle: 'صُممت واجهات بارسبا لتمنح مسؤولي الصالون والمشرفين تحكماً كاملاً وسلساً في جدول اليوم وسير الخدمات.',
      tabs: [
        { id: 'board', label: 'لوحة المواعيد والتقويم' },
        { id: 'pos', label: 'نقاط البيع والتحصيلات' },
        { id: 'staff', label: 'إدارة الفريق والموارد' }
      ],
      previews: {
        board: {
          title: 'جدول المواعيد والخدمات اللحظي',
          desc: 'متابعة بصرية فورية لكل مقعد وغرفة خدمة مع تصنيف واضح لحالات المواعيد (مؤكد، قيد التنفيذ، مكتمل).',
          col1Title: 'المواعيد المؤكدة',
          col1Desc: 'توزيع دقيق للجلسات بحسب الأخصائية والغرفة المخصصة.',
          col2Title: 'فترات التجهيز والتعقيم',
          col2Desc: 'احتساب تلقائي للمدد بين الخدمات لضمان أعلى معايير الجاهزية.',
          col3Title: 'التنسيق الشامل',
          col3Desc: 'عزل المواعيد الفردية والجماعية وتفادي أي حجز مزدوج.'
        },
        pos: {
          title: 'شاشة التحصيل ونقاط البيع السريعة',
          desc: 'تسجيل عمليات البيع، قبول المدفوعات المجزأة، وإصدار الفواتير الضريبية المبسطة المتوافقة في ثوانٍ معدودة.',
          col1Title: 'خيارات دفع متعددة',
          col1Desc: 'دعم مدى، البطاقات الائتمانية، أبل باي، والنقد.',
          col2Title: 'فواتير ضريبية معتمدة',
          col2Desc: 'إصدار الفواتير بترميز QR متوافق وطباعة حرارية فورية.',
          col3Title: 'تسوية وإغلاق اليومية',
          col3Desc: 'مطابقة دقيقة للمقبوضات والتحصيلات مع نهاية كل مناوبة.'
        },
        staff: {
          title: 'جدولة الفريق والمناوبات وحساب العمولات',
          desc: 'إدارة متكاملة لبيانات الأخصائيات، تحديد ساعات العمل وأيام العطل، ومتابعة نسب الإنجاز بشفافية.',
          col1Title: 'جداول المناوبات المرنة',
          col1Desc: 'تحديد أوقات الحضور والانصراف وفترات الراحة لكل مختصة.',
          col2Title: 'تخصيص الخدمات',
          col2Desc: 'ربط كل أخصائية بالخدمات المؤهلة لتقديمها بدقة.',
          col3Title: 'متابعة الأداء',
          col3Desc: 'تقارير واضحة لساعات العمل وعدد الخدمات المنجزة.'
        }
      }
    },
    cta: {
      title: 'جاهز لنقل إدارة صالونك إلى مستوى جديد من الاحترافية؟',
      subtitle: 'انضم إلى شبكة الصالونات ومراكز التجميل والاستجمام المتميزة التي تعتمد على بارسبا في تنظيم عملياتها اليومية.',
      primaryButton: 'انضم إلى بارسبا كشريك',
      secondaryButton: 'تسجيل دخول المنشأة'
    },
    footer: {
      tagline: 'المنصة السحابية المتقدمة لإدارة عمليات صالونات ومراكز التجميل والسبا في المملكة العربية السعودية.',
      platformTitle: 'المنصة',
      home: 'الرئيسية',
      capabilities: 'المنظومة والمزايا',
      features: 'واجهات النظام',
      join: 'انضم إلى بارسبا',
      businessTitle: 'بوابات الدخول',
      register: 'تسجيل منشأة جديدة',
      login: 'تسجيل دخول المشغلين',
      trustTitle: 'الأمان والمساعدة',
      privacy: 'سياسة الخصوصية',
      terms: 'الشروط والأحكام',
      contact: 'فريق المساندة والدعم',
      rights: 'جميع الحقوق محفوظة © 2026 بارسبا (BarSpa). منصة إدارة سحابية متقدمة.'
    }
  },
  en: {
    hero: {
      badge: 'Advanced Cloud Platform for Luxury Salons & Spas',
      title: 'Run Your Beauty Business with BARSPA',
      subtitle: 'One connected platform designed to help salons, spas, and wellness centers coordinate operations, schedule appointments, and manage daily business from a single place.',
      primaryCta: 'Become a BARSPA Partner',
      secondaryCta: 'Explore the Platform',
      preview: {
        windowTitle: 'Daily Operations & Scheduling Workspace — BarSpa Cloud',
        liveStatus: 'System Connected & Active',
        todayRoster: 'Active Staff on Duty',
        rosterActive: '5 Certified Specialists',
        scheduleMetric: 'Real-Time Schedule Flow',
        scheduleDesc: 'Dynamic coordination preventing conflicts',
        posMetric: 'POS & Payment Collections',
        posDesc: 'Compliant simplified e-invoicing',
        recentActionLabel: 'Live Operational Feed',
        sampleSlot1: 'Wellness Session — Suite 1 (Occupied)',
        sampleSlot2: 'Hair Styling — Station 2 (Confirmed)',
        sampleSlot3: 'Available Window — Suite 2 (Free)'
      }
    },
    capabilities: {
      badge: 'Operational Architecture',
      title: 'Everything You Need to Manage Your Center with Confidence',
      subtitle: 'Engineered specifically to address the daily operational nuances of premier salons, spas, and aesthetic centers.',
      items: [
        {
          id: 'cap-scheduling',
          icon: CalendarDays,
          title: 'Intelligent Scheduling & Calendar Workspace',
          desc: 'Flexible daily and weekly booking coordination, distributing client visits across staff and service rooms seamlessly.',
          tag: 'Smart Scheduling'
        },
        {
          id: 'cap-roster',
          icon: Users,
          title: 'Staff Roster & Resource Allocation',
          desc: 'Manage specialist duty shifts, planned breaks, and assign physical treatment rooms and styling chairs efficiently.',
          tag: 'Team Operations'
        },
        {
          id: 'cap-pos',
          icon: Receipt,
          title: 'POS & Simplified Invoicing',
          desc: 'Fast checkout supporting QR-coded tax invoices, split tenders, and immediate thermal receipt generation.',
          tag: 'Fast Checkout'
        },
        {
          id: 'cap-marketing',
          icon: Gift,
          title: 'Digital Gift Cards & Service Packages',
          desc: 'Boost salon revenue and customer retention with bundled packages, promotions, and electronic gift cards.',
          tag: 'Revenue Growth'
        }
      ]
    },
    showcase: {
      badge: 'Platform Experience',
      title: 'A Clear, Intuitive Interface Built for Detail',
      subtitle: 'BarSpa is designed to give salon managers and front-desk coordinators immediate visibility over daily schedules and checkout flows.',
      tabs: [
        { id: 'board', label: 'Appointment Workspace' },
        { id: 'pos', label: 'POS & Collections' },
        { id: 'staff', label: 'Staff & Shift Management' }
      ],
      previews: {
        board: {
          title: 'Live Appointment Board & Treatment Scheduling',
          desc: 'Instant visual overview of every chair and room with clear appointment states (Confirmed, In-Service, Completed).',
          col1Title: 'Confirmed Appointments',
          col1Desc: 'Accurate scheduling tied directly to staff and room allocations.',
          col2Title: 'Turnaround & Preparation',
          col2Desc: 'Automated buffers between services to ensure continuous readiness.',
          col3Title: 'Conflict Prevention',
          col3Desc: 'Structured scheduling preventing overlapping bookings.'
        },
        pos: {
          title: 'Speed-Optimized Point of Sale & Checkout',
          desc: 'Log sales, accept multi-tender payments, and issue compliant simplified tax invoices in seconds.',
          col1Title: 'Multiple Payment Methods',
          col1Desc: 'Support for Mada, major debit/credit cards, Apple Pay, and cash.',
          col2Title: 'Compliant Tax Receipts',
          col2Desc: 'Instant invoices with compliant QR codes and thermal receipt layouts.',
          col3Title: 'Shift Closing & Summary',
          col3Desc: 'Accurate balance reconciliation and collection audits at shift end.'
        },
        staff: {
          title: 'Staff Rosters, Service Assignments & Commissions',
          desc: 'Comprehensive employee profiles, working hours, break periods, and transparent performance tracking.',
          col1Title: 'Flexible Work Shifts',
          col1Desc: 'Set standard shift hours, days off, and custom break times.',
          col2Title: 'Qualified Services',
          col2Desc: 'Map specialists only to treatments they are certified to deliver.',
          col3Title: 'Performance Reports',
          col3Desc: 'Clear summaries of completed treatments and active working hours.'
        }
      }
    },
    cta: {
      title: 'Ready to Elevate Your Salon Operations?',
      subtitle: 'Join premier salons, spas, and wellness destinations that rely on BarSpa to coordinate their daily operations.',
      primaryButton: 'Become a BARSPA Partner',
      secondaryButton: 'Sign In to Portal'
    },
    footer: {
      tagline: 'The modern cloud management platform for luxury salons and wellness centers across Saudi Arabia.',
      platformTitle: 'Platform',
      home: 'Home',
      capabilities: 'Capabilities',
      features: 'System Experience',
      join: 'Join BarSpa',
      businessTitle: 'Portals',
      register: 'Register New Business',
      login: 'Operator Sign In',
      trustTitle: 'Security & Legal',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      contact: 'Support & Onboarding',
      rights: 'All rights reserved © 2026 BarSpa. Cloud Operations Platform.'
    }
  }
} as const;

// ==========================================
// 1. SECTION B — B2B HERO SECTION
// ==========================================

function B2BHeroSection({ lang, onNavigate }: PublicLandingSectionProps) {
  const isRtl = lang === 'ar';
  const copy = b2bCopy[lang].hero;

  return (
    <section id="hero" className="relative overflow-hidden rounded-[2.5rem] border border-[#E7DDFC] bg-gradient-to-b from-white via-[#FAF7FD] to-[#F3EDFC] p-6 sm:p-10 md:p-14 lg:p-16 shadow-xl shadow-[#6537C0]/5">
      {/* Decorative luxury radial background glows */}
      <div className="absolute top-0 end-1/4 -z-0 h-96 w-96 rounded-full bg-[#E7DDFC]/50 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 start-1/4 -z-0 h-96 w-96 rounded-full bg-[#D0BFF8]/40 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center text-center space-y-8">
        {/* Brand Badge */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D0BFF8] bg-white/95 px-4 py-2 shadow-xs backdrop-blur-md">
          <img src={barspaIcon} alt="BarSpa" className="h-4 w-4 object-contain" />
          <span className="text-xs font-bold text-[#6537C0] tracking-wide">
            {copy.badge}
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-[#1D035F] leading-[1.2] tracking-tight max-w-4xl">
          {copy.title}
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base md:text-lg lg:text-xl text-slate-600 leading-relaxed max-w-3xl">
          {copy.subtitle}
        </p>

        {/* Dual Primary & Secondary CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-2 w-full justify-center">
          <button
            type="button"
            onClick={() => onNavigate('/register')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-2xl bg-[#6537C0] hover:bg-[#1D035F] px-8 py-4 text-sm sm:text-base font-bold text-white shadow-lg shadow-[#6537C0]/25 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
          >
            <span>{copy.primaryCta}</span>
            <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />
          </button>

          <button
            type="button"
            onClick={() => scrollToAnchor('#platform')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E7DDFC] bg-white hover:bg-[#FAF7FD] px-8 py-4 text-sm sm:text-base font-bold text-[#1D035F] shadow-xs transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
          >
            <span>{copy.secondaryCta}</span>
          </button>
        </div>

        {/* B2B Operational Preview Showcase */}
        <div className="w-full mt-6 rounded-3xl border border-[#E7DDFC] bg-white/95 p-6 md:p-8 shadow-xl shadow-[#6537C0]/10 text-start backdrop-blur-md">
          {/* Top Window Strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7DDFC] pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs sm:text-sm font-bold text-[#1D035F]">
                {copy.preview.windowTitle}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[#FAF7FD] border border-[#E7DDFC] px-3 py-1">
              <ShieldCheck size={14} className="text-[#6537C0]" />
              <span className="text-xs font-semibold text-[#1D035F]">
                {copy.preview.liveStatus}
              </span>
            </div>
          </div>

          {/* Operational Metrics Grid */}
          <div className="grid gap-4 sm:grid-cols-3 pt-5">
            <div className="rounded-2xl border border-[#E7DDFC] bg-[#FAF7FD] p-4 space-y-1">
              <span className="text-xs font-semibold text-slate-500">
                {copy.preview.todayRoster}
              </span>
              <p className="text-base font-bold text-[#1D035F]">
                {copy.preview.rosterActive}
              </p>
            </div>

            <div className="rounded-2xl border border-[#E7DDFC] bg-white p-4 shadow-xs space-y-1">
              <span className="text-xs font-semibold text-slate-500">
                {copy.preview.scheduleMetric}
              </span>
              <p className="text-base font-bold text-[#6537C0]">
                {copy.preview.scheduleDesc}
              </p>
            </div>

            <div className="rounded-2xl border border-[#E7DDFC] bg-[#FAF7FD] p-4 space-y-1">
              <span className="text-xs font-semibold text-slate-500">
                {copy.preview.posMetric}
              </span>
              <p className="text-base font-bold text-[#1D035F]">
                {copy.preview.posDesc}
              </p>
            </div>
          </div>

          {/* Neutral Illustrative Live Room & Chair Status */}
          <div className="mt-4 pt-4 border-t border-[#E7DDFC]/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">
              {copy.preview.recentActionLabel}:
            </span>
            <span className="rounded-md bg-[#FAF7FD] border border-[#E7DDFC] px-2.5 py-1">
              {copy.preview.sampleSlot1}
            </span>
            <span className="rounded-md bg-[#FAF7FD] border border-[#E7DDFC] px-2.5 py-1">
              {copy.preview.sampleSlot2}
            </span>
            <span className="rounded-md bg-[#FAF7FD] border border-[#E7DDFC] px-2.5 py-1 text-emerald-700">
              {copy.preview.sampleSlot3}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ==========================================
// 2. SECTION C — PLATFORM CAPABILITIES
// ==========================================

function PlatformCapabilitiesSection({ lang }: PublicLandingSectionProps) {
  const copy = b2bCopy[lang].capabilities;

  return (
    <section id="platform" className="rounded-[2.5rem] border border-[#E7DDFC] bg-white p-6 sm:p-10 md:p-14 shadow-sm space-y-10">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#D0BFF8] bg-[#FAF7FD] px-3.5 py-1.5 text-xs font-bold text-[#6537C0]">
          <Layers size={14} />
          <span>{copy.badge}</span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#1D035F] tracking-tight">
          {copy.title}
        </h2>
        <p className="text-sm md:text-base text-slate-600 leading-relaxed">
          {copy.subtitle}
        </p>
      </div>

      {/* 4 Core Pillars Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {copy.items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="rounded-2xl border border-[#E7DDFC] bg-[#FAF7FD] p-6 hover:bg-[#F3EDFC]/50 hover:border-[#D0BFF8] transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-white border border-[#E7DDFC] text-[#6537C0] shadow-xs">
                    <Icon size={22} />
                  </div>
                  <span className="text-[11px] font-bold text-[#6537C0] bg-white border border-[#E7DDFC] px-3 py-1 rounded-full">
                    {item.tag}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[#1D035F] mb-2">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ==========================================
// 3. SECTION D — AUTHENTIC PRODUCT SHOWCASE
// ==========================================

function ProductShowcaseSection({ lang }: PublicLandingSectionProps) {
  const copy = b2bCopy[lang].showcase;
  const isRtl = lang === 'ar';
  const [activeTab, setActiveTab] = useState<'board' | 'pos' | 'staff'>('board');

  const currentPreview = copy.previews[activeTab];

  return (
    <section id="features" className="rounded-[2.5rem] border border-[#E7DDFC] bg-gradient-to-b from-[#FAF7FD] via-white to-[#F3EDFC] p-6 sm:p-10 md:p-14 shadow-sm space-y-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#D0BFF8] bg-white px-3.5 py-1.5 text-xs font-bold text-[#6537C0]">
          <LayoutDashboard size={14} />
          <span>{copy.badge}</span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#1D035F] tracking-tight">
          {copy.title}
        </h2>
        <p className="text-sm md:text-base text-slate-600 leading-relaxed">
          {copy.subtitle}
        </p>
      </div>

      {/* Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {copy.tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as 'board' | 'pos' | 'staff')}
            className={`rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#6537C0] text-white shadow-md shadow-[#6537C0]/20'
                : 'border border-[#E7DDFC] bg-white text-slate-600 hover:bg-[#FAF7FD] hover:text-[#1D035F]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Showcase Card Frame */}
      <div className="rounded-3xl border border-[#E7DDFC] bg-white p-6 sm:p-8 shadow-xl shadow-[#6537C0]/5 space-y-6">
        <div className="space-y-2 border-b border-[#E7DDFC] pb-5">
          <h3 className="text-lg sm:text-xl font-bold text-[#1D035F]">
            {currentPreview.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {currentPreview.desc}
          </p>
        </div>

        {/* 3 Detail Columns */}
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-[#E7DDFC] bg-[#FAF7FD] p-5 space-y-2">
            <h4 className="text-sm font-bold text-[#1D035F] flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#6537C0]" />
              {currentPreview.col1Title}
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed ps-6">
              {currentPreview.col1Desc}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E7DDFC] bg-[#FAF7FD] p-5 space-y-2">
            <h4 className="text-sm font-bold text-[#1D035F] flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#6537C0]" />
              {currentPreview.col2Title}
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed ps-6">
              {currentPreview.col2Desc}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E7DDFC] bg-[#FAF7FD] p-5 space-y-2">
            <h4 className="text-sm font-bold text-[#1D035F] flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#6537C0]" />
              {currentPreview.col3Title}
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed ps-6">
              {currentPreview.col3Desc}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ==========================================
// 4. SECTION E — PARTNER CONVERSION CTA
// ==========================================

function PartnerCtaSection({ lang, onNavigate }: PublicLandingSectionProps) {
  const copy = b2bCopy[lang].cta;
  const isRtl = lang === 'ar';

  return (
    <section id="join" className="rounded-[2.5rem] bg-gradient-to-br from-[#1D035F] via-[#2A0878] to-[#6537C0] p-8 sm:p-12 md:p-16 text-white text-center shadow-xl shadow-[#1D035F]/20 relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-0 end-0 h-96 w-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 start-0 h-96 w-96 rounded-full bg-[#A379E2]/20 blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto space-y-6 relative z-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight">
          {copy.title}
        </h2>

        <p className="text-sm md:text-base text-purple-100/90 leading-relaxed max-w-2xl mx-auto">
          {copy.subtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            type="button"
            onClick={() => onNavigate('/register')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-2xl bg-white text-[#1D035F] hover:bg-[#FAF7FD] px-8 py-4 text-sm sm:text-base font-bold shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
          >
            <span>{copy.primaryButton}</span>
            <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 hover:bg-white/20 px-8 py-4 text-sm sm:text-base font-bold text-white backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
          >
            <span>{copy.secondaryButton}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

// ==========================================
// 5. SECTION F — B2B FOOTER
// ==========================================

function B2BFooterSection({ lang, onNavigate }: PublicLandingSectionProps) {
  const copy = b2bCopy[lang].footer;
  const isRtl = lang === 'ar';

  return (
    <footer className="pt-12 pb-6 border-t border-[#E7DDFC] space-y-8 text-xs text-slate-500">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {/* Col 1: Brand & Tagline */}
        <div className="space-y-4">
          <img
            src={barspaLogo}
            alt="BarSpa"
            className="h-9 w-auto object-contain cursor-pointer"
            onClick={() => scrollToAnchor('#hero')}
          />
          <p className="text-xs text-slate-500 leading-relaxed">
            {copy.tagline}
          </p>
        </div>

        {/* Col 2: Platform Links */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#1D035F]">
            {copy.platformTitle}
          </h4>
          <ul className="space-y-2 text-xs">
            <li>
              <button
                type="button"
                onClick={() => scrollToAnchor('#hero')}
                className="hover:text-[#6537C0] transition cursor-pointer"
              >
                {copy.home}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => scrollToAnchor('#platform')}
                className="hover:text-[#6537C0] transition cursor-pointer"
              >
                {copy.capabilities}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => scrollToAnchor('#features')}
                className="hover:text-[#6537C0] transition cursor-pointer"
              >
                {copy.features}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => scrollToAnchor('#join')}
                className="hover:text-[#6537C0] transition cursor-pointer"
              >
                {copy.join}
              </button>
            </li>
          </ul>
        </div>

        {/* Col 3: Business Entry Points */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#1D035F]">
            {copy.businessTitle}
          </h4>
          <ul className="space-y-2 text-xs">
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/register')}
                className="hover:text-[#6537C0] transition cursor-pointer"
              >
                {copy.register}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/login')}
                className="hover:text-[#6537C0] transition cursor-pointer"
              >
                {copy.login}
              </button>
            </li>
          </ul>
        </div>

        {/* Col 4: Trust & Contacts */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#1D035F]">
            {copy.trustTitle}
          </h4>
          <ul className="space-y-2 text-xs">
            <li>
              <span className="text-slate-500">{copy.privacy}</span>
            </li>
            <li>
              <span className="text-slate-500">{copy.terms}</span>
            </li>
            <li>
              <span className="text-slate-500">{copy.contact}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Copyright Strip */}
      <div className="border-t border-[#E7DDFC]/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
        <span>{copy.rights}</span>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[#E7DDFC]/50 px-2.5 py-0.5 text-[#1D035F] font-bold">
            {isRtl ? 'المملكة العربية السعودية 🇸🇦' : 'Saudi Arabia 🇸🇦'}
          </span>
        </div>
      </div>
    </footer>
  );
}

// ==========================================
// REGISTRY EXPORTS
// ==========================================

export const landingSectionRegistry: PublicLandingSectionComponentMap = {
  'b2b-hero': B2BHeroSection,
  'platform-capabilities': PlatformCapabilitiesSection,
  'product-showcase': ProductShowcaseSection,
  'partner-cta': PartnerCtaSection,
  'b2b-footer': B2BFooterSection
};
