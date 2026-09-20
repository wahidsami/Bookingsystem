import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { Language, ViewType } from '../types';
import { translations, navigationItems } from '../data/translations';

interface BreadcrumbsProps {
  view: ViewType;
  lang: Language;
}

export default function Breadcrumbs({ view, lang }: BreadcrumbsProps) {
  const t = translations[lang];
  const activeItem = navigationItems.find(item => item.id === view);

  const getCategoryLabel = (category: string) => {
    return t.categories[category as keyof typeof t.categories] || category;
  };

  const isRtl = lang === 'ar';
  const ArrowIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-[#A379E2]/70 font-semibold font-sans py-1">
      <div className="flex items-center gap-1 hover:text-[#6537C0] dark:hover:text-white cursor-pointer transition-colors">
        <Home size={13} className="text-slate-400 dark:text-[#A379E2]/70" />
        <span>{t.breadcrumbHome}</span>
      </div>
      
      {activeItem && (
        <>
          <ArrowIcon size={12} className="text-[#E7DDFC] dark:text-[#1D035F] mx-0.5" />
          <span className="hover:text-[#6537C0] dark:hover:text-white cursor-pointer transition-colors">
            {getCategoryLabel(activeItem.category)}
          </span>
          
          <ArrowIcon size={12} className="text-[#E7DDFC] dark:text-[#1D035F] mx-0.5" />
          <span className="text-[#1D035F] dark:text-[#FAF7FD] font-bold">
            {isRtl ? activeItem.labelAr : activeItem.labelEn}
          </span>
        </>
      )}
    </nav>
  );
}
