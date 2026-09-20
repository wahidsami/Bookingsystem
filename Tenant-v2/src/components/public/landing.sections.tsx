import { motion } from 'motion/react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Sparkles,
  Star,
  ShieldCheck,
  Award,
  Users,
  TrendingUp,
  Scissors,
  Receipt,
  Gift,
  Clock,
  ChevronRight,
  Layers,
  HeartHandshake
} from 'lucide-react';
import barspaLogo from '../../assets/barspa_logo.png';
import barspaIcon from '../../assets/barspa_app_icon.png';
import type { PublicLandingSectionComponentMap, PublicLandingSectionProps } from './landing.types';

const text = {
  ar: {
    hero: {
      badge: 'منصة سحابية متقدمة لإدارة صالونات وسبا النخبة',
      title: 'ارتقِ بإدارة صالونك الفاخر وتجربة عملائك مع بارسبا',
      subtitle:
        'منظومة متكاملة لجدولة المواعيد، الفوترة، نقاط البيع، وإدارة ولاء العملاء في المملكة العربية السعودية.',
      primary: 'ابدأ التسجيل الآن',
      secondary: 'تسجيل الدخول للمنشأة',
      mockup: {
        liveStatus: 'لوحة التحكم التفاعلية',
        activeBookings: 'حجوزات اليوم',
        totalRevenue: 'إجمالي المبيعات اليومية',
        amount: '24,850 ر.س',
        specialist: 'سارة العتيبي — خبيرة عناية بالبشرة',
        session: 'جلسة هيدرافاشيال ملكية VIP',
        time: '04:30 مساءً',
        eInvoicingLabel: 'فوترة إلكترونية مبسطة',
        satisfaction: 'خدمة متميزة'
      }
    },
    trust: [
      { title: 'فوترة ضريبية مبسطة', subtitle: 'إصدار فواتير ضريبية تدعم رمز الاستجابة السريعة (QR) وطباعة الإيصالات', icon: ShieldCheck },
      { title: 'بنية سحابية موثوقة', subtitle: 'أداء فائق واستقرار تشغيلي مصمم لتلبية متطلبات منشأتك على مدار الساعة', icon: Award },
      { title: 'دعم ومساندة مخصصة', subtitle: 'فريق متخصص لمساندة منشأتك ومساعدتك في الإعداد والتشغيل بكل سلاسة', icon: HeartHandshake },
      { title: 'ثنائية لغوية أصيلة', subtitle: 'واجهة عربية أصيلة مع دعم كامل وسلس للغة الإنجليزية', icon: Sparkles }
    ],
    capabilities: {
      title: 'إمكانيات متكاملة لإدارة الصالونات ومراكز السبا',
      subtitle: 'صُممت كل ميزة في بارسبا لتلبي أدق تفاصيل العمليات اليومية في صالونات ومراكز التجميل الراقية.',
      items: [
        {
          title: 'جدولة ذكية للمواعيد',
          desc: 'تنظيم مواعيد الحجوزات وتوزيع الكراسي والمختصات بكفاءة مع إشعارات تذكير تلقائية للعميلات.',
          icon: CalendarDays,
          tag: 'تنظيم آلي'
        },
        {
          title: 'نقاط بيع وفوترة إلكترونية',
          desc: 'إصدار الفواتير الضريبية المبسطة فوراً مع طباعة الإيصالات وتعدد خيارات الدفع بكل سهولة.',
          icon: Receipt,
          tag: 'فوترة فورية'
        },
        {
          title: 'إدارة الفريق والعمولات',
          desc: 'تنظيم جداول دوام الأخصائيات والإجازات ومتابعة أداء الفريق والعمولات بكل وضوح.',
          icon: Users,
          tag: 'كفاءة تشغيلية'
        },
        {
          title: 'العروض وبطاقات الهدايا',
          desc: 'تنشيط المبيعات عبر باقات الهدايا الرقمية، العروض الحصرية، وإشعارات التواصل المباشر.',
          icon: Gift,
          tag: 'تنشيط المبيعات'
        }
      ]
    },
    values: {
      title: 'لماذا تختار صالونات النخبة منصة بارسبا؟',
      subtitle: 'تحكم كامل ومرن في تجربة العميل والعمليات التشغيلية لمنشأتك.',
      cards: [
        {
          title: 'تجربة ضيافة راقية لعميلاتك',
          desc: 'من لحظة حجز الموعد حتى إنهاء الخدمة، تحظى عميلتك بتجربة استثنائية وسلسة تعزز ولاءها المستمر.',
          metric: 'تجربة ضيافة مميزة'
        },
        {
          title: 'توفير الجهد والوقت الإداري',
          desc: 'أتمتة تنظيم المواعيد والعمليات اليومية يمنح فريقك وقتاً أطول للتركيز على جودة الخدمة وراحة العميلات.',
          metric: 'كفاءة تشغيلية أعلى'
        },
        {
          title: 'رؤية مالية وتحليلية فورية',
          desc: 'تقارير بيع لحظية، مراقبة المخزون، وتحليل المنتجات والخدمات الأكثر طلباً لاتخاذ قرارات دقيقة.',
          metric: 'وضوح مالي شامل'
        }
      ]
    },
    flow: {
      title: 'انضم إلى بارسبا في 3 خطوات بسيطة',
      subtitle: 'خطوات إعداد سهلة وواضحة لتجهيز صالونك وبدء العمل.',
      steps: [
        { step: '01', title: 'سجّل بيانات منشأتك', desc: 'أدخل معلومات الصالون وبيانات التواصل في خطوات ميسرة ومحمية.' },
        { step: '02', title: 'خصّص القوائم والخدمات', desc: 'أضف الأخصائيات، الخدمات، الأسعار، ومواعيد العمل الخاصة بك.' },
        { step: '03', title: 'انطلق واستقبل الحجوزات', desc: 'ابدأ إدارة المواعيد وإصدار الفواتير الفورية بكل سهولة وثقة.' }
      ]
    },
    cta: {
      title: 'جاهز لنقل صالونك إلى مستوى جديد من الفخامة؟',
      subtitle: 'انضم الآن إلى شبكة صالونات وسبا بارسبا واستمتع بتجربة إدارة حديثة وموثوقة.',
      button: 'ابدأ التسجيل الآن'
    },
    footer: {
      description: 'بارسبا — منصة سحابية متقدمة لإدارة صالونات ومراكز التجميل والاستجمام في المملكة العربية السعودية.',
      rights: 'جميع الحقوق محفوظة © 2026 بارسبا (BarSpa).'
    }
  },
  en: {
    hero: {
      badge: 'Advanced Cloud Platform for Luxury Salons & Spas',
      title: 'Elevate Your Luxury Salon & Spa Operations with BarSpa',
      subtitle:
        'A comprehensive cloud solution for smart scheduling, invoicing, POS, staff management, and VIP client loyalty across Saudi Arabia.',
      primary: 'Start Registration',
      secondary: 'Sign In to Portal',
      mockup: {
        liveStatus: 'Interactive Dashboard Preview',
        activeBookings: "Today's Appointments",
        totalRevenue: 'Daily Sales Overview',
        amount: '24,850 SAR',
        specialist: 'Sarah Al-Otaibi — Senior Aesthetician',
        session: 'Royal VIP Hydrafacial Treatment',
        time: '04:30 PM',
        eInvoicingLabel: 'Simplified E-Invoicing',
        satisfaction: 'Top Rated Service'
      }
    },
    trust: [
      { title: 'Simplified E-Invoicing', subtitle: 'Issue tax invoices supporting QR codes, receipt printing, and multiple payment modes', icon: ShieldCheck },
      { title: 'High-Reliability Cloud', subtitle: 'Dependable performance and secure infrastructure tailored for uninterrupted operations', icon: Award },
      { title: 'Dedicated Partner Support', subtitle: 'Specialized team available to guide your onboarding and day-to-day operations', icon: HeartHandshake },
      { title: 'Native Bilingual Design', subtitle: 'Built from the ground up for authentic Arabic and modern English', icon: Sparkles }
    ],
    capabilities: {
      title: 'Comprehensive Capabilities Built for Beauty & Wellness',
      subtitle: 'Every feature in BarSpa is thoughtfully designed to streamline the daily operations of premier salons and spas.',
      items: [
        {
          title: 'Intelligent Scheduling',
          desc: 'Streamlined booking flow that prevents overlap, organizes staff allocation, and sends automated reminders.',
          icon: CalendarDays,
          tag: 'Smart Booking'
        },
        {
          title: 'POS & Invoicing',
          desc: 'Instantly generate simplified invoices, print receipts, and accept multiple payment methods.',
          icon: Receipt,
          tag: 'Quick Checkout'
        },
        {
          title: 'Specialists & Commissions',
          desc: 'Organize team schedules, track service commissions, and manage shifts with complete transparency.',
          icon: Users,
          tag: 'Team Operations'
        },
        {
          title: 'Marketing & Digital Gifts',
          desc: 'Engage clients with branded digital gift cards, exclusive promotions, and real-time announcements.',
          icon: Gift,
          tag: 'Revenue Growth'
        }
      ]
    },
    values: {
      title: 'Why Salons Choose BarSpa',
      subtitle: 'Intuitive operational control and complete visibility over your business.',
      cards: [
        {
          title: 'Prestige Hospitality for Guests',
          desc: 'From online booking to final checkout, offer clients a smooth, elegant experience that fosters long-term loyalty.',
          metric: 'VIP Client Care'
        },
        {
          title: 'Save Time on Admin Work',
          desc: 'Automating routine appointment coordination and calculations lets your team focus entirely on client hospitality.',
          metric: 'Operational Efficiency'
        },
        {
          title: 'Real-Time Operational Clarity',
          desc: 'Monitor daily sales trends, track popular services, and manage resources with confidence.',
          metric: 'Complete Visibility'
        }
      ]
    },
    flow: {
      title: 'Get Started with BarSpa in 3 Simple Steps',
      subtitle: 'A straightforward onboarding journey to configure your salon and launch.',
      steps: [
        { step: '01', title: 'Register Your Business', desc: 'Submit your salon profile and contact details through a secure guided workflow.' },
        { step: '02', title: 'Configure Services & Team', desc: 'Add your specialists, services, custom pricing, and business operating hours.' },
        { step: '03', title: 'Launch & Accept Bookings', desc: 'Start managing appointments and issuing receipts with ease and confidence.' }
      ]
    },
    cta: {
      title: 'Ready to Elevate Your Salon Experience?',
      subtitle: 'Join beauty and wellness centers powered by the modern BarSpa platform.',
      button: 'Start Registration Today'
    },
    footer: {
      description: 'BarSpa — A modern cloud management platform for salons and wellness centers across Saudi Arabia.',
      rights: 'All rights reserved © 2026 BarSpa.'
    }
  }
} as const;

// 1. HERO SECTION
function HeroSection({ lang, onNavigate }: PublicLandingSectionProps) {
  const copy = text[lang].hero;
  const isRtl = lang === 'ar';

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-[2.5rem] border border-[#E7DDFC] bg-gradient-to-b from-white via-[#FAF7FD] to-[#F3EDFC] p-8 md:p-14 lg:p-16 shadow-xl shadow-[#6537C0]/5"
    >
      {/* Subtle decorative glowing background layers */}
      <div className="absolute top-0 right-1/4 -z-0 h-96 w-96 rounded-full bg-[#E7DDFC]/40 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 -z-0 h-96 w-96 rounded-full bg-[#D0BFF8]/30 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center text-center space-y-8">
        
        {/* Brand Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="inline-flex items-center gap-2.5 rounded-full border border-[#D0BFF8] bg-white/90 px-4 py-2 shadow-xs backdrop-blur-md"
        >
          <img src={barspaIcon} alt="BarSpa Icon" className="h-4 w-4 object-contain" />
          <span className="text-xs font-bold text-[#6537C0] font-sans tracking-wide">
            {copy.badge}
          </span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-4xl md:text-5xl lg:text-6xl font-black text-[#1D035F] leading-[1.2] tracking-tight font-sans max-w-4xl"
        >
          {copy.title}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-base md:text-xl text-slate-600 leading-relaxed max-w-3xl font-sans"
        >
          {copy.subtitle}
        </motion.p>

        {/* Dual Primary & Secondary CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="flex flex-col sm:flex-row items-center gap-4 pt-3 w-full justify-center"
        >
          <button
            type="button"
            onClick={() => onNavigate('/register')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-2xl bg-[#6537C0] hover:bg-[#1D035F] px-8 py-4 text-base font-bold text-white shadow-lg shadow-[#6537C0]/25 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
          >
            <span>{copy.primary}</span>
            <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E7DDFC] bg-white hover:bg-[#FAF7FD] px-8 py-4 text-base font-bold text-[#1D035F] shadow-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
          >
            <span>{copy.secondary}</span>
          </button>
        </motion.div>

        {/* Hero Interactive Preview Mockup (Replacing wallethero.jpg completely) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.6 }}
          className="w-full mt-6 rounded-3xl border border-[#E7DDFC] bg-white/95 p-6 md:p-8 shadow-2xl shadow-[#6537C0]/10 text-start relative overflow-hidden backdrop-blur-md"
        >
          {/* Top Status Strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7DDFC] pb-5">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-[#1D035F] tracking-wide uppercase">
                {copy.mockup.liveStatus}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[#FAF7FD] border border-[#E7DDFC] px-3 py-1">
              <ShieldCheck size={14} className="text-[#6537C0]" />
              <span className="text-xs font-semibold text-[#1D035F]">
                {copy.mockup.eInvoicingLabel}
              </span>
            </div>
          </div>

          {/* Core Mockup Widgets Grid */}
          <div className="grid gap-5 md:grid-cols-3 pt-5">
            {/* Widget 1: Revenue Snapshot */}
            <div className="rounded-2xl border border-[#E7DDFC] bg-[#FAF7FD] p-4 flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">
                {copy.mockup.totalRevenue}
              </span>
              <div className="mt-2">
                <p className="text-2xl md:text-3xl font-black text-[#1D035F] font-mono">
                  {copy.mockup.amount}
                </p>
                <p className="text-xs text-emerald-600 font-bold mt-1">
                  {isRtl ? '• تحديث لحظي للمبيعات' : '• Live sales updates'}
                </p>
              </div>
            </div>

            {/* Widget 2: Live VIP Booking */}
            <div className="rounded-2xl border border-[#E7DDFC] bg-white p-4 shadow-xs md:col-span-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6537C0]">
                  {copy.mockup.activeBookings}
                </span>
                <span className="rounded-full bg-[#E7DDFC]/60 text-[#1D035F] px-2.5 py-0.5 text-[11px] font-bold">
                  {copy.mockup.time}
                </span>
              </div>
              <div className="mt-2">
                <h4 className="text-sm md:text-base font-bold text-[#1D035F]">
                  {copy.mockup.session}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {copy.mockup.specialist}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#E7DDFC]/60 text-xs text-slate-500">
                <span className="flex items-center gap-1 text-amber-600 font-bold">
                  <Star size={13} className="fill-amber-500 text-amber-500" />
                  {copy.mockup.satisfaction}
                </span>
                <span className="font-semibold text-[#6537C0]">
                  {isRtl ? 'الدخول للوحة التحكم →' : 'Enter Portal →'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </motion.section>
  );
}

// 2. TRUST STRIP SECTION
function TrustStripSection({ lang }: PublicLandingSectionProps) {
  const items = text[lang].trust;

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.title}
            className="rounded-2xl border border-[#E7DDFC] bg-white p-5 shadow-xs transition hover:shadow-md hover:border-[#D0BFF8]"
          >
            <div className="inline-flex rounded-xl bg-[#FAF7FD] border border-[#E7DDFC] p-2.5 text-[#6537C0] mb-3">
              <Icon size={20} />
            </div>
            <h3 className="text-sm font-bold text-[#1D035F] mb-1">
              {item.title}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {item.subtitle}
            </p>
          </div>
        );
      })}
    </section>
  );
}

// 3. CAPABILITIES SECTION
function CapabilitiesSection({ lang }: PublicLandingSectionProps) {
  const data = text[lang].capabilities;

  return (
    <section className="rounded-[2.5rem] border border-[#E7DDFC] bg-white p-8 md:p-12 shadow-sm space-y-8">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h2 className="text-2xl md:text-3xl font-black text-[#1D035F] tracking-tight">
          {data.title}
        </h2>
        <p className="text-sm md:text-base text-slate-600 leading-relaxed">
          {data.subtitle}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {data.items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-2xl border border-[#E7DDFC] bg-[#FAF7FD] p-6 hover:bg-[#F3EDFC]/50 transition-colors duration-200 flex flex-col justify-between"
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
                <h3 className="text-base md:text-lg font-bold text-[#1D035F] mb-2">
                  {item.title}
                </h3>
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
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

// 4. VALUE PROPS SECTION
function ValuePropsSection({ lang }: PublicLandingSectionProps) {
  const data = text[lang].values;

  return (
    <section className="space-y-8">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h2 className="text-2xl md:text-3xl font-black text-[#1D035F] tracking-tight">
          {data.title}
        </h2>
        <p className="text-sm md:text-base text-slate-600 leading-relaxed">
          {data.subtitle}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {data.cards.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-[#E7DDFC] bg-white p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-[#FAF7FD] border border-[#E7DDFC] text-xs font-bold text-[#6537C0] mb-4">
                {card.metric}
              </span>
              <h3 className="text-base font-bold text-[#1D035F] mb-2">
                {card.title}
              </h3>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                {card.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// 5. EXPERIENCE FLOW SECTION
function ExperienceFlowSection({ lang }: PublicLandingSectionProps) {
  const data = text[lang].flow;

  return (
    <section className="rounded-[2.5rem] border border-[#E7DDFC] bg-[#FAF7FD] p-8 md:p-12 space-y-8">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h2 className="text-2xl md:text-3xl font-black text-[#1D035F] tracking-tight">
          {data.title}
        </h2>
        <p className="text-sm md:text-base text-slate-600 leading-relaxed">
          {data.subtitle}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {data.steps.map((step) => (
          <div
            key={step.step}
            className="rounded-2xl border border-[#E7DDFC] bg-white p-6 shadow-xs relative overflow-hidden"
          >
            <span className="text-4xl font-black text-[#D0BFF8]/40 font-mono absolute top-4 end-4">
              {step.step}
            </span>
            <div className="relative z-10">
              <span className="inline-block px-3 py-1 rounded-full bg-[#6537C0]/10 text-xs font-bold text-[#6537C0] mb-3">
                {lang === 'ar' ? `المرحلة ${step.step}` : `Step ${step.step}`}
              </span>
              <h3 className="text-base font-bold text-[#1D035F] mb-2">
                {step.title}
              </h3>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// 6. SECONDARY CONVERSION CTA BANNER
function CtaBannerSection({ lang, onNavigate }: PublicLandingSectionProps) {
  const copy = text[lang].cta;
  const isRtl = lang === 'ar';

  return (
    <section className="rounded-[2.5rem] bg-gradient-to-br from-[#1D035F] via-[#2A0878] to-[#6537C0] p-8 md:p-14 text-white text-center shadow-xl shadow-[#1D035F]/20 relative overflow-hidden">
      <div className="max-w-2xl mx-auto space-y-6 relative z-10">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
          {copy.title}
        </h2>
        <p className="text-sm md:text-base text-purple-100/90 leading-relaxed">
          {copy.subtitle}
        </p>
        <div>
          <button
            type="button"
            onClick={() => onNavigate('/register')}
            className="inline-flex items-center gap-3 rounded-2xl bg-white text-[#1D035F] hover:bg-[#FAF7FD] px-8 py-4 text-base font-bold shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            <span>{copy.button}</span>
            <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />
          </button>
        </div>
      </div>
    </section>
  );
}

// 7. FOOTER SECTION
function FooterSection({ lang }: PublicLandingSectionProps) {
  const copy = text[lang].footer;

  return (
    <footer className="pt-8 pb-4 border-t border-[#E7DDFC] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
      <div className="flex items-center gap-3">
        <img src={barspaLogo} alt="BarSpa" className="h-7 w-auto object-contain" />
        <span className="hidden sm:inline text-slate-400">|</span>
        <span className="hidden sm:inline max-w-md truncate">{copy.description}</span>
      </div>
      <div>
        <span>{copy.rights}</span>
      </div>
    </footer>
  );
}

export const landingSectionRegistry: PublicLandingSectionComponentMap = {
  hero: HeroSection,
  trust: TrustStripSection,
  capabilities: CapabilitiesSection,
  'value-props': ValuePropsSection,
  'experience-flow': ExperienceFlowSection,
  'cta-banner': CtaBannerSection,
  footer: FooterSection
};
