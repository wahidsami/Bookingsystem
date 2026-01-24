/**
 * Currency Component for Saudi Riyal (SAR) - Admin Dashboard
 * Displays amounts with the official Saudi Riyal symbol using Claudion font
 * Following Central Bank guidelines: Symbol ALWAYS on the LEFT
 */

import React from 'react';
import { formatSARForDisplay, formatSARText } from '@/lib/currency';

interface CurrencyProps {
  amount: number;
  locale?: string;
  className?: string;
  showSymbolOnly?: boolean;
  fallbackText?: boolean;
}

export function Currency({ 
  amount, 
  locale = 'en-SA', 
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

  // Force LTR direction to keep symbol on the left
  return (
    <span className={className} dir="ltr" style={{ display: 'inline-block' }}>
      <span className="riyal-symbol">{symbol}</span>
      {' '}
      {formattedAmount}
    </span>
  );
}

/**
 * Inline currency display
 */
export function InlineCurrency({ amount, locale = 'en-SA' }: { amount: number; locale?: string }) {
  const { symbol, amount: formattedAmount } = formatSARForDisplay(amount, locale);
  
  return (
    <span dir="ltr" style={{ display: 'inline-block' }}>
      <span className="riyal-symbol">{symbol}</span> {formattedAmount}
    </span>
  );
}

/**
 * Currency with custom styling
 */
export function StyledCurrency({ 
  amount, 
  locale = 'en-SA',
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

