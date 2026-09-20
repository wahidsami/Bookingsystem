import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, LoaderCircle } from 'lucide-react';

export interface PublicWizardStepDefinition {
  id: string;
  title: string;
  description?: string;
}

interface PublicWizardEngineProps {
  langDirection: 'rtl' | 'ltr';
  steps: PublicWizardStepDefinition[];
  activeStepIndex: number;
  loading?: boolean;
  error?: string;
  isFirstStep: boolean;
  isLastStep: boolean;
  onBack: () => void;
  onNext: () => void;
  backLabel: string;
  nextLabel: string;
  submitLabel: string;
  nextDisabled?: boolean;
  submitDisabled?: boolean;
  children: ReactNode;
}

export default function PublicWizardEngine({
  langDirection,
  steps,
  activeStepIndex,
  loading = false,
  error,
  isFirstStep,
  isLastStep,
  onBack,
  onNext,
  backLabel,
  nextLabel,
  submitLabel,
  nextDisabled = false,
  submitDisabled = false,
  children
}: PublicWizardEngineProps) {
  const activeStep = steps[activeStepIndex];
  const progress = steps.length > 1 ? ((activeStepIndex + 1) / steps.length) * 100 : 100;
  const isRtl = langDirection === 'rtl';

  return (
    <div dir={langDirection} className="space-y-6">
      {/* Step Header Card */}
      <div className="rounded-3xl border border-[#E7DDFC] bg-white p-5 md:p-6 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#6537C0] font-sans">
              {String(activeStepIndex + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
            </p>
            <h3 className="mt-1 text-xl font-black text-[#1D035F] tracking-tight">{activeStep?.title || ''}</h3>
          </div>
          <div className="rounded-full border border-[#D0BFF8] bg-[#FAF7FD] px-3.5 py-1.5 text-xs font-bold text-[#6537C0] font-sans">
            {Math.round(progress)}%
          </div>
        </div>

        {/* Progress bar with BarSpa purple gradient */}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E7DDFC]/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#6537C0] via-[#A379E2] to-[#D0BFF8] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main Step Content Frame */}
      <div className="min-h-[16rem] rounded-3xl border border-[#E7DDFC] bg-white p-6 md:p-8 shadow-xs">
        {children}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 font-medium">
          {error}
        </div>
      ) : null}

      {/* Footer Navigation Buttons */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isFirstStep || loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E7DDFC] bg-[#FAF7FD] hover:bg-[#F3EDFC] px-6 py-3.5 text-sm font-semibold text-[#1D035F] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          <ArrowLeft size={16} className={isRtl ? 'rotate-180' : ''} />
          <span>{backLabel}</span>
        </button>

        {isLastStep ? (
          <button
            type="submit"
            disabled={loading || submitDisabled}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#6537C0] hover:bg-[#1D035F] px-8 py-3.5 text-sm font-bold text-white shadow-md shadow-[#6537C0]/25 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowRight size={16} className={isRtl ? 'rotate-180' : ''} />}
            <span>{submitLabel}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={loading || nextDisabled}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#6537C0] hover:bg-[#1D035F] px-8 py-3.5 text-sm font-bold text-white shadow-md shadow-[#6537C0]/25 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            <span>{nextLabel}</span>
            <ArrowRight size={16} className={isRtl ? 'rotate-180' : ''} />
          </button>
        )}
      </div>
    </div>
  );
}
