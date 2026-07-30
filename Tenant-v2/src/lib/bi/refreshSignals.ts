import { useEffect } from 'react';

export const BI_REPORT_REFRESH_EVENT = 'tenant:report-refresh';

export function emitBIReportRefresh(detail?: unknown) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(BI_REPORT_REFRESH_EVENT, { detail }));
}

export function useBIReportRefreshSignal(onRefresh: () => void) {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handler = () => onRefresh();
    window.addEventListener(BI_REPORT_REFRESH_EVENT, handler as EventListener);
    return () => window.removeEventListener(BI_REPORT_REFRESH_EVENT, handler as EventListener);
  }, [onRefresh]);
}
