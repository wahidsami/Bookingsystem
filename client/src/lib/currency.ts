/**
 * Saudi Riyal Currency Formatter
 * Following Central Bank of Saudi Arabia guidelines:
 * 1. Symbol should appear to the LEFT of the numerical value
 * 2. There should be a SPACE between the symbol and the number
 * 3. Symbol maintains correct shape using Claudion font
 * 
 * Unicode: U+20C0 (⃀)
 */

const RIYAL_SYMBOL = '\u20C0'; // Saudi Riyal Unicode symbol

/**
 * Format amount as Saudi Riyal with proper symbol
 * @param amount - The amount to format
 * @param locale - The locale to use (default: 'ar-SA' for Arabic/Saudi)
 * @param options - Intl.NumberFormatOptions for customization
 * @returns Formatted currency string with Saudi Riyal symbol
 */
export function formatSAR(
  amount: number,
  locale: string = 'ar-SA',
  options?: Intl.NumberFormatOptions
): string {
  // Format the number according to locale
  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);

  // Return with Saudi Riyal symbol on the LEFT with a space
  // Example: "⃀ 100.00"
  return `${RIYAL_SYMBOL} ${formattedNumber}`;
}

/**
 * Format amount as Saudi Riyal for HTML display
 * Wraps the symbol in a span with the riyal-symbol class for proper font rendering
 * @param amount - The amount to format
 * @param locale - The locale to use
 * @returns Object with symbol and amount for flexible rendering
 */
export function formatSARForDisplay(
  amount: number,
  locale: string = 'ar-SA'
): { symbol: string; amount: string; full: string } {
  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return {
    symbol: RIYAL_SYMBOL,
    amount: formattedNumber,
    full: `${RIYAL_SYMBOL} ${formattedNumber}`,
  };
}

/**
 * Get the Saudi Riyal symbol
 * @returns The Saudi Riyal Unicode symbol
 */
export function getRiyalSymbol(): string {
  return RIYAL_SYMBOL;
}

/**
 * Format amount as SAR text (for fallback when font is not loaded)
 * @param amount - The amount to format
 * @param locale - The locale to use
 * @returns Formatted currency string with "SAR" text
 */
export function formatSARText(
  amount: number,
  locale: string = 'ar-SA'
): string {
  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return locale === 'ar' 
    ? `${formattedNumber} ر.س` 
    : `SAR ${formattedNumber}`;
}

