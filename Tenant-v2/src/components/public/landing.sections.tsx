import { motion } from 'motion/react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Sparkles,
  Star,
  ShieldCheck
} from 'lucide-react';
import type { PublicLandingSectionComponentMap, PublicLandingSectionProps } from './landing.types';

const text = {
  ar: {
    eyebrow: 'منصة رفاه للعروض والعمليات',
    title: 'واجهة عامة قابلة للتوسعة تجمع بين الهوية الفاخرة وسير عمل الحجز الحقيقي',
    subtitle:
      'هذا الإطار قابل لإضافة أقسام جديدة لاحقاً دون إعادة بناء الصفحة، بينما يبقى السلوك التشغيلي متوافقاً مع إنتاج Refah V1.',
    primary: 'ابدأ التسجيل',
    secondary: 'تسجيل الدخول',
    badge: 'Framework-ready',
    featureCards: [
      { title: 'خدمات واضحة', desc: 'عرض الخدمات والعروض بأولية بصرية عالية مع زر بدء الحجز.', icon: Sparkles },
      { title: 'رحلة حجز سريعة', desc: 'توجيه الزائر بسلاسة نحو التسجيل أو تسجيل الدخول أو بدء الحجز.', icon: CalendarDays },
      { title: 'ثقة وأمان', desc: 'اتصال مباشر بالجلسة الحية بدون طبقات واجهة وهمية أو بيانات تجريبية.', icon: ShieldCheck }
    ],
    stats: [
      { label: 'تدفق واحد', value: 'Landing Framework' },
      { label: 'مسارات منفصلة', value: 'Public / Dashboard' },
      { label: 'قابل للتوسعة', value: 'sections.push(...)' }
    ]
  },
  en: {
    eyebrow: 'Refah public booking framework',
    title: 'A configurable public experience that feels premium and stays compatible with live booking behavior',
    subtitle:
      'This framework can grow by adding sections later without rewriting the page, while keeping behavior aligned with Refah V1 production rules.',
    primary: 'Start registration',
    secondary: 'Sign in',
    badge: 'Framework-ready',
    featureCards: [
      { title: 'Clear services', desc: 'Surface services and offers with high visual priority and a clear book CTA.', icon: Sparkles },
      { title: 'Fast booking flow', desc: 'Guide visitors smoothly into login, registration, or booking intent.', icon: CalendarDays },
      { title: 'Trust by design', desc: 'Use live session behavior only, with no mock data or placeholder routes.', icon: ShieldCheck }
    ],
    stats: [
      { label: 'Single shell', value: 'Landing Framework' },
      { label: 'Isolated routes', value: 'Public / Dashboard' },
      { label: 'Extensible', value: 'sections.push(...)' }
    ]
  }
} as const;

function HeroSection({ lang, onNavigate }: PublicLandingSectionProps) {
  const copy = text[lang];
  const isRtl = lang === 'ar';

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(244,114,182,0.14),_transparent_26%)]" />
      <div className="relative grid gap-10 xl:grid-cols-[1.2fr_0.8fr] p-8 md:p-10 xl:p-12">
        <div className="space-y-8">
          <div className={`inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Sparkles size={14} />
            <span>{copy.badge}</span>
          </div>

          <div className="space-y-5 max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight text-white">
              {copy.title}
            </h1>
            <p className="text-base md:text-xl leading-8 text-zinc-200 max-w-2xl">
              {copy.subtitle}
            </p>
          </div>

          <div className={`flex flex-col sm:flex-row gap-4 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
            <button
              type="button"
              onClick={() => onNavigate('/register')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-6 py-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
            >
              {copy.primary}
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {copy.secondary}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {copy.stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 backdrop-blur"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">{stat.label}</p>
                <p className="mt-2 text-sm font-semibold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 self-center">
          <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950/60 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">{copy.eyebrow}</p>
                <h2 className="mt-2 text-2xl font-bold text-white">{isRtl ? 'إطار القسّمات الجاهز' : 'Composable section shell'}</h2>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-300">
                <CheckCircle2 size={18} />
              </div>
            </div>

            <div className="space-y-3">
              {[
                isRtl ? 'بنية قابلة لإضافة الأقسام مستقبلًا' : 'Section registry for future growth',
                isRtl ? 'لا تغييرات في منطق الحجز أو المصادقة' : 'No changes to booking or auth contracts',
                isRtl ? 'تجربة عامة حديثة متوافقة مع V2' : 'Modern public UX aligned with V2 styling'
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function ValuePropsSection({ lang }: PublicLandingSectionProps) {
  const copy = text[lang];
  const isRtl = lang === 'ar';

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {copy.featureCards.map((card) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-12%' }}
            transition={{ duration: 0.35 }}
            className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-xl"
          >
            <div className={`mb-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white ${isRtl ? 'flex-row-reverse' : ''}`}>
              <Icon size={16} className="text-amber-300" />
              <span className="text-sm font-semibold">{card.title}</span>
            </div>
            <p className="text-sm leading-7 text-zinc-300">{card.desc}</p>
          </motion.div>
        );
      })}
    </section>
  );
}

function ExperienceFlowSection({ lang }: PublicLandingSectionProps) {
  const isRtl = lang === 'ar';
  const steps = isRtl
    ? [
        ['1', 'استكشف الواجهة', 'اطلع على خدمات الصالون والعروض بشكل واضح وفخم.'],
        ['2', 'ابدأ التسجيل', 'أكمل نموذج التسجيل متعدد الخطوات باستخدام نفس حزمة البيانات الحية.'],
        ['3', 'ادخل التجربة الحية', 'بعد الدخول ينتقل المستخدم مباشرة إلى لوحة المستأجر أو المسار المختار.']
      ]
    : [
        ['1', 'Explore the brand', 'See the salon offer and service story with strong visual hierarchy.'],
        ['2', 'Begin registration', 'Use the multi-step registration wizard backed by live APIs.'],
        ['3', 'Enter the live workspace', 'After login the user lands in the tenant workspace immediately.']
      ];

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {steps.map(([step, title, desc]) => (
        <div key={step} className="rounded-[1.5rem] border border-white/10 bg-zinc-950/60 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-300/80">{step}</p>
          <h3 className="mt-3 text-xl font-bold text-white">{title}</h3>
          <p className="mt-3 text-sm leading-7 text-zinc-300">{desc}</p>
        </div>
      ))}
    </section>
  );
}

function TrustStripSection({ lang }: PublicLandingSectionProps) {
  const isRtl = lang === 'ar';
  const items = isRtl
    ? ['الهوية الحية', 'اللغة الثنائية', 'جودة إنتاجية', 'تصميم قابل للتوسعة']
    : ['Live identity', 'Bilingual ready', 'Production quality', 'Extensible by design'];

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3">
        <Star size={16} className="text-amber-300" />
        {items.map((item) => (
          <span key={item} className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-semibold text-zinc-200">
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function FooterSection({ lang }: PublicLandingSectionProps) {
  const isRtl = lang === 'ar';

  return (
    <footer className="pb-2 text-center text-xs text-zinc-500">
      {isRtl
        ? 'منصة رفاه العامة — الإطار قابل للتوسع بدون إعادة بناء الصفحة'
        : 'Refah public experience — framework-first and ready for future sections'}
    </footer>
  );
}

export const landingSectionRegistry: PublicLandingSectionComponentMap = {
  hero: HeroSection,
  'value-props': ValuePropsSection,
  'experience-flow': ExperienceFlowSection,
  trust: TrustStripSection,
  footer: FooterSection
};

