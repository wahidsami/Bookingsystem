/**
 * Currency Component for Saudi Riyal (SAR) - Public Page
 * Displays amounts with the official Saudi Riyal symbol using Claudion font
 * Following Central Bank guidelines: Symbol ALWAYS on the LEFT
 */

import React from 'react';

const RIYAL_SYMBOL = '\u20C0'; // Saudi Riyal Unicode symbol

interface CurrencyProps {
  amount: number | string;
  locale?: string;
  className?: string;
}

export function Currency({ 
  amount, 
  locale = 'ar-SA', 
  className = ''
}: CurrencyProps) {
  // Convert to number if string
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return (
      <span className={`currency-display ${className}`} dir="ltr">
        <span className="riyal-symbol">{RIYAL_SYMBOL}</span>
        {' '}
        0.00
      </span>
    );
  }

  // Format the number according to locale
  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numAmount);

  // Force LTR direction to keep symbol on the left (Central Bank guideline)
  return (
    <span className={`currency-display ${className}`} dir="ltr">
      <span className="riyal-symbol">{RIYAL_SYMBOL}</span>
      {' '}
      {formattedNumber}
    </span>
  );
}

