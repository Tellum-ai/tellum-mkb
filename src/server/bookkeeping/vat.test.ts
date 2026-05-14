import { describe, it, expect } from "bun:test";
import { calculateVatSplit } from "./vat";

// A test file is just: describe what you're testing, then for each case
// write "it should do X" and check the result with expect().

describe("calculateVatSplit", () => {
  // The happy path — the most common case in Dutch bookkeeping
  it("splits a 21% BTW invoice correctly", () => {
    // €121.00 incl. BTW at 21% → €100.00 excl., €21.00 BTW
    const result = calculateVatSplit(12100, 21);
    expect(result.exclVatCents).toBe(10000);
    expect(result.vatCents).toBe(2100);
    expect(result.totalInclVatCents).toBe(12100);
  });

  it("splits a 9% BTW invoice correctly", () => {
    // €109.00 incl. BTW at 9% → €100.00 excl., €9.00 BTW
    const result = calculateVatSplit(10900, 9);
    expect(result.exclVatCents).toBe(10000);
    expect(result.vatCents).toBe(900);
  });

  it("handles 0% BTW — full amount goes to cost account, nothing to BTW", () => {
    const result = calculateVatSplit(10000, 0);
    expect(result.exclVatCents).toBe(10000);
    expect(result.vatCents).toBe(0);
  });

  // Rounding is critical: we always round the excl amount and derive BTW from it.
  // This ensures the three lines always add up: excl + BTW = total (no rounding gap).
  it("rounding: excl + vatCents always equals totalInclVatCents", () => {
    // €10.00 at 21% — the raw division 1000/1.21 = 826.446... needs rounding
    const result = calculateVatSplit(1000, 21);
    expect(result.exclVatCents + result.vatCents).toBe(result.totalInclVatCents);
  });

  it("rounding: works for odd amounts at 21%", () => {
    // €9.99 at 21%
    const result = calculateVatSplit(999, 21);
    expect(result.exclVatCents + result.vatCents).toBe(999);
  });

  it("rounding: works for odd amounts at 9%", () => {
    // €5.55 at 9%
    const result = calculateVatSplit(555, 9);
    expect(result.exclVatCents + result.vatCents).toBe(555);
  });

  // The output must always be integers — we never store fractional cents
  it("always returns integer cents", () => {
    const result = calculateVatSplit(9999, 21);
    expect(Number.isInteger(result.exclVatCents)).toBe(true);
    expect(Number.isInteger(result.vatCents)).toBe(true);
  });

  it("handles a zero-amount invoice", () => {
    const result = calculateVatSplit(0, 21);
    expect(result.exclVatCents).toBe(0);
    expect(result.vatCents).toBe(0);
  });
});
