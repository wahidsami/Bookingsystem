/**
 * Currency Component for Saudi Riyal (SAR)
 * Displays amounts with the official Saudi Riyal symbol using Claudion font
 * Following Central Bank guidelines: Symbol ALWAYS on the LEFT (even in Arabic RTL)
 */

import React from 'react';
import { formatSARForDisplay, formatSARText } from '@/lib/currency';

interface CurrencyProps {
  amount: number;
  locale?: string;
  className?: string;
  showSymbolOnly?: boolean;
  fallbackText?: boolean; // If true, shows "SAR" instead of symbol
}

export function Currency({ 
  amount, 
  locale = 'ar-SA', 
  className = '',
  showSymbolOnly = false,
  fallbackText = false
}: CurrencyProps) {
  
  if (fallbackText) {
    return <span className={className}>{formatSARText(amount, locale)}</span>;
  }

  const { symbol, amount: formattedAmount } = formatSARForDisplay(amount, locale);

  if (showSymbolOnly) {
    return <span className={`riyal-symbol ${className}`}>{symbol}</span>;
  }

  // Force LTR direction to keep symbol on the left even in Arabic
  return (
    <span className={className} dir="ltr" style={{ display: 'inline-block' }}>
      <span className="riyal-symbol">{symbol}</span>
      {' '}
      {formattedAmount}
    </span>
  );
}

/**
 * Inline currency display (for use in text)
 * Symbol always on the LEFT (Central Bank guideline)
 */
export function InlineCurrency({ amount, locale = 'ar-SA' }: { amount: number; locale?: string }) {
  const { symbol, amount: formattedAmount } = formatSARForDisplay(amount, locale);
  
  return (
    <span dir="ltr" style={{ display: 'inline-block' }}>
      <span className="riyal-symbol">{symbol}</span> {formattedAmount}
    </span>
  );
}

/**
 * Currency with custom styling for symbol and amount
 * Symbol always on the LEFT (Central Bank guideline)
 */
export function StyledCurrency({ 
  amount, 
  locale = 'ar-SA',
  symbolClassName = '',
  amountClassName = '',
  containerClassName = ''
}: { 
  amount: number; 
  locale?: string;
  symbolClassName?: string;
  amountClassName?: string;
  containerClassName?: string;
}) {
  const { symbol, amount: formattedAmount } = formatSARForDisplay(amount, locale);
  
  return (
    <span className={containerClassName} dir="ltr" style={{ display: 'inline-block' }}>
      <span className={`riyal-symbol ${symbolClassName}`}>{symbol}</span>
      {' '}
      <span className={amountClassName}>{formattedAmount}</span>
    </span>
  );
}

