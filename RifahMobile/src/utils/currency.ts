// Official Saudi Riyal symbol glyph (mapped in Cairo and SaudiRiyalSymbol fonts).
const RIYAL_SYMBOL = '\uFDFC';

export const SAUDI_RIYAL_UNICODE = '\u00EA';
export const SAUDI_RIYAL_FONT = 'SaudiRiyalSymbol';

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatRiyal = (
  value: number | string | null | undefined,
  _language: 'ar' | 'en' = 'en',
  sign?: string
) => {
  const amount = toNumber(value);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  // In BOTH Arabic and English, the currency symbol MUST ALWAYS appear physically on the LEFT of the amount.
  // Using Left-to-Right Isolate (\u2066) with Left-to-Right Mark (\u200E) guarantees that:
  // 1. In both LTR and RTL containers, the symbol is anchored on the physical LEFT.
  // 2. The amount digits remain strictly in correct LTR order (e.g. 100.00).
  // 3. Preceding signs (+ / -) or surrounding words do not invert the order.
  const prefix = sign ? `${sign}` : '';
  return `\u2066${prefix}\u200E${RIYAL_SYMBOL} \u200E${formatted}\u2069`;
};

export const getRiyalSymbol = () => RIYAL_SYMBOL;

