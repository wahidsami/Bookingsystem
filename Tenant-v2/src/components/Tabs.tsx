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
      className="flex items-center gap-2 border-b border-slate-200 bg-white px-6 py-0 overflow-x-auto scrollbar-none shrink-0 h-11"
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
                ? 'border-brand-500 text-brand-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => onSelectTab(tab.id)}
          >
            <span>{title}</span>
            <button
              type="button"
              className={`p-0.5 rounded-md hover:bg-slate-100 transition-colors ${
                isActive ? 'text-brand-600/70 hover:text-brand-600' : 'text-slate-400 hover:text-slate-600'
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
