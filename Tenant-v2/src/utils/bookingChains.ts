import { isSameDay } from 'date-fns';

export interface BookingSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  staffId: string;
  staffName: string;
  serviceId?: string;
}

export interface ChainedService {
  serviceId: string;
  staffId: string | null; // Requested staffId
  duration: number;
}

export interface ChainResult {
  slots: BookingSlot[];
  startTime: string;
  endTime: string;
}

/**
 * Finds all valid continuous chains of services from the provided layers.
 * 
 * @param layers Array of slot arrays, one for each service in sequence.
 * @param durations Array of numbers representing the total occupied duration of each service (duration + buffers) in minutes.
 * @param requestedStartTime Optional time to filter chains starting at or after this time (ISO string).
 * @param maxGapMinutes Maximum allowed gap between services in minutes (default 45).
 * @param minGapMinutes Minimum required gap between services in minutes (default -5).
 * @returns Array of complete chains of slots.
 */
export function calculateAllValidChains(
  layers: BookingSlot[][],
  durations: number[],
  requestedStartTime?: string,
  maxGapMinutes: number = 45,
  minGapMinutes: number = -5
): ChainResult[] {
  if (!layers || layers.length === 0 || layers.some(layer => layer.length === 0)) {
    return [];
  }

  let requestedStart = 0;
  if (requestedStartTime) {
    requestedStart = new Date(requestedStartTime).getTime();
  }

  // Find all possible chains starting from layer 0
  let chains: BookingSlot[][] = layers[0]
    .filter(slot => slot.available && (!requestedStart || new Date(slot.startTime).getTime() >= requestedStart))
    .map(slot => [slot]);

  for (let i = 1; i < layers.length; i++) {
    const nextLayer = layers[i].filter(slot => slot.available);
    const nextChains: BookingSlot[][] = [];

    for (const chain of chains) {
      const lastSlotIndex = chain.length - 1;
      const lastSlot = chain[lastSlotIndex];
      const durationForSlot = durations[lastSlotIndex] || 60; // Fallback if missing
      
      // Calculate true sequential end time based on startTime + occupied duration
      const lastSlotStartMs = new Date(lastSlot.startTime).getTime();
      const calculatedEndMs = lastSlotStartMs + (durationForSlot * 60000);
      
      // Optional consistency diagnostic check against API's slot.endTime
      const apiSlotEndMs = new Date(lastSlot.endTime).getTime();
      if (Math.abs(calculatedEndMs - apiSlotEndMs) > 60000) {
         // This typically happens if the backend slot is just a grid interval
         // rather than the true occupied duration of the service.
         // We proceed with calculatedEndMs as the deterministic source of truth.
      }

      const lastSlotEnd = calculatedEndMs;

      for (const nextSlot of nextLayer) {
        const nextSlotStart = new Date(nextSlot.startTime).getTime();
        const gap = nextSlotStart - lastSlotEnd;

        // Gap must be within acceptable bounds (contiguous is 0 gap)
        if (gap >= minGapMinutes * 60000 && gap <= maxGapMinutes * 60000) {
          nextChains.push([...chain, nextSlot]);
        }
      }
    }
    
    chains = nextChains;

    // Early exit if a layer broke all chains
    if (chains.length === 0) {
      break;
    }
  }

  // Sort chains by their start time
  chains.sort((a, b) => new Date(a[0].startTime).getTime() - new Date(b[0].startTime).getTime());

  // Filter out duplicate start times to only show the "best" contiguous chain per start time
  // (e.g. if Any Professional results in two chains starting at exactly 10:00, pick the first one)
  const uniqueChains: ChainResult[] = [];
  const seenStartTimes = new Set<string>();

  for (const chain of chains) {
    const startTime = chain[0].startTime;
    if (!seenStartTimes.has(startTime)) {
      seenStartTimes.add(startTime);
      uniqueChains.push({
        slots: chain,
        startTime: startTime,
        endTime: chain[chain.length - 1].endTime
      });
    }
  }

  return uniqueChains;
}

/**
 * Calculates the nearest valid continuous chain of services.
 */
export function calculateNearestValidChain(
  layers: BookingSlot[][],
  durations: number[],
  requestedStartTime: string,
  maxGapMinutes: number = 45,
  minGapMinutes: number = -5
): ChainResult | null {
  const chains = calculateAllValidChains(layers, durations, requestedStartTime, maxGapMinutes, minGapMinutes);
  if (chains.length === 0) {
    return null;
  }
  return chains[0];
}
