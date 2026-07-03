import React, { useState, useEffect } from 'react';
import { 
  Star, MessageSquare, ShieldCheck, AlertCircle, RefreshCw, Filter, 
  Trash2, Eye, EyeOff, Search, User, Calendar, ShieldAlert, CheckCircle, 
  MessageCircle, StarHalf, X, Sparkles, FilterX, HelpCircle, ArrowUpRight
} from 'lucide-react';

interface ReviewsWorkspaceProps {
  lang: 'ar' | 'en';
  darkMode?: boolean;
}

interface Review {
  id: string;
  customer: string;
  rating: number;
  employee: string;
  commentAr: string;
  commentEn: string;
  reply: string | null;
  date: string;
  isVisible: boolean;
}

export default function ReviewsWorkspace({ lang, darkMode = false }: ReviewsWorkspaceProps) {
  const isRtl = lang === 'ar';

  // API Data and State
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Advanced Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [selectedRating, setSelectedRating] = useState<string>('all');
  const [filterNeedsReply, setFilterNeedsReply] = useState<boolean>(false);
  const [filterLowRated, setFilterLowRated] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'visible' | 'hidden'>('all');

  // Inline Reply Editing state
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [tempReplyText, setTempReplyText] = useState<string>('');

  // Suggestions for quick replies
  const quickReplySuggestionsAr = [
    "شكراً جزيلاً لثقتكِ الغالية هيا! يسعدنا جداً أن الخدمة نالت استحسانكِ وننتظر زيارتكِ القادمة بشوق.",
    "مرحباً بكِ، نعتذر بشدة عن أي إزعاج أو تأخير غير مقصود. نسعى دوماً للأفضل وسيتواصل معكِ مدير الفرع فوراً لمعالجة الأمر.",
    "ممتنون جداً لملاحظتكِ الثمينة. تم نقل تعليقكِ لقسم التشغيل لضبط مستوى الصوت والحرارة في غرف الخدمات فوراً.",
    "شكراً لتقييمكِ الرائع، فخورون بتقديم أرقى مستويات الضيافة والعناية لضيوف صالون رفاه الفاخر."
  ];

  const quickReplySuggestionsEn = [
    "Thank you so much for your kind trust! We are thrilled that you enjoyed the service and look forward to your next visit.",
    "Hello! We sincerely apologize for any unintended delay or inconvenience. The branch manager will reach out to you shortly to resolve this.",
    "Thank you for your valuable feedback. We have shared your comments with the operations team to adjust spa room conditions immediately.",
    "Thank you for the wonderful rating! We are proud to provide the finest luxury care and hospitality to our esteemed REFAH guests."
  ];

  // Load reviews from API
  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/v1/tenant/reviews');
      if (!response.ok) {
        throw new Error(isRtl ? "فشل جلب قائمة المراجعات والتقييمات من الخادم." : "Could not retrieve the reviews stream from the server.");
      }
      const data = await response.json();
      setReviews(data);
    } catch (err: any) {
      setError(err.message || "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  // Update visibility or reply of a review
  const updateReview = async (id: string, payload: { isVisible?: boolean; reply?: string | null }) => {
    try {
      setActionLoadingId(id);
      const response = await fetch(`/api/v1/tenant/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(isRtl ? "فشل حفظ التعديلات على الخادم." : "Failed to commit changes on the server.");
      }
      const updatedReview = await response.json();
      
      // Update local state
      setReviews(prevReviews => prevReviews.map(r => r.id === id ? updatedReview : r));
      if (editingReplyId === id) {
        setEditingReplyId(null);
        setTempReplyText('');
      }
    } catch (err: any) {
      alert(err.message || "An error occurred.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePublishToggle = (id: string, currentVisible: boolean) => {
    updateReview(id, { isVisible: !currentVisible });
  };

  const handleSaveReply = (id: string) => {
    updateReview(id, { reply: tempReplyText.trim() });
  };

  const handleRemoveReply = (id: string) => {
    if (confirm(isRtl ? "هل أنت متأكد من حذف الرد المكتوب؟" : "Are you sure you want to remove this reply?")) {
      updateReview(id, { reply: null });
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStaff('all');
    setSelectedRating('all');
    setFilterNeedsReply(false);
    setFilterLowRated(false);
    setStartDate('');
    setEndDate('');
    setActiveTab('all');
  };

  // Get unique staff list for advanced filter
  const uniqueStaffList = Array.from(new Set(reviews.map(r => r.employee))).filter(Boolean);

  // Filter logic
  const filteredReviews = reviews.filter(rev => {
    // 1. Tab visibility filter
    if (activeTab === 'visible' && !rev.isVisible) return false;
    if (activeTab === 'hidden' && rev.isVisible) return false;

    // 2. Search query (Customer name, comments)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCustomer = rev.customer.toLowerCase().includes(q);
      const matchCommentAr = rev.commentAr.toLowerCase().includes(q);
      const matchCommentEn = rev.commentEn.toLowerCase().includes(q);
      if (!matchCustomer && !matchCommentAr && !matchCommentEn) return false;
    }

    // 3. Staff filter
    if (selectedStaff !== 'all' && rev.employee !== selectedStaff) return false;

    // 4. Rating filter
    if (selectedRating !== 'all' && rev.rating !== Number(selectedRating)) return false;

    // 5. Needs reply filter (reply is null or empty)
    if (filterNeedsReply && rev.reply !== null) return false;

    // 6. Low rated filter (rating <= 3)
    if (filterLowRated && rev.rating > 3) return false;

    // 7. Date range filter
    if (startDate) {
      const reviewDate = new Date(rev.date);
      const start = new Date(startDate);
      if (reviewDate < start) return false;
    }
    if (endDate) {
      const reviewDate = new Date(rev.date);
      const end = new Date(endDate);
      // set end date to end of day
      end.setHours(23, 59, 59, 999);
      if (reviewDate > end) return false;
    }

    return true;
  });

  // Calculations for Statistics Cards
  const totalReviewsCount = reviews.length;
  const visibleReviewsCount = reviews.filter(r => r.isVisible).length;
  const hiddenReviewsCount = reviews.filter(r => !r.isVisible).length;
  const averageRating = totalReviewsCount > 0 
    ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviewsCount).toFixed(1))
    : 0;

  // Render stars helper
  const renderStars = (rating: number, size = 14) => {
    return (
      <div className="flex gap-0.5 text-amber-500">
        {Array.from({ length: 5 }).map((_, i) => {
          const isFilled = i < Math.floor(rating);
          const isHalf = !isFilled && i < rating;
          if (isFilled) {
            return <Star key={i} size={size} fill="currentColor" stroke="none" />;
          } else if (isHalf) {
            return <StarHalf key={i} size={size} fill="currentColor" className="text-amber-500" />;
          } else {
            return <Star key={i} size={size} className="text-zinc-600" />;
          }
        })}
      </div>
    );
  };

  const getFormattedDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={`space-y-8 ${darkMode ? 'text-zinc-100 font-sans' : 'text-neutral-800 font-sans'}`}>
      
      {/* SIMULATION & HUD CONTROL */}
      <div className={`p-4 rounded-xl border flex flex-wrap gap-4 items-center justify-between ${
        darkMode ? 'bg-zinc-900/80 border-zinc-800' : 'bg-neutral-50 border-neutral-200'
      }`}>
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-500"></span>
          </span>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider">
              {isRtl ? 'محرك مراقبة وإدارة الآراء والتقييمات' : 'REFAH Brand Protection & Reviews Center'}
            </h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              {isRtl 
                ? 'مراجعة آراء ضيوف رفاه، إخفاء التعليقات المسيئة، وتوجيه الردود الموقرة للمحافظة على مكانة الصالون.' 
                : 'Monitor guest reviews, filter low scores, moderate visibility, and write prestigious replies.'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchReviews}
            disabled={loading}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer hover:scale-102 ${
              darkMode ? 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-200' : 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-700'
            }`}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {isRtl ? 'مزامنة التقييمات' : 'Sync Feedback Feed'}
          </button>
        </div>
      </div>

      {/* ERROR HANDLER */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
          <ShieldAlert size={20} className="text-rose-500 shrink-0 mt-0.5" />
          <div className="text-start">
            <h4 className="text-xs font-black text-rose-500">{isRtl ? 'خطأ في معالجة البيانات' : 'Reviews Gateway Offline'}</h4>
            <p className="text-[11px] text-rose-400 mt-1 leading-relaxed">{error}</p>
            <button
              onClick={fetchReviews}
              className="mt-2 text-[10px] bg-rose-500 text-white font-extrabold px-3 py-1 rounded hover:bg-rose-600 cursor-pointer"
            >
              {isRtl ? 'إعادة المحاولة' : 'Retry Connection'}
            </button>
          </div>
        </div>
      )}

      {/* STATISTICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        
        {/* Statistics Card 1: Average Rating */}
        <div className={`p-6 rounded-2xl border text-start flex flex-col justify-between relative overflow-hidden ${
          darkMode ? 'bg-zinc-900/60 border-zinc-850' : 'bg-white border-neutral-150 shadow-xs'
        }`}>
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">
              {isRtl ? 'متوسط تقييم الخدمة' : 'Average Rating'}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-amber-500">{averageRating}</span>
              <span className="text-xs text-zinc-400">/ 5.0</span>
            </div>
            <div className="pt-1">
              {renderStars(averageRating, 16)}
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 mt-4">
            {isRtl ? 'محسوب من إجمالي الآراء والمشاركات.' : 'Aggregated score from real client visits.'}
          </p>
          <div className="absolute right-3 bottom-3 opacity-10">
            <Star size={72} fill="currentColor" />
          </div>
        </div>

        {/* Statistics Card 2: Total Reviews */}
        <div className={`p-6 rounded-2xl border text-start flex flex-col justify-between relative overflow-hidden ${
          darkMode ? 'bg-zinc-900/60 border-zinc-850' : 'bg-white border-neutral-150 shadow-xs'
        }`}>
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">
              {isRtl ? 'إجمالي المراجعات المستلمة' : 'Total Reviews'}
            </span>
            <p className="text-3xl font-black font-mono text-brand-500">{totalReviewsCount}</p>
            <span className="text-[10px] text-emerald-500 font-bold block">
              {reviews.filter(r => r.rating >= 4).length} {isRtl ? 'تقييمات ممتازة (٤-٥ نجمة)' : 'High scores (4-5 ★)'}
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-4">
            {isRtl ? 'الآراء الموثقة عبر نظام الحجوزات الذكي.' : 'Verified customer ratings logged via booking client.'}
          </p>
          <div className="absolute right-3 bottom-3 opacity-10">
            <MessageSquare size={72} />
          </div>
        </div>

        {/* Statistics Card 3: Visible vs Hidden Reviews */}
        <div className={`p-6 rounded-2xl border text-start flex flex-col justify-between relative overflow-hidden ${
          darkMode ? 'bg-zinc-900/60 border-zinc-850' : 'bg-white border-neutral-150 shadow-xs'
        }`}>
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">
              {isRtl ? 'حالة النشر والظهور العام' : 'Visibility Control'}
            </span>
            <div className="flex items-baseline gap-4">
              <div>
                <span className="text-2xl font-black font-mono text-emerald-500">{visibleReviewsCount}</span>
                <span className="text-[10px] text-zinc-400 block">{isRtl ? 'منشور للعامة' : 'Published'}</span>
              </div>
              <div className="border-s border-zinc-800 h-8 self-center px-1"></div>
              <div>
                <span className="text-2xl font-black font-mono text-rose-500">{hiddenReviewsCount}</span>
                <span className="text-[10px] text-zinc-400 block">{isRtl ? 'محجوب / قيد المراجعة' : 'Hidden / Auditing'}</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 mt-4">
            {isRtl ? 'تحكم فوري في جودة المحتوى المعروض على الموقع.' : 'Real-time visibility adjustment on brand public page.'}
          </p>
          <div className="absolute right-3 bottom-3 opacity-10">
            <Eye size={72} />
          </div>
        </div>

      </div>

      {/* FILTER TABS (All, Visible, Hidden) */}
      <div className="border-b border-zinc-800/40 flex justify-between items-center flex-wrap gap-4">
        <div className="flex gap-4">
          <button
            onClick={() => { setActiveTab('all'); }}
            className={`pb-3 text-xs md:text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'all' 
                ? 'border-brand-500 text-brand-500' 
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <MessageSquare size={14} />
            {isRtl ? 'جميع المراجعات' : 'All Reviews'}
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-full font-bold">{totalReviewsCount}</span>
          </button>

          <button
            onClick={() => { setActiveTab('visible'); }}
            className={`pb-3 text-xs md:text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'visible' 
                ? 'border-brand-500 text-brand-500' 
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <CheckCircle size={14} className="text-emerald-500" />
            {isRtl ? 'المنشورة علناً' : 'Published & Visible'}
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full font-bold">{visibleReviewsCount}</span>
          </button>

          <button
            onClick={() => { setActiveTab('hidden'); }}
            className={`pb-3 text-xs md:text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'hidden' 
                ? 'border-brand-500 text-brand-500' 
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <EyeOff size={14} className="text-rose-500" />
            {isRtl ? 'المخفية والموقوفة' : 'Hidden & Audited'}
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded-full font-bold">{hiddenReviewsCount}</span>
          </button>
        </div>

        <button
          onClick={handleResetFilters}
          className="pb-3 text-xs text-brand-500 hover:text-brand-600 transition-all font-bold flex items-center gap-1 cursor-pointer"
        >
          <FilterX size={12} />
          {isRtl ? 'إعادة ضبط التصفية' : 'Reset All Filters'}
        </button>
      </div>

      {/* ADVANCED FILTERS CARD */}
      <div className={`p-5 rounded-2xl border text-start space-y-4 ${
        darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-xs'
      }`}>
        <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-2">
          <Filter size={14} className="text-brand-500" />
          <h4 className="font-extrabold text-xs uppercase tracking-wider">{isRtl ? 'محرك تصفية متقدم للبحث والمطابقة' : 'Advanced Targeting & Search Filters'}</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          
          {/* Search bar */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-400 block">{isRtl ? 'بحث حر (العميل أو التعليق)' : 'Free Search (Client / Comment)'}</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isRtl ? 'ابحث عن اسم، كلمة مفتاحية...' : 'Keyword, customer name...'}
                className={`w-full pl-9 pr-3 py-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold transition-all ${
                  darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200 text-neutral-850'
                }`}
              />
            </div>
          </div>

          {/* Rated Staff */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-400 block">{isRtl ? 'فلترة حسب الموظف المقيّم' : 'Assigned Stylist / Staff'}</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold cursor-pointer transition-all ${
                darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200 text-neutral-850'
              }`}
            >
              <option value="all">{isRtl ? '-- جميع الموظفين --' : '-- All Staff --'}</option>
              {uniqueStaffList.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Stars Rating select */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-400 block">{isRtl ? 'فلترة حسب عدد النجوم' : 'Stars score'}</label>
            <select
              value={selectedRating}
              onChange={(e) => setSelectedRating(e.target.value)}
              className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold cursor-pointer transition-all ${
                darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200 text-neutral-850'
              }`}
            >
              <option value="all">{isRtl ? '-- الكل --' : '-- All Stars --'}</option>
              <option value="5">5 ★★★★★</option>
              <option value="4">4 ★★★★</option>
              <option value="3">3 ★★★</option>
              <option value="2">2 ★★</option>
              <option value="1">1 ★</option>
            </select>
          </div>

          {/* Date range inputs */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-400 block">{isRtl ? 'تاريخ البداية والنهاية' : 'Created Date Range'}</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`p-2 rounded-lg border text-[11px] focus:ring-1 focus:ring-brand-500 outline-hidden flex-1 ${
                  darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200 text-neutral-850'
                }`}
                title={isRtl ? 'تاريخ البداية' : 'Start Date'}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`p-2 rounded-lg border text-[11px] focus:ring-1 focus:ring-brand-500 outline-hidden flex-1 ${
                  darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200 text-neutral-855'
                }`}
                title={isRtl ? 'تاريخ النهاية' : 'End Date'}
              />
            </div>
          </div>

        </div>

        {/* Checkboxes / Switches Row */}
        <div className="flex flex-wrap gap-6 pt-2 border-t border-zinc-800/40 text-xs">
          
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={filterNeedsReply}
              onChange={(e) => setFilterNeedsReply(e.target.checked)}
              className="rounded border-zinc-700 text-brand-500 focus:ring-brand-500 bg-zinc-950 h-4 w-4"
            />
            <span className="font-bold text-zinc-300 group-hover:text-white transition-colors">
              {isRtl ? '⚠️ مراجعات معلقة تحتاج لرد فوري' : 'Needs Professional Reply'}
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={filterLowRated}
              onChange={(e) => setFilterLowRated(e.target.checked)}
              className="rounded border-zinc-700 text-brand-500 focus:ring-brand-500 bg-zinc-950 h-4 w-4"
            />
            <span className="font-bold text-zinc-300 group-hover:text-white transition-colors">
              {isRtl ? '📉 تقييمات متدنية (٣ نجوم أو أقل)' : 'Low Rated Reviews (3★ or less)'}
            </span>
          </label>

          {/* Quick info counter */}
          <div className="mr-auto text-zinc-500 text-[11px] font-bold flex items-center gap-1">
            <Sparkles size={11} className="text-amber-500" />
            <span>
              {isRtl 
                ? `وجدت ${filteredReviews.length} مراجعات مطابقة لمعايير البحث.` 
                : `Found ${filteredReviews.length} records matching search.`}
            </span>
          </div>

        </div>

      </div>

      {/* REVIEWS TABLE */}
      <div className={`rounded-2xl border overflow-hidden ${
        darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-sm'
      }`}>
        <div className="p-5 border-b border-zinc-800/60 flex items-center justify-between flex-wrap gap-3">
          <div className="text-start">
            <h4 className="font-extrabold text-sm flex items-center gap-2">
              <MessageSquare className="text-brand-500" size={16} />
              {isRtl ? 'سجل تقييمات وآراء العملاء' : 'Guest Reviews Moderation Stream'}
            </h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              {isRtl 
                ? 'مراجعة الملاحظات المسجلة للتحقق من تلبيتها معايير الجودة الراقية لرفاه.' 
                : 'View, reply inline, and control public visibility of incoming ratings.'}
            </p>
          </div>

          <span className="text-[10px] font-mono px-2 py-0.5 bg-brand-500/10 border border-brand-500/20 text-brand-500 rounded-full font-bold">
            {isRtl ? `عرض ${filteredReviews.length} من أصل ${reviews.length}` : `Displaying ${filteredReviews.length} of ${reviews.length}`}
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center space-y-4">
            <RefreshCw size={36} className="animate-spin text-brand-500 mx-auto" />
            <p className="text-xs text-zinc-400">{isRtl ? 'جاري جلب الآراء وتغذية التقييمات من الخادم...' : 'Retrieving customer reviews ledger...'}</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="p-4 bg-zinc-800/40 text-zinc-600 rounded-full w-fit mx-auto">
              <Filter size={32} />
            </div>
            <h5 className="font-extrabold text-xs">{isRtl ? 'لم نعثر على أي نتائج مطابقة' : 'No records found'}</h5>
            <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
              {isRtl 
                ? 'جرب تغيير معايير التصفية أو كتابة كلمة مفتاحية مغايرة للوصول للنتائج المطلوبة.' 
                : 'No reviews found matching the active filter parameters. Try adjusting your search query.'}
            </p>
            <button
              onClick={handleResetFilters}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-xl cursor-pointer"
            >
              {isRtl ? 'تصفير الفلاتر والبحث' : 'Reset Target Criteria'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start border-collapse">
              <thead>
                <tr className={`border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px] font-bold ${
                  darkMode ? 'bg-zinc-950/45' : 'bg-neutral-50'
                }`}>
                  <th className="p-4 text-start font-black">{isRtl ? 'العميل' : 'Customer'}</th>
                  <th className="p-4 text-start font-black">{isRtl ? 'التقييم' : 'Rating'}</th>
                  <th className="p-4 text-start font-black">{isRtl ? 'الموظف المسؤول' : 'Stylist / Staff'}</th>
                  <th className="p-4 text-start font-black max-w-xs">{isRtl ? 'التعليق والملاحظات' : 'Customer Comment'}</th>
                  <th className="p-4 text-start font-black">{isRtl ? 'حالة الرد' : 'Reply Log'}</th>
                  <th className="p-4 text-start font-black">{isRtl ? 'التاريخ والوقت' : 'Date & Time'}</th>
                  <th className="p-4 text-start font-black">{isRtl ? 'الظهور للعامة' : 'Visibility'}</th>
                  <th className="p-4 text-center font-black">{isRtl ? 'الإجراءات والتحكم' : 'Moderation Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredReviews.map((rev) => {
                  const isReplying = editingReplyId === rev.id;
                  const hasReply = rev.reply !== null;

                  return (
                    <React.Fragment key={rev.id}>
                      <tr className={`transition-colors hover:bg-zinc-800/20 ${
                        !rev.isVisible ? 'bg-rose-500/[0.02]' : ''
                      }`}>
                        
                        {/* Customer Column */}
                        <td className="p-4 text-start">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500 font-extrabold uppercase text-[11px]">
                              {rev.customer.charAt(0)}
                            </div>
                            <div>
                              <p className="font-extrabold text-xs text-zinc-200">{rev.customer}</p>
                              <span className="text-[9px] text-zinc-500 font-mono block">ID: {rev.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Rating Column */}
                        <td className="p-4 text-start">
                          <div className="space-y-1">
                            <span className="font-mono font-black text-amber-500 text-xs">{rev.rating}.0</span>
                            {renderStars(rev.rating, 11)}
                          </div>
                        </td>

                        {/* Employee Column */}
                        <td className="p-4 text-start font-bold text-zinc-300">
                          <div className="flex items-center gap-1.5">
                            <User size={11} className="text-zinc-500" />
                            <span>{rev.employee}</span>
                          </div>
                        </td>

                        {/* Comment Column */}
                        <td className="p-4 text-start max-w-xs text-zinc-300">
                          <div className="space-y-1 text-xs">
                            <p className="leading-relaxed font-sans font-medium">
                              "{isRtl ? rev.commentAr : rev.commentEn}"
                            </p>
                            <span className="text-[9px] text-zinc-500 italic block">
                              {isRtl ? rev.commentEn : rev.commentAr}
                            </span>
                          </div>
                        </td>

                        {/* Reply Column */}
                        <td className="p-4 text-start">
                          {hasReply ? (
                            <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-[10px] space-y-1">
                              <span className="font-extrabold text-emerald-500 block uppercase tracking-wider text-[8px] flex items-center gap-1">
                                <ShieldCheck size={10} />
                                {isRtl ? 'تم الرد' : 'Replied'}
                              </span>
                              <p className="text-zinc-400 italic line-clamp-2">"{rev.reply}"</p>
                            </div>
                          ) : (
                            <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-extrabold">
                              {isRtl ? 'بانتظار الرد' : 'Pending reply'}
                            </span>
                          )}
                        </td>

                        {/* Date Column */}
                        <td className="p-4 text-start text-[10px] font-mono text-zinc-400">
                          <div className="flex items-center gap-1">
                            <Calendar size={11} className="text-zinc-500" />
                            <span>{getFormattedDate(rev.date)}</span>
                          </div>
                        </td>

                        {/* Visibility badge */}
                        <td className="p-4 text-start">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                            rev.isVisible 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                              : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                          }`}>
                            {rev.isVisible ? (isRtl ? 'مرئي للعامة' : 'Published') : (isRtl ? 'محجوب عن الفيد' : 'Hidden')}
                          </span>
                        </td>

                        {/* Actions buttons */}
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            
                            {/* Toggle visibility */}
                            <button
                              type="button"
                              onClick={() => handlePublishToggle(rev.id, rev.isVisible)}
                              disabled={actionLoadingId === rev.id}
                              className={`p-1.5 rounded-lg border text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                                rev.isVisible 
                                  ? 'bg-rose-500/5 hover:bg-rose-500 text-rose-500 hover:text-white border-rose-500/20' 
                                  : 'bg-emerald-500/5 hover:bg-emerald-500 text-emerald-500 hover:text-white border-emerald-500/20'
                              }`}
                              title={rev.isVisible ? (isRtl ? 'حجب المراجعة عن العامة' : 'Hide from Public') : (isRtl ? 'نشر المراجعة على العام' : 'Publish to Public')}
                            >
                              {rev.isVisible ? <EyeOff size={11} /> : <Eye size={11} />}
                              <span>{rev.isVisible ? (isRtl ? 'حجب' : 'Hide') : (isRtl ? 'نشر' : 'Publish')}</span>
                            </button>

                            {/* Reply button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (isReplying) {
                                  setEditingReplyId(null);
                                  setTempReplyText('');
                                } else {
                                  setEditingReplyId(rev.id);
                                  setTempReplyText(rev.reply || '');
                                }
                              }}
                              className={`p-1.5 rounded-lg border text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                                isReplying 
                                  ? 'bg-zinc-800 border-zinc-700 text-white' 
                                  : 'bg-brand-500/5 hover:bg-brand-500 text-brand-500 hover:text-white border-brand-500/20'
                              }`}
                            >
                              <MessageCircle size={11} />
                              <span>{isReplying ? (isRtl ? 'إلغاء' : 'Cancel') : (hasReply ? (isRtl ? 'تعديل رد' : 'Edit Reply') : (isRtl ? 'رد' : 'Reply'))}</span>
                            </button>

                          </div>
                        </td>

                      </tr>

                      {/* INLINE REPLY ROW DRAWER */}
                      {isReplying && (
                        <tr className={`${
                          darkMode ? 'bg-zinc-950/70' : 'bg-neutral-50/70'
                        }`}>
                          <td colSpan={8} className="p-4">
                            <div className="space-y-3.5 text-start max-w-4xl mx-auto border-s-2 border-brand-500 pl-4 py-1">
                              
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-brand-500 uppercase tracking-wider flex items-center gap-1">
                                  <Sparkles size={11} />
                                  {isRtl ? `صياغة رد موقر من إدارة صالون رفاه على العميل: ${rev.customer}` : `Draft reply to ${rev.customer}`}
                                </span>
                                {hasReply && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveReply(rev.id)}
                                    className="text-[10px] text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <Trash2 size={10} />
                                    {isRtl ? 'حذف الرد الحالي' : 'Delete existing reply'}
                                  </button>
                                )}
                              </div>

                              <textarea
                                value={tempReplyText}
                                onChange={(e) => setTempReplyText(e.target.value)}
                                placeholder={isRtl ? 'اكتب رداً مهذباً وفخماً يناسب هوية ومستوى صالون رفاه الفخم...' : 'Draft a welcoming and prestigious response to represent REFAH salon standards...'}
                                rows={3}
                                className={`w-full p-3 text-xs rounded-xl border focus:ring-1 focus:ring-brand-500 outline-hidden font-medium transition-all ${
                                  darkMode ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-white border-neutral-250 text-neutral-800'
                                }`}
                              />

                              {/* Suggestion Chips */}
                              <div className="space-y-1.5">
                                <span className="text-[9px] text-zinc-500 font-bold block">{isRtl ? '💡 مسودات ردود سريعة ومقترحة جاهزة للاستخدام:' : '💡 Instant prestigious suggestion chips:'}</span>
                                <div className="flex flex-wrap gap-2">
                                  {(isRtl ? quickReplySuggestionsAr : quickReplySuggestionsEn).map((suggest, sIdx) => (
                                    <button
                                      key={sIdx}
                                      type="button"
                                      onClick={() => setTempReplyText(suggest)}
                                      className={`px-3 py-1 rounded-full text-[10px] border font-medium text-start transition-colors cursor-pointer ${
                                        tempReplyText === suggest
                                          ? 'bg-brand-500 border-brand-500 text-white'
                                          : darkMode
                                          ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                                          : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'
                                      }`}
                                    >
                                      {suggest}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Action Buttons inside reply block */}
                              <div className="flex justify-end gap-2.5 pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingReplyId(null);
                                    setTempReplyText('');
                                  }}
                                  className={`px-4 py-2 border rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                                    darkMode ? 'border-zinc-800 text-zinc-400 hover:text-white' : 'border-neutral-200 text-neutral-500 hover:text-neutral-800'
                                  }`}
                                >
                                  {isRtl ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveReply(rev.id)}
                                  disabled={actionLoadingId === rev.id || !tempReplyText.trim()}
                                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-neutral-600 text-white text-[10px] font-extrabold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-brand-500/10"
                                >
                                  {actionLoadingId === rev.id ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                                  {isRtl ? 'حفظ وإرسال الرد' : 'Publish Reply'}
                                </button>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
