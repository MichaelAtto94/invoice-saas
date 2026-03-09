export function formatMoney(cents: number, currencyCode: string) {
  const amount = (cents ?? 0) / 100;
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(amount);
}
