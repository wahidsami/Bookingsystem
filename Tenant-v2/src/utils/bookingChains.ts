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
 * Calculates the nearest valid continuous chain of services.
 * 
 * @param layers Array of slot arrays, one for each service in sequence.
 * @param requestedStartTime The time the receptionist wants to start the booking (ISO string).
 * @param maxGapMinutes Maximum allowed gap between services in minutes (default 45).
 * @param minGapMinutes Minimum required gap between services in minutes (default -5 to handle slight overlaps if needed, though usually 0).
 * @returns The nearest complete chain of slots, or null if no chain exists.
 */
export function calculateNearestValidChain(
  layers: BookingSlot[][],
  requestedStartTime: string,
  maxGapMinutes: number = 45,
  minGapMinutes: number = -5
): ChainResult | null {
  if (!layers || layers.length === 0 || layers.some(layer => layer.length === 0)) {
    return null;
  }

  const requestedStart = new Date(requestedStartTime).getTime();

  // Find all possible chains
  let chains: BookingSlot[][] = layers[0]
    .filter(slot => slot.available && new Date(slot.startTime).getTime() >= requestedStart)
    .map(slot => [slot]);

  for (let i = 1; i < layers.length; i++) {
    const nextLayer = layers[i].filter(slot => slot.available);
    const nextChains: BookingSlot[][] = [];

    for (const chain of chains) {
      const lastSlot = chain[chain.length - 1];
      const lastSlotEnd = new Date(lastSlot.endTime).getTime();

      for (const nextSlot of nextLayer) {
        const nextSlotStart = new Date(nextSlot.startTime).getTime();
        const gap = nextSlotStart - lastSlotEnd;

        // Gap must be within acceptable bounds (contiguous is 0 gap)
        if (gap >= minGapMinutes * 60000 && gap <= maxGapMinutes * 60000) {
          nextChains.push([...chain, nextSlot]);
        }
      }
    }
    
    // Replace current chains with the extended chains. If this layer found no matches, chains will be empty.
    chains = nextChains;

    // Early exit if a layer broke the chain
    if (chains.length === 0) {
      break;
    }
  }

  if (chains.length === 0) {
    return null;
  }

  // Sort chains by their start time to find the nearest one to the requested time
  chains.sort((a, b) => new Date(a[0].startTime).getTime() - new Date(b[0].startTime).getTime());

  // Return the first (nearest) valid chain
  const bestChain = chains[0];
  
  return {
    slots: bestChain,
    startTime: bestChain[0].startTime,
    endTime: bestChain[bestChain.length - 1].endTime
  };
}
