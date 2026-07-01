"use client";

import type { ReactNode } from "react";
import { ExclamationTriangleIcon, InboxIcon, SparklesIcon } from "@heroicons/react/24/outline";

type SharedSurfaceStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
};

export function LoadingStateCard({ title, description, compact = false }: SharedSurfaceStateProps) {
  return (
    <div className={`card flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-14"}`}>
      <div className="mb-4 rounded-3xl bg-primary/10 p-4 text-primary shadow-sm">
        <SparklesIcon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      {description ? <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">{description}</p> : null}
      <div className="spinner mt-6" />
    </div>
  );
}

export function EmptyStateCard({ title, description, action, compact = false }: SharedSurfaceStateProps) {
  return (
    <div className={`card flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-14"}`}>
      <div className="mb-4 rounded-3xl bg-slate-100 p-4 text-slate-600 shadow-sm">
        <InboxIcon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      {description ? <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorStateCard({ title, description, action, compact = false }: SharedSurfaceStateProps) {
  return (
    <div className={`card flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-14"}`}>
      <div className="mb-4 rounded-3xl bg-rose-500/10 p-4 text-rose-500 shadow-sm">
        <ExclamationTriangleIcon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      {description ? <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

