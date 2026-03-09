export function formatMoney(cents: number, currency: string) {
  const amount = (cents ?? 0) / 100;

  // en-ZM is fine even for USD; it affects separators, not currency correctness
  return new Intl.NumberFormat('en-ZM', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
