import { env } from "~/env.js";
import type { InvoiceData } from "./email/types";

const BASE_URL = "https://moneybird.com/api/v2";

interface MoneybirdDetailAttribute {
  description: string;
  price: number;
}

interface MoneybirdExternalSalesInvoicePayload {
  external_sales_invoice: {
    contact_id: string;
    reference?: string;
    date?: string;
    due_date?: string;
    currency?: string;
    details_attributes: MoneybirdDetailAttribute[];
  };
}

interface MoneybirdExternalSalesInvoiceResponse {
  id: string;
  reference: string | null;
  date: string | null;
  due_date: string | null;
  [key: string]: unknown;
}

/**
 * Maps an extracted InvoiceData to a Moneybird external sales invoice and
 * creates it via the Moneybird REST API.
 *
 * Returns the Moneybird invoice ID on success.
 * Throws an error if the API call fails.
 */
export async function createMoneybirdExternalSalesInvoice(
  invoice: InvoiceData,
): Promise<string> {
  const details: MoneybirdDetailAttribute[] = invoice.line_items.map(
    (item) => ({
      description: item.description,
      price: item.unit_price,
    }),
  );

  // Fall back to a single line item using the total when no line items were
  // extracted by Gemini (some invoices only have a grand total).
  if (details.length === 0) {
    details.push({
      description: `Invoice ${invoice.invoice_number ?? ""} from ${invoice.sender.company}`,
      price: invoice.totals.total_incl_vat,
    });
  }

  const payload: MoneybirdExternalSalesInvoicePayload = {
    external_sales_invoice: {
      contact_id: env.MONEYBIRD_DEFAULT_CONTACT_ID,
      reference: invoice.invoice_number ?? undefined,
      date: invoice.invoice_date ?? undefined,
      due_date: invoice.due_date ?? undefined,
      currency: "EUR",
      details_attributes: details,
    },
  };

  const administrationId = env.MONEYBIRD_ADMINISTRATION_ID.trim();
  const url = `${BASE_URL}/${administrationId}/external_sales_invoices.json`;

  console.log(
    `[moneybird] POST ${url} | administrationId="${administrationId}" (${administrationId.length} chars) | ref=${invoice.invoice_number ?? "n/a"} contact=${env.MONEYBIRD_DEFAULT_CONTACT_ID} lines=${details.length}`,
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.MONEYBIRD_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(
      `[moneybird] API error ${response.status} for ref=${invoice.invoice_number ?? "n/a"} | url=${url} | body=${body}`,
    );
    throw new Error(`Moneybird API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as MoneybirdExternalSalesInvoiceResponse;

  if (!data.id) {
    throw new Error("Moneybird response did not include an invoice ID");
  }

  console.log(
    `[moneybird] Created external sales invoice id=${data.id} ref=${data.reference ?? "n/a"}`,
  );

  return data.id;
}
