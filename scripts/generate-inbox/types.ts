export interface DutchSupplier {
  type: "dutch"
  name: string
  legalName: string
  email: string
  domain: string
  address: string
  postalCode: string
  city: string
  kvk: string
  btwNumber: string
  iban: string
  invoicePrefix: string
}

export interface SaasSupplier {
  type: "saas"
  name: string
  email: string
  domain: string
  address: string
  city: string
  state: string
  zip: string
  country: string
}

export type Supplier = DutchSupplier | SaasSupplier

export interface InvoiceLine {
  description: string
  quantity: number
  unitPriceExclVat: number // integer cents (EUR) or dollar-cents (USD)
  vatRate: 0 | 9 | 21
  vatType: "standard" | "verlegd" | "vrijgesteld"
}

export type DateStyle =
  | "dutch-text" // "1 april 2026"
  | "dutch-numeric" // "01-04-2026"
  | "dutch-slash" // "01/04/2026"
  | "us-text" // "April 1, 2026"
  | "us-slash" // "04/01/2026"
  | "iso" // "2026-04-01"

export interface InvoiceScenario {
  id: string
  supplier: Supplier
  invoiceNumber: string
  invoiceDate: string // ISO: 2026-04-01
  dueDate: string // ISO
  emailDate: string // ISO datetime: 2026-04-01T09:15:00+02:00
  lines: InvoiceLine[]
  currency: "EUR" | "USD"
  language: "nl" | "en"
  dateStyle: DateStyle
  notes?: string
  pdfFilename: string
  emailSubject: string
  emailBody: string
}

export interface NoiseScenario {
  id: string
  from: string
  fromName: string
  subject: string
  date: string // ISO datetime
  body: string
}

export interface Annotation {
  emailFile: string
  /** RFC 2822 Message-ID embedded in the .eml (without angle brackets). The
   * eval pipeline pairs incoming Gmail messages with their ground truth using
   * this value, so it must match what the generator wrote into the .eml. */
  messageId: string
  wasInvoice: boolean
  supplier?: string
  invoiceNumber?: string
  invoiceDate?: string
  totalInclVat?: string
  totalExclVat?: string
  vatAmount?: string
  vatRate?: number
  vatType?: string
  currency?: string
  language?: string
}

// The company that owns the inbox
export const CUSTOMER = {
  name: "De Vries Consultancy B.V.",
  address: "Herengracht 100",
  postalCode: "1015 BS",
  city: "Amsterdam",
  country: "Nederland",
  btwNumber: "NL856234789B01",
  kvk: "72345678",
  email: "tellumfinance@gmail.com",
}
