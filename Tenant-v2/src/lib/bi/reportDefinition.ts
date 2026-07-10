import type { BIReportDefinition } from './types';

export function defineBIReport<TRow>(definition: BIReportDefinition<TRow>): BIReportDefinition<TRow> {
  return definition;
}

