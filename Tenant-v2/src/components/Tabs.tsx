import { X } from 'lucide-react';
import { TabItem, Language } from '../types';

interface TabsProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  lang: Language;
}

export default function Tabs({ tabs, activeTabId, onSelectTab, onCloseTab, lang }: TabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div 
      className="flex items-center gap-2 border-b border-[#E7DDFC] dark:border-[#1D035F]/60 bg-white dark:bg-[#0A0124] px-6 py-0 overflow-x-auto scrollbar-none shrink-0 h-11"
      id="workspace-tabs-bar"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const title = lang === 'ar' ? tab.titleAr : tab.titleEn;
        
        return (
          <div
            key={tab.id}
            className={`flex items-center gap-2 px-3 py-0 h-full text-xs md:text-sm transition-all shrink-0 select-none cursor-pointer border-b-2 relative ${
              isActive
                ? 'border-[#6537C0] text-[#1D035F] dark:text-[#FAF7FD] dark:border-[#A379E2] font-bold'
                : 'border-transparent text-slate-500 dark:text-[#A379E2]/70 hover:text-[#1D035F] dark:hover:text-white'
            }`}
            onClick={() => onSelectTab(tab.id)}
          >
            <span>{title}</span>
            <button
              type="button"
              className={`p-0.5 rounded-md hover:bg-[#FAF7FD] dark:hover:bg-[#1D035F]/50 transition-colors ${
                isActive ? 'text-[#6537C0] hover:text-[#1D035F] dark:text-[#A379E2] dark:hover:text-white' : 'text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
