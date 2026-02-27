export interface ParsedAttachment {
  filename: string;
  contentType: string;
  contentBase64: string;
  /** Set after a successful R2 upload — undefined if the upload was skipped or failed */
  r2Url?: string;
}

export interface ParsedEmail {
  /** RFC 2822 Message-ID header — globally unique and stable */
  gmailMessageId: string;
  /** IMAP UID — used only for the mark-as-read IMAP call */
  imapUid: number;
  subject: string;
  from: string;
  receivedAt: Date;
  bodyHtml: string;
  bodyText: string;
  attachments: ParsedAttachment[];
}

export interface InvoiceSender {
  company: string;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  kvk?: string | null;
  btw?: string | null;
  iban?: string | null;
}

export interface InvoiceClient {
  company: string;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  subtotal: number;
}

export interface InvoiceTotals {
  subtotal_excl_vat: number;
  vat_amount: number;
  total_incl_vat: number;
}

export interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  due_date?: string | null;
  sender: InvoiceSender;
  client: InvoiceClient;
  line_items: LineItem[];
  totals: InvoiceTotals;
  payment_reference?: string | null;
}

export type GeminiExtractionResult = { invoice: InvoiceData } | null;
