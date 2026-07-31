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
    <div dir={langDirection} className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4 md:p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/80">
              {String(activeStepIndex + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
            </p>
            <h3 className="mt-1 text-lg font-black text-white">{activeStep?.title || ''}</h3>
            {activeStep?.description ? (
              <p className="mt-1 text-sm leading-6 text-zinc-300">{activeStep.description}</p>
            ) : null}
          </div>
          <div className="hidden rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200 md:inline-flex">
            {Math.round(progress)}%
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#fbbf24,#f59e0b,#fb7185)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {steps.map((step, index) => {
          const active = index === activeStepIndex;
          const complete = index < activeStepIndex;
          return (
            <div
              key={step.id}
              className={`rounded-2xl border px-4 py-4 text-start text-xs font-semibold transition ${
                active
                  ? 'border-amber-300/60 bg-amber-400/10 text-amber-100 shadow-[0_12px_30px_rgba(251,191,36,0.15)]'
                  : complete
                    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                    : 'border-white/10 bg-black/20 text-zinc-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-black ${
                    active
                      ? 'border-amber-300/70 bg-amber-400/20 text-amber-100'
                      : complete
                        ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100'
                        : 'border-white/10 bg-white/5 text-zinc-400'
                  }`}
                >
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-white">{step.title}</div>
                  {step.description ? <div className="text-[11px] leading-5 text-zinc-400">{step.description}</div> : null}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      <div className="min-h-[20rem] rounded-[1.75rem] border border-white/10 bg-zinc-950/55 p-5 md:p-6 shadow-[0_30px_100px_rgba(0,0,0,0.32)] backdrop-blur-xl">
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

        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-zinc-500">
          <span>{activeStep?.title || ''}</span>
          <span className="hidden h-1.5 w-1.5 rounded-full bg-zinc-500 sm:inline-block" />
          <span>{Math.round(progress)}%</span>
        </div>

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
