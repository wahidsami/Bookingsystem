"use client";

import React, { ReactNode } from "react";

type SummaryItem = {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
};

type DetailTab = {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
};

type AnalyticsDetailsDrawerProps = {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  summaryItems: SummaryItem[];
  tabs: DetailTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  tabPanels: Record<string, ReactNode>;
  actions?: ReactNode;
  footer?: ReactNode;
  sideNote?: ReactNode;
};

export function AnalyticsDetailsDrawer({
  open,
  title,
  subtitle,
  onClose,
  summaryItems,
  tabs,
  activeTab,
  onTabChange,
  tabPanels,
  actions,
  footer,
  sideNote,
}: AnalyticsDetailsDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 top-0 p-3 sm:p-4 lg:p-6">
        <div className="mx-auto flex h-full w-full max-w-[88vw] flex-col overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Analytics drill-down
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-900">{title}</h2>
              {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[320px_220px_minmax(0,1fr)]">
            <aside className="border-b border-gray-200 bg-gray-50 p-5 lg:border-b-0 lg:border-r">
              <div className="space-y-3">
                {summaryItems.map((item, index) => (
                  <div key={index} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{item.label}</div>
                    <div className="mt-2 text-lg font-bold text-gray-900">{item.value}</div>
                    {item.note ? <div className="mt-1 text-xs text-gray-500">{item.note}</div> : null}
                  </div>
                ))}
                {sideNote ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600">
                    {sideNote}
                  </div>
                ) : null}
              </div>
            </aside>

            <section className="border-b border-gray-200 bg-white p-4 lg:border-b-0 lg:border-r">
              <div className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
                {tabs.map((tab) => {
                  const active = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onTabChange(tab.id)}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className={`font-semibold ${active ? "text-primary-700" : "text-gray-900"}`}>
                            {tab.label}
                          </div>
                          {tab.description ? (
                            <div className="mt-1 text-xs leading-5 text-gray-500">{tab.description}</div>
                          ) : null}
                        </div>
                        {tab.badge ? <div className="shrink-0 text-xs font-semibold text-gray-500">{tab.badge}</div> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <main className="min-h-0 overflow-y-auto bg-white p-5 sm:p-6">
              {tabPanels[activeTab] || (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
                  No details available.
                </div>
              )}
              {footer ? <div className="mt-5">{footer}</div> : null}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
