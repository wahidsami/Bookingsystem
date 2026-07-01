"use client";

import Link from "next/link";
import React from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export type ServiceEditorSection = {
  id: string;
  label: string;
  progressLabel: string;
  progressPercent: number;
};

interface ServiceEditorFrameProps {
  locale: string;
  isRTL: boolean;
  title: string;
  subtitle: string;
  backHref?: string;
  cancelHref: string;
  saveLabel: string;
  loadingLabel: string;
  cancelLabel: string;
  formId: string;
  loading: boolean;
  error?: string;
  sections: ServiceEditorSection[];
  activeSection: string;
  onSectionSelect: (sectionId: string) => void;
  children: React.ReactNode;
}

export function ServiceEditorFrame({
  locale,
  isRTL,
  title,
  subtitle,
  backHref,
  cancelHref,
  saveLabel,
  loadingLabel,
  cancelLabel,
  formId,
  loading,
  error,
  sections,
  activeSection,
  onSectionSelect,
  children
}: ServiceEditorFrameProps) {
  const resolvedBackHref = backHref || cancelHref;
  const backLabel = locale === 'ar' ? 'رجوع' : 'Back';

  return (
    <div className="space-y-6 rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4 text-white shadow-[0_32px_120px_rgba(15,23,42,0.35)] sm:p-6">
      <div className="animate-fade-in">
        <div className={`mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
          <Link
            href={resolvedBackHref}
            className={`inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <ArrowLeftIcon className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
            <span>{backLabel}</span>
          </Link>
        </div>

        <div className={`flex flex-col gap-4 ${isRTL ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
          <div className="flex-1">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              {locale === 'ar' ? 'واجهة تحرير V2' : 'Tenant V2 editor'}
            </div>
            <h2 className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-4xl" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {title}
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {subtitle}
            </p>
          </div>

          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            <Link href={cancelHref} className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:bg-white/10">
              {cancelLabel}
            </Link>
            <button type="submit" form={formId} disabled={loading} className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:from-cyan-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? loadingLabel : saveLabel}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">
          {error}
        </div>
      ) : null}

      <div className={`flex flex-col gap-6 ${isRTL ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
        <aside className="sticky top-6 w-full shrink-0 rounded-[1.75rem] border border-white/10 bg-white/5 p-4 backdrop-blur lg:w-[300px]">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              {locale === 'ar' ? 'أقسام التحرير' : 'Editor Sections'}
            </p>
          </div>
          <div className="space-y-2">
            {sections.map((section) => {
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onSectionSelect(section.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-start transition-all ${
                    active
                      ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100 shadow-[0_10px_30px_rgba(6,182,212,0.12)]'
                      : 'border-white/10 bg-slate-950/40 text-slate-200 hover:border-cyan-300/30 hover:bg-white/10'
                  }`}
                >
                  <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="font-medium">{section.label}</span>
                    <span className="text-xs font-semibold text-slate-400">{section.progressLabel}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, section.progressPercent))}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 flex-1 rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-4 shadow-[0_20px_70px_rgba(15,23,42,0.18)] backdrop-blur sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
