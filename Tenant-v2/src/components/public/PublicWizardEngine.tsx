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

  return (
    <div dir={langDirection} className="space-y-5">
      <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4 md:p-4 shadow-[0_20px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/80">
              {String(activeStepIndex + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
            </p>
            <h3 className="mt-1 text-lg font-black text-white">{activeStep?.title || ''}</h3>
          </div>
          <div className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
            {Math.round(progress)}%
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#fbbf24,#f59e0b,#fb7185)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="min-h-[16rem] rounded-[1.5rem] border border-white/10 bg-zinc-950/55 p-4 md:p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        {children}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={isFirstStep || loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowLeft size={16} />
          <span>{backLabel}</span>
        </button>

        {isLastStep ? (
          <button
            type="submit"
            disabled={loading || submitDisabled}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            <span>{submitLabel}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={loading || nextDisabled}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{nextLabel}</span>
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
