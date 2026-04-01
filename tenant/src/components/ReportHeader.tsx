'use client';

import React from 'react';

export interface ReportHeaderProps {
  tenantName: string;
  startDate: string;
  endDate: string;
  reportTitle?: string;
  generatedAt?: Date;
  notes?: string;
  isRTL?: boolean;
}

export function ReportHeader({
  tenantName,
  startDate,
  endDate,
  reportTitle,
  generatedAt = new Date(),
  notes,
  isRTL = false,
}: ReportHeaderProps) {
  const generatedStr = generatedAt.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div
      className="report-print-area border-b border-gray-200 pb-4 mb-6"
      style={{ textAlign: isRTL ? 'right' : 'left' }}
    >
      <h1 className="text-xl font-bold text-gray-900 mb-1">{tenantName}</h1>
      {reportTitle && (
        <h2 className="text-lg font-semibold text-gray-700 mb-2">{reportTitle}</h2>
      )}
      <div className="text-sm text-gray-600 space-y-0.5">
        <p>
          {isRTL ? 'الفترة: ' : 'Period: '}
          {startDate}
          {isRTL ? ' – ' : ' – '}
          {endDate}
        </p>
        <p>
          {isRTL ? 'تاريخ الإنشاء: ' : 'Generated at: '}
          {generatedStr}
        </p>
      </div>
      {notes && notes.trim() && (
        <p className="text-sm text-gray-500 mt-2 italic">{notes}</p>
      )}
    </div>
  );
}
