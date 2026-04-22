"use client";

import Link from "next/link";
import React from "react";

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
  return (
    <div className="space-y-6">
      <div className="mb-2 animate-fade-in">
        <div className={`flex flex-col gap-4 ${isRTL ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
          <div className="flex-1">
            <h2 className="mb-2 text-3xl font-bold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {title}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {subtitle}
            </p>
          </div>

          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            <Link href={cancelHref} className="btn btn-secondary">
              {cancelLabel}
            </Link>
            <button type="submit" form={formId} disabled={loading} className="btn btn-primary">
              {loading ? loadingLabel : saveLabel}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      ) : null}

      <div className={`flex flex-col gap-6 ${isRTL ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
        <aside className="sticky top-6 w-full shrink-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:w-[280px]">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
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
                  className={`w-full rounded-xl border px-3 py-3 text-start transition-all ${
                    active
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:bg-gray-50'
                  }`}
                >
                  <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="font-medium">{section.label}</span>
                    <span className="text-xs font-semibold text-gray-500">{section.progressLabel}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
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
