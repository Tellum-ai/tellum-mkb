import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { z } from "zod";

import { env } from "~/env.js";
import type { GeminiExtractionResult, ParsedEmail } from "./types.js";

// ---------------------------------------------------------------------------
// Zod schemas for runtime validation of Gemini's JSON response
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
  due_date: z.string().nullable().optional(),
  sender: z.object({
    company: z.string(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    postal_code: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    kvk: z.string().nullable().optional(),
    btw: z.string().nullable().optional(),
    iban: z.string().nullable().optional(),
  }),
  client: z.object({
    company: z.string(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    postal_code: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
  }),
  line_items: z.array(LineItemSchema),
  totals: z.object({
    subtotal_excl_vat: z.number(),
    vat_amount: z.number(),
    total_incl_vat: z.number(),
  }),
  payment_reference: z.string().nullable().optional(),
  payment_status: z.enum(["paid", "unpaid", "unknown"]),
});

const GeminiResponseSchema = z.union([
  z.object({ invoice: InvoiceSchema }),
  z.null(),
]);

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `
You are a financial document extraction assistant.

Analyze the provided email content (HTML body and any attached PDFs).

If the email contains an invoice (a request for payment for goods or services), extract ALL available invoice data and return it as a JSON object matching this exact structure:

{
  "invoice": {
    "invoice_number": "string",
    "invoice_date": "YYYY-MM-DD",
    "due_date": "YYYY-MM-DD or null",
    "sender": {
      "company": "string",
      "address": "string or null",
      "city": "string or null",
      "postal_code": "string or null",
      "country": "ISO 2-letter code or null",
      "kvk": "string or null",
      "btw": "string or null",
      "iban": "string or null"
    },
    "client": {
      "company": "string",
      "address": "string or null",
      "city": "string or null",
      "postal_code": "string or null",
      "country": "ISO 2-letter code or null"
    },
    "line_items": [
      {
        "description": "string",
        "quantity": number,
        "unit_price": number (excl. VAT),
        "vat_rate": number (e.g. 0.21 for 21%),
        "subtotal": number (excl. VAT)
      }
    ],
    "totals": {
      "subtotal_excl_vat": number,
      "vat_amount": number,
      "total_incl_vat": number
    },
    "payment_reference": "string or null",
    "payment_status": "paid" | "unpaid" | "unknown"
  }
}

For "payment_status":
- Return "paid" if the PDF or email clearly indicates the invoice has already been paid (e.g. "Betaald", "Paid", "Voldaan", a payment receipt, or a zero balance due).
- Return "unpaid" if the invoice is clearly an open request for payment.
- Return "unknown" if it cannot be determined from the document.

If the email does NOT contain an invoice (newsletter, notification, general correspondence, etc.), return exactly:
null

Return ONLY valid JSON. Do not include markdown code fences, explanations, or any other text.
`.trim();

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function extractInvoiceFromEmail(
  email: ParsedEmail
): Promise<GeminiExtractionResult> {
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL });

  const parts: Part[] = [];

  const emailContext = [
    `Subject: ${email.subject}`,
    `From: ${email.from}`,
    `Received: ${email.receivedAt.toISOString()}`,
    ``,
    `--- Email Body (HTML) ---`,
    email.bodyHtml || email.bodyText || "(empty body)",
  ].join("\n");

  parts.push({ text: emailContext });

  for (const att of email.attachments) {
    console.log(`[processor] Attaching PDF: ${att.filename}`);
    parts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: att.contentBase64,
      },
    });
  }

  parts.push({ text: `\n\n---\n\n${SYSTEM_PROMPT}` });

  const response = await model.generateContent({
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const rawText = response.response.text().trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    console.warn(
      `[processor] Gemini returned non-JSON for message ${email.gmailMessageId}. Raw: ${rawText.slice(0, 200)}`
    );
    return null;
  }

  const validated = GeminiResponseSchema.safeParse(parsed);
  if (!validated.success) {
    console.warn(
      `[processor] Gemini JSON did not match schema for message ${email.gmailMessageId}:`,
      validated.error.flatten()
    );
    return null;
  }

  return validated.data;
}
