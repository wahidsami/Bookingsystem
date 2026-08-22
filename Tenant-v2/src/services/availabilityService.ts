import { tenantApiAdapter } from '../lib/tenantApiAdapter';
import { AvailabilityDiagnostic } from '../lib/bookingConflictDiagnostics';

export interface AvailabilityLayerConfig {
  tenantId: string;
  items: Array<{
    serviceId: string;
    duration?: number | string;
    requestedStaffId?: string;
    staffId?: string;
  }>;
  dateKey: string;
  isRtl?: boolean;
}

export interface AvailabilityLayerResult {
  layers: any[][];
  diagnosticsByLayer: AvailabilityDiagnostic[][];
  anyFailed: boolean;
}

/**
 * Pure service to fetch availability layers for a set of services.
 * Extracted from InteractiveDrawers.tsx / AppointmentWorkspace.tsx.
 */
export const fetchAvailabilityLayers = async ({
  tenantId,
  items,
  dateKey,
  isRtl = false
}: AvailabilityLayerConfig): Promise<AvailabilityLayerResult> => {
  const layers: any[][] = [];
  const diagnosticsByLayer: AvailabilityDiagnostic[][] = [];
  let anyFailed = false;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const searchResp = await tenantApiAdapter.searchAvailability({
        tenantId,
        serviceId: item.serviceId,
        date: dateKey,
        staffId: item.requestedStaffId || undefined
      });

      if (searchResp?.success && searchResp.slots) {
        layers.push(searchResp.slots.map((s: any) => ({ ...s, serviceId: item.serviceId })));
        diagnosticsByLayer.push(Array.isArray(searchResp.diagnostics) ? searchResp.diagnostics : []);
      } else {
        layers.push([]);
        diagnosticsByLayer.push([]);
        anyFailed = true;
      }
    } catch (err) {
      anyFailed = true;
      layers.push([]);
      diagnosticsByLayer.push([]);
    }
  }

  return { layers, diagnosticsByLayer, anyFailed };
};
