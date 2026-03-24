export type CurrencyCode = 'SAR' | 'EGP';

export const getCurrencySymbol = (currency?: string, lang: 'ar' | 'en' = 'ar') => {
  if (currency === 'SAR') {
    return lang === 'ar' ? 'ر.س' : 'SAR';
  }
  // Default to EGP
  return lang === 'ar' ? 'ج.م' : 'EGP';
};
