"use client";

import type { ReactNode } from "react";

type CustomerIdentityCellProps = {
  name: ReactNode;
  badge: ReactNode;
  identityLine?: ReactNode;
  rtl?: boolean;
};

export function CustomerIdentityCell({ name, badge, identityLine, rtl = false }: CustomerIdentityCellProps) {
  return (
    <div className={`space-y-1 ${rtl ? "text-right" : "text-left"}`}>
      <div className={`flex flex-wrap items-center gap-2 ${rtl ? "justify-end" : ""}`}>
        <span className="font-semibold text-gray-900">{name}</span>
        <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
          {badge}
        </span>
      </div>
      {identityLine ? (
        <div className="text-xs text-gray-500">{identityLine}</div>
      ) : null}
    </div>
  );
}
