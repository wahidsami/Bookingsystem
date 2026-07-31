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

  return (
    <div dir={langDirection} className="space-y-6">
      <div className="grid gap-3 md:grid-cols-6">
        {steps.map((step, index) => {
          const active = index === activeStepIndex;
          const complete = index < activeStepIndex;
          return (
            <div
              key={step.id}
              className={`rounded-2xl border px-3 py-3 text-center text-xs font-semibold ${
                active
                  ? 'border-amber-300 bg-amber-400/10 text-amber-200'
                  : complete
                    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                    : 'border-white/10 bg-white/5 text-zinc-400'
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.24em] opacity-70">{String(index + 1).padStart(2, '0')}</div>
              <div className="mt-1">{step.title}</div>
            </div>
          );
        })}
      </div>

      <div className="min-h-[20rem]">{children}</div>

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

        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-[0.24em] text-zinc-500">
            {activeStep?.title || ''}
          </span>
        </div>

        {isLastStep ? (
          <button
            type="submit"
            disabled={loading || submitDisabled}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            <span>{submitLabel}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={loading || nextDisabled}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{nextLabel}</span>
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
