export const FX_SCALE = 1_000_000; // 6dp

export function toFxInt(rate: number): number {
  return Math.round(rate * FX_SCALE);
}

export function fromFxInt(rateInt: number): number {
  return rateInt / FX_SCALE;
}

// convert cents in base currency => cents in target currency
export function applyFx(cents: number, fxRateInt: number): number {
  return Math.round((cents * fxRateInt) / FX_SCALE);
}

// Convert "amount in document currency cents" -> "base currency cents"
export function convertToBaseCents(
  amountCents: number,
  fxRateToBaseInt: number,
): number {
  // amount * rate (6dp) => cents
  return Math.round((amountCents * fxRateToBaseInt) / FX_SCALE);
}
