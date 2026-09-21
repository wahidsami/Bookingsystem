/**
 * BiDi (Bidirectional) text utilities for Arabic & mixed-direction strings.
 * 
 * Provides standard Unicode bidirectional formatting controls to guarantee
 * that mixed Arabic + Latin/English tokens (brand names, tracking numbers, codes)
 * render in their natural directional flow without sentence inversion.
 */

// Unicode bidirectional formatting characters
export const BIDI_LRM = '\u200E'; // Left-to-Right Mark
export const BIDI_RLM = '\u200F'; // Right-to-Left Mark
export const BIDI_LRI = '\u2066'; // Left-to-Right Isolate
export const BIDI_RLI = '\u2067'; // Right-to-Left Isolate
export const BIDI_FSI = '\u2068'; // First Strong Isolate
export const BIDI_PDI = '\u2069'; // Pop Directional Isolate

/**
 * Isolates a Latin or brand token (e.g., "BarSpa") inside an RTL Arabic sentence.
 * Ensures the Latin word reads LTR internally, while remaining at the correct
 * semantic position in the RTL sentence without flipping neighboring punctuation or words.
 */
export function isolateLatinInRtl(text: string): string {
    if (!text) return '';
    return `${BIDI_RLM}${BIDI_LRI}${text}${BIDI_PDI}${BIDI_RLM}`;
}

/**
 * Formats a title with a variant or separator in an RTL-aware manner,
 * preventing dashes or punctuation from jumping sides.
 */
export function formatRtlSeparated(base: string, suffix?: string | null, isRTL: boolean = true): string {
    if (!suffix) return base;
    if (isRTL) {
        return `${BIDI_RLM}${base} \u2014 ${suffix}${BIDI_RLM}`;
    }
    return `${base} — ${suffix}`;
}
