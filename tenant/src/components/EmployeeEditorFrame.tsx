"use client";

import Link from "next/link";
import React from "react";

export type EmployeeEditorSection = {
  id: string;
  label: string;
  progressLabel: string;
  progressPercent: number;
};

interface EmployeeEditorFrameProps {
  locale: string;
  isRTL: boolean;
  title: string;
  subtitle: string;
  cancelHref: string;
  saveLabel: string;
  loadingLabel: string;
  cancelLabel: string;
  formId: string;
  loading: boolean;
  error?: string;
  sections: EmployeeEditorSection[];
  activeSection: string;
  onSectionSelect: (sectionId: string) => void;
  children: React.ReactNode;
}

export function EmployeeEditorFrame({
  locale,
  isRTL,
  title,
  subtitle,
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
}: EmployeeEditorFrameProps) {
  return (
    <div className="relative space-y-8 pb-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[280px] bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.10),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.02),_transparent_60%)]" />

      <section className="card overflow-hidden border border-slate-200/80 bg-slate-950 text-white shadow-2xl shadow-slate-950/10">
        <div className="grid gap-6 p-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
              {locale === 'ar' ? 'إدارة الفريق' : 'Team management'}
            </p>
            <h2 className="text-4xl font-black tracking-tight" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {title}
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-300" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {subtitle}
            </p>
          </div>

          <div className={`flex flex-wrap gap-3 ${isRTL ? 'justify-start xl:justify-end' : 'justify-start xl:justify-end'}`}>
            <Link
              href={cancelHref}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <span>{isRTL ? '→' : '←'}</span>
              <span>{cancelLabel}</span>
            </Link>
            <button
              type="submit"
              form={formId}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-950/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? loadingLabel : saveLabel}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      <div className={`flex flex-col gap-6 ${isRTL ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
        <aside className="sticky top-6 w-full shrink-0 rounded-[2rem] border border-slate-200/80 bg-white p-4 shadow-xl shadow-slate-950/5 lg:w-[280px]">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
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
                      ? 'border-cyan-200 bg-cyan-50 text-cyan-800 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="font-medium">{section.label}</span>
                    <span className="text-xs font-semibold text-slate-500">{section.progressLabel}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, section.progressPercent))}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
