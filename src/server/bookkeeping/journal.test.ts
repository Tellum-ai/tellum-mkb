import { describe, it, expect } from "bun:test";
import { isBalanced } from "./journal";

describe("isBalanced", () => {
  it("returns true when debits equal credits", () => {
    // This mirrors a real purchase invoice booking:
    // DEBIT cost account 8000, DEBIT BTW 2100 → CREDIT crediteuren 10100
    const lines = [
      { debit: 8000, credit: null },
      { debit: 2100, credit: null },
      { debit: null, credit: 10100 },
    ];
    expect(isBalanced(lines)).toBe(true);
  });

  it("returns false when debits do not equal credits", () => {
    const lines = [
      { debit: 5000, credit: null },
      { debit: null, credit: 9999 }, // 1 cent off
    ];
    expect(isBalanced(lines)).toBe(false);
  });

  it("returns true for a simple single-line debit/credit pair", () => {
    const lines = [
      { debit: 10000, credit: null },
      { debit: null, credit: 10000 },
    ];
    expect(isBalanced(lines)).toBe(true);
  });

  it("returns true for an empty set of lines (vacuously balanced: 0 == 0)", () => {
    expect(isBalanced([])).toBe(true);
  });

  it("treats null as zero for debit", () => {
    const lines = [
      { debit: null, credit: 5000 },
      { debit: 5000, credit: null },
    ];
    expect(isBalanced(lines)).toBe(true);
  });

  it("treats null as zero for credit", () => {
    const lines = [
      { debit: 5000, credit: null },
      { debit: null, credit: 5000 },
    ];
    expect(isBalanced(lines)).toBe(true);
  });

  // A journal entry that is all debits with no credits is never balanced
  it("returns false when there are only debits", () => {
    const lines = [
      { debit: 5000, credit: null },
      { debit: 3000, credit: null },
    ];
    expect(isBalanced(lines)).toBe(false);
  });
});
