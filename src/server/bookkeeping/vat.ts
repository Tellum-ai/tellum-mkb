export type VatRate = 0 | 9 | 21;

export interface VatSplit {
  totalInclVatCents: number;
  exclVatCents: number;
  vatCents: number;
}

/**
 * Split a total-incl-BTW amount (integer cents) into excl-BTW and BTW parts.
 * Uses back-calculation: excl = round(total / (1 + rate/100)), vat = total - excl.
 * This matches how Dutch bookkeeping handles received invoices — the total is the
 * authoritative figure and the BTW is derived from it, avoiding double-rounding.
 */
export function calculateVatSplit(totalInclVatCents: number, vatRate: VatRate): VatSplit {
  const exclVatCents = Math.round(totalInclVatCents / (1 + vatRate / 100));
  const vatCents = totalInclVatCents - exclVatCents;
  return { totalInclVatCents, exclVatCents, vatCents };
}
