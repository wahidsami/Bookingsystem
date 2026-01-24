/**
 * Saudi Riyal Currency Formatter for Public Page
 * Following Central Bank of Saudi Arabia guidelines:
 * 1. Symbol should appear to the LEFT of the numerical value
 * 2. There should be a SPACE between the symbol and the number
 * 
 * Unicode: U+20C0 (⃀)
 * 
 * NOTE: For React components, use the Currency component instead of formatSAR
 * This function is kept for backward compatibility but returns plain text
 */

const RIYAL_SYMBOL = '\u20C0'; // Saudi Riyal Unicode symbol

/**
 * Format amount as Saudi Riyal with proper symbol (plain text version)
 * @param amount - The amount to format (number or string)
 * @param locale - The locale to use (ar-SA for Arabic, en-SA for English)
 * @param options - Intl.NumberFormatOptions for customization
 * @returns Formatted currency string with Saudi Riyal symbol
 */
export function formatSAR(
  amount: number | string,
  locale: string = 'ar-SA',
  options?: Intl.NumberFormatOptions
): string {
  // Convert to number if string
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return `${RIYAL_SYMBOL} 0.00`;
  }

  // Format the number according to locale
  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(numAmount);

  // Return with Saudi Riyal symbol on the LEFT with a space
  // Example: "⃀ 100.00"
  return `${RIYAL_SYMBOL} ${formattedNumber}`;
}

/**
 * Get the Saudi Riyal symbol
 * @returns The Saudi Riyal Unicode symbol
 */
export function getRiyalSymbol(): string {
  return RIYAL_SYMBOL;
}

