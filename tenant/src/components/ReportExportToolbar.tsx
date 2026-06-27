'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type ToolbarButtonProps = {
  label: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  href?: string;
  tone?: 'primary' | 'secondary';
};

function ToolbarButton({ label, onClick, disabled, href, tone = 'secondary' }: ToolbarButtonProps) {
  const baseClass =
    tone === 'primary'
      ? 'border-primary bg-primary text-white hover:opacity-90'
      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50';

  const shared = `inline-flex items-center justify-center rounded-full border px-3.5 py-2 text-sm font-semibold transition ${baseClass} ${
    disabled ? 'cursor-not-allowed opacity-50 hover:bg-white hover:opacity-50' : ''
  }`;

  if (href) {
    if (disabled) {
      return <span className={shared} aria-disabled="true">{label}</span>;
    }
    return (
      <Link href={href} className={shared} aria-disabled={disabled}>
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={shared}>
      {label}
    </button>
  );
}

export function ReportExportToolbar({
  locale,
  previewHref,
  onExportPdf,
  onExportCsv,
  onExportExcel,
  onPrint,
  disabled = false,
  previewLabel,
  pdfLabel,
  csvLabel,
  excelLabel,
  printLabel
}: {
  locale: string;
  previewHref?: string;
  onExportPdf: () => void | Promise<void>;
  onExportCsv: () => void | Promise<void>;
  onExportExcel: () => void | Promise<void>;
  onPrint: () => void | Promise<void>;
  disabled?: boolean;
  previewLabel?: string;
  pdfLabel?: string;
  csvLabel?: string;
  excelLabel?: string;
  printLabel?: string;
}) {
  const isRTL = locale === 'ar';

  const buttons: ReactNode[] = [
    <ToolbarButton
      key="preview"
      label={previewLabel || (locale === 'ar' ? 'معاينة' : 'Preview')}
      href={previewHref}
      disabled={disabled || !previewHref}
      tone="primary"
    />,
    <ToolbarButton
      key="pdf"
      label={pdfLabel || (locale === 'ar' ? 'PDF' : 'PDF')}
      onClick={onExportPdf}
      disabled={disabled}
    />,
    <ToolbarButton
      key="csv"
      label={csvLabel || (locale === 'ar' ? 'CSV' : 'CSV')}
      onClick={onExportCsv}
      disabled={disabled}
    />,
    <ToolbarButton
      key="excel"
      label={excelLabel || (locale === 'ar' ? 'Excel' : 'Excel')}
      onClick={onExportExcel}
      disabled={disabled}
    />,
    <ToolbarButton
      key="print"
      label={printLabel || (locale === 'ar' ? 'Print' : 'Print')}
      onClick={onPrint}
      disabled={disabled}
    />
  ];

  return (
    <div className={`no-print flex flex-wrap items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
      {buttons}
    </div>
  );
}
