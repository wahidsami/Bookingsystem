import type { BIReportColumnDefinition } from './types';

function toPlainText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => toPlainText(item)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function buildExportFileName(title: string, format: 'csv' | 'excel' | 'pdf' | 'print', stamp = new Date()) {
  const safeTitle = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'report';
  const datePart = stamp.toISOString().split('T')[0];
  const extension = format === 'excel' ? 'xlsx' : format;
  return `${safeTitle}-${datePart}.${extension}`;
}

export function serializeRowsToCsv<TRow>(
  rows: TRow[],
  columns: BIReportColumnDefinition<TRow>[]
): string {
  const headers = columns.map((column) => JSON.stringify(toPlainText(column.header)));
  const body = rows.map((row) => {
    const values = columns.map((column) => {
      const rawValue = typeof column.accessor === 'function'
        ? column.accessor(row)
        : (row as Record<string, unknown>)[column.accessor as string];
      const formatted = column.format ? column.format(rawValue, row) : rawValue;
      return JSON.stringify(toPlainText(formatted));
    });
    return values.join(',');
  });

  return [headers.join(','), ...body].join('\n');
}

export function downloadTextFile(fileName: string, content: string, mimeType: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(fileName: string, csv: string): void {
  downloadTextFile(fileName, csv, 'text/csv;charset=utf-8');
}

