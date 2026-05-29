const RIYAL_SYMBOL = '\u20C0';

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatRiyal = (
  value: number | string | null | undefined,
  language: 'ar' | 'en' = 'en'
) => {
  const amount = toNumber(value);
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${RIYAL_SYMBOL} ${formatted}`;
};

export const getRiyalSymbol = () => RIYAL_SYMBOL;

