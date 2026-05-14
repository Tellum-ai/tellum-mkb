import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import { env } from "~/env.js";
import type { GeminiExtractionResult, ParsedEmail } from "./types.js";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  vat_rate: z.number(),
  subtotal: z.number(),
});

const InvoiceSchema = z.object({
  invoice_number: z.string(),
  invoice_date: z.string(),
  due_date: z.string().nullable(),
  sender: z.object({
    company: z.string(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    postal_code: z.string().nullable(),
    country: z.string().nullable(),
    kvk: z.string().nullable(),
    btw: z.string().nullable(),
    iban: z.string().nullable(),
  }),
  client: z.object({
    company: z.string(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    postal_code: z.string().nullable(),
    country: z.string().nullable(),
  }),
  line_items: z.array(LineItemSchema),
  totals: z.object({
    subtotal_excl_vat: z.number(),
    vat_amount: z.number(),
    total_incl_vat: z.number(),
  }),
  payment_reference: z.string().nullable(),
  payment_status: z.enum(["paid", "unpaid", "unknown"]),
  vat_treatment: z.enum(["nl_standaard", "nl_verlegd", "eu_diensten", "buiten_eu"]),
  cost_category: z.number().int(),
});

// Envelope shape: Google's structured-output subset does not support top-level
// unions (`Invoice | null`), so we wrap the result in a discriminator flag with
// a nullable invoice payload. We collapse back to `{invoice} | null` on return.
const ExtractionEnvelopeSchema = z.object({
  is_invoice: z.boolean(),
  invoice: InvoiceSchema.nullable(),
});

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `
You are a financial document extraction assistant for Dutch SME bookkeeping.

Analyze the provided email content (HTML body and any attached PDFs).

If the email contains an invoice (a request for payment for goods or services), set "is_invoice" to true and populate "invoice" with ALL available data matching the provided schema.

If the email does NOT contain an invoice, set "is_invoice" to false and "invoice" to null.

## vat_treatment rules (critical — get this right):

- "nl_standaard": Dutch supplier (country=NL) that charges BTW normally (21%, 9%, or 0% exempt). The invoice includes a Dutch BTW number (NL...) and a non-zero vat_amount, OR is a 0% exempt Dutch supply.
- "nl_verlegd": Dutch supplier (country=NL) but BTW is reversed — invoice says "BTW verlegd", "reverse charge", or shows 0% with a note that the buyer must self-assess. Common in construction and certain services.
- "eu_diensten": Supplier is in an EU member state (NOT the Netherlands) — e.g. Germany (DE), Ireland (IE), France (FR), etc. Invoice shows 0% VAT or "reverse charge" / "BTW verlegd naar afnemer" because it is a B2B intracommunautaire service or goods supply. The receiving Dutch company must self-assess Dutch VAT at 21%.
- "buiten_eu": Supplier is outside the EU entirely — e.g. United States (US), United Kingdom (GB post-Brexit), Canada (CA), etc. No VAT on the invoice. Examples: Vercel (US), GitHub (US), Stripe (US).

## cost_category rules:

Pick the most appropriate ledger account number from this Dutch chart of accounts:
- 4000: General purchase costs (physical goods, materials, general supplies)
- 4100: Personnel costs (freelancers, contractors, HR services)
- 4200: Housing costs (rent, utilities, building maintenance)
- 4300: Transport costs (fuel, car lease, logistics, travel)
- 4400: Office costs (stationery, printing, office supplies)
- 4500: ICT / Software (hosting, SaaS subscriptions, software licenses, domains, cloud services)
- 4600: Marketing (advertising, design, PR, social media tools)
- 4700: Telecom (phone, internet, KPN, Vodafone, T-Mobile)

Default to 4000 if none of the above clearly applies.

## payment_status:
- "paid": invoice clearly marked as paid, receipt, or zero balance due
- "unpaid": open request for payment
- "unknown": cannot be determined

Dates must be ISO YYYY-MM-DD. Countries must be ISO 2-letter codes.
`.trim();

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function extractInvoiceFromEmail(
  email: ParsedEmail,
): Promise<GeminiExtractionResult> {
  const emailContext = [
    `Subject: ${email.subject}`,
    `From: ${email.from}`,
    `Received: ${email.receivedAt.toISOString()}`,
    ``,
    `--- Email Body (HTML) ---`,
    email.bodyHtml || email.bodyText || "(empty body)",
  ].join("\n");

  const content: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: Buffer; mediaType: string }
  > = [{ type: "text", text: emailContext }];

  for (const att of email.attachments) {
    console.log(`[processor] Attaching PDF: ${att.filename}`);
    content.push({
      type: "file",
      data: Buffer.from(att.contentBase64, "base64"),
      mediaType: "application/pdf",
    });
  }

  const result = await generateObject({
    model: google(env.GEMINI_MODEL),
    schema: ExtractionEnvelopeSchema,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
    temperature: 0.1,
    // AI SDK handles retries with exponential backoff on transient errors.
    maxRetries: 2,
    // LangWatch picks this up via OpenTelemetry (see src/instrumentation.ts).
    experimental_telemetry: {
      isEnabled: true,
      functionId: "gemini-invoice-extraction",
      metadata: {
        subject: email.subject,
        from: email.from,
        attachments: email.attachments.length,
      },
    },
  });

  if (!result.object.is_invoice || result.object.invoice === null) {
    return null;
  }
  return { invoice: result.object.invoice };
}
