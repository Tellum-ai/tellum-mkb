import type { FixtureAnnotation } from "./eval-fixtures.js";
import type { GeminiExtractionResult } from "./types.js";

export interface EvalResult {
  name: string;
  passed: boolean;
  score: number;
  details: string;
}

const AMOUNT_TOLERANCE = 0.01;

/**
 * Compare a Gemini extraction against the fixture ground truth.
 *
 * Always emits `is_invoice` (catches false positives and false negatives).
 * For confirmed-invoice fixtures, also emits per-field evals for invoice
 * number, date, supplier, total incl. VAT, and VAT amount. We deliberately
 * keep this list short — adding evals is cheap, but each one is a separate
 * span in LangWatch and the dashboard gets noisy fast.
 */
export function evaluateExtraction(
  extracted: GeminiExtractionResult,
  annotation: FixtureAnnotation,
): EvalResult[] {
  const results: EvalResult[] = [];

  const extractedIsInvoice = extracted !== null;
  results.push({
    name: "is_invoice",
    passed: extractedIsInvoice === annotation.wasInvoice,
    score: extractedIsInvoice === annotation.wasInvoice ? 1 : 0,
    details: `expected wasInvoice=${annotation.wasInvoice}, got ${extractedIsInvoice}`,
  });

  // For noise fixtures (wasInvoice=false) we don't run field-level evals —
  // there are no expected field values to compare against.
  if (!annotation.wasInvoice || !extracted) return results;

  const inv = extracted.invoice;

  if (annotation.invoiceNumber !== undefined) {
    const passed = inv.invoice_number === annotation.invoiceNumber;
    results.push({
      name: "invoice_number_exact",
      passed,
      score: passed ? 1 : 0,
      details: `expected ${annotation.invoiceNumber}, got ${inv.invoice_number}`,
    });
  }

  if (annotation.invoiceDate !== undefined) {
    const passed = inv.invoice_date === annotation.invoiceDate;
    results.push({
      name: "invoice_date_exact",
      passed,
      score: passed ? 1 : 0,
      details: `expected ${annotation.invoiceDate}, got ${inv.invoice_date}`,
    });
  }

  if (annotation.supplier !== undefined) {
    const expected = annotation.supplier.toLowerCase();
    const actual = inv.sender.company.toLowerCase();
    const passed = actual.includes(expected) || expected.includes(actual);
    results.push({
      name: "supplier_match",
      passed,
      score: passed ? 1 : 0,
      details: `expected "${annotation.supplier}", got "${inv.sender.company}"`,
    });
  }

  if (annotation.totalInclVat !== undefined) {
    const expected = parseFloat(annotation.totalInclVat);
    const actual = inv.totals.total_incl_vat;
    const passed = Math.abs(expected - actual) <= AMOUNT_TOLERANCE;
    results.push({
      name: "total_incl_vat_within_cent",
      passed,
      score: passed ? 1 : 0,
      details: `expected ${expected.toFixed(2)}, got ${actual.toFixed(2)}`,
    });
  }

  if (annotation.vatAmount !== undefined) {
    const expected = parseFloat(annotation.vatAmount);
    const actual = inv.totals.vat_amount;
    const passed = Math.abs(expected - actual) <= AMOUNT_TOLERANCE;
    results.push({
      name: "vat_amount_within_cent",
      passed,
      score: passed ? 1 : 0,
      details: `expected ${expected.toFixed(2)}, got ${actual.toFixed(2)}`,
    });
  }

  return results;
}
