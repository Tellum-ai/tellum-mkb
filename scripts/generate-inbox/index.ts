#!/usr/bin/env bun
/**
 * Usage:
 *   bun scripts/generate-inbox/index.ts           — generate Phase 1 batch to ./output/
 *   bun scripts/generate-inbox/index.ts --fixture  — also copy to ./fixtures/
 */

import { writeFile, mkdir, copyFile } from "fs/promises"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import type { InvoiceScenario, Annotation } from "./types.js"
import { KPN, TRANSIP, ENECO } from "./suppliers/dutch.js"
import { VERCEL, GITHUB } from "./suppliers/saas.js"
import { generateInvoicePdf, calcAnnotationTotals } from "./generators/invoice-pdf.js"
import { buildInvoiceEml, buildNoiseEml } from "./generators/email-builder.js"
import { NOISE_SCENARIOS } from "./generators/noise-email.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, "output")
const FIXTURES_DIR = join(__dirname, "fixtures")

// ─── PHASE 1 SCENARIOS ──────────────────────────────────────────────────────

const INVOICE_SCENARIOS: InvoiceScenario[] = [
  {
    id: "001-kpn-april",
    supplier: KPN,
    invoiceNumber: "KPN-2026-04-001234",
    invoiceDate: "2026-04-01",
    dueDate: "2026-04-15",
    emailDate: "2026-04-02T09:15:00+02:00",
    currency: "EUR",
    language: "nl",
    dateStyle: "dutch-text",
    pdfFilename: "Factuur_KPN_april_2026.pdf",
    emailSubject: "Uw KPN factuur - april 2026",
    emailBody: `Beste klant,

Bijgevoegd ontvangt u uw KPN factuur voor april 2026.

Factuurnummer:  KPN-2026-04-001234
Factuurdatum:   1 april 2026
Vervaldatum:    15 april 2026
Totaalbedrag:   €54,45 incl. BTW

Wij verzoeken u het factuurbedrag vóór 15 april 2026 over te maken op
IBAN NL91 ABNA 0417 1643 00 t.n.v. KPN B.V., onder vermelding van het
factuurnummer.

Met vriendelijke groet,
KPN Klantenservice

---
KPN B.V. · Wilhelminakade 123 · 3072 AP Rotterdam
KvK: 27124701 · BTW: NL004073488B01`,
    lines: [
      {
        description: "Zakelijk mobiel abonnement - april 2026\nOnbeperkt bellen & 50GB data",
        quantity: 1,
        unitPriceExclVat: 4500,
        vatRate: 21,
        vatType: "standard",
      },
    ],
  },
  {
    id: "002-transip-maart",
    supplier: TRANSIP,
    invoiceNumber: "F2026030892",
    invoiceDate: "2026-03-15",
    dueDate: "2026-03-29",
    emailDate: "2026-03-15T14:30:00+01:00",
    currency: "EUR",
    language: "nl",
    dateStyle: "dutch-numeric",
    pdfFilename: "Factuur_F2026030892_TransIP.pdf",
    emailSubject: "Factuur F2026030892 van TransIP B.V.",
    emailBody: `Geachte relatie,

Hierbij ontvangt u factuur F2026030892 van TransIP B.V.

Factuurnummer:  F2026030892
Factuurdatum:   15-03-2026
Vervaldatum:    29-03-2026
Totaalbedrag:   €45,98 incl. 21% BTW

Gelieve het bedrag van €45,98 vóór 29-03-2026 over te schrijven naar:
IBAN NL65 RABO 0193 9400 61 t.n.v. TransIP B.V.
Onder vermelding van: F2026030892

Bij vragen kunt u contact opnemen via support@transip.nl of 071 752 17 00.

Met vriendelijke groet,
TransIP B.V.`,
    lines: [
      {
        description: "VPS XL — maand maart 2026",
        quantity: 1,
        unitPriceExclVat: 2999,
        vatRate: 21,
        vatType: "standard",
      },
      {
        description: "Domeinnaam devries-consultancy.nl — jaarlijkse verlenging",
        quantity: 1,
        unitPriceExclVat: 999,
        vatRate: 21,
        vatType: "standard",
      },
    ],
  },
  {
    id: "003-vercel-april",
    supplier: VERCEL,
    invoiceNumber: "INV-2026-04-0044129",
    invoiceDate: "2026-04-01",
    dueDate: "2026-04-01",
    emailDate: "2026-04-01T17:00:00+00:00",
    currency: "USD",
    language: "en",
    dateStyle: "us-text",
    pdfFilename: "Vercel_Invoice_INV-2026-04-0044129.pdf",
    emailSubject: "Your Vercel invoice for April 2026",
    emailBody: `Hi there,

Your invoice for April 2026 is attached.

Invoice number:  INV-2026-04-0044129
Invoice date:    April 1, 2026
Amount due:      $20.00

This invoice has been automatically charged to your payment method on file.
No action is required.

As a business customer in the EU, VAT has been reverse charged to you.
Your VAT number on file: NL856234789B01

Questions? Visit vercel.com/help or email billing@vercel.com.

Thanks for using Vercel,
The Vercel Team

---
Vercel Inc. · 340 Pine Street, Suite 1200 · San Francisco, CA 94104`,
    lines: [
      {
        description: "Pro Plan — April 2026",
        quantity: 1,
        unitPriceExclVat: 2000,
        vatRate: 21,
        vatType: "verlegd",
      },
    ],
  },
  {
    id: "004-github-maart",
    supplier: GITHUB,
    invoiceNumber: "GH-20260301-77821",
    invoiceDate: "2026-03-01",
    dueDate: "2026-03-01",
    emailDate: "2026-03-01T16:45:00+00:00",
    currency: "USD",
    language: "en",
    dateStyle: "us-slash",
    pdfFilename: "GitHub_Invoice_GH-20260301-77821.pdf",
    emailSubject: "GitHub Invoice GH-20260301-77821",
    emailBody: `Hi,

Please find your GitHub invoice attached.

Invoice:   GH-20260301-77821
Date:      03/01/2026
Total:     $44.00

This charge has been applied to your payment method on file.

VAT reverse charged to customer.
Your VAT registration number: NL856234789B01

For questions about your invoice, visit github.com/settings/billing
or contact billing@github.com.

— GitHub Billing Team`,
    lines: [
      {
        description: "GitHub Team — 4 seats × $4.00/user/month\nMarch 2026",
        quantity: 4,
        unitPriceExclVat: 1100,
        vatRate: 21,
        vatType: "verlegd",
      },
    ],
  },
  {
    id: "005-eneco-februari",
    supplier: ENECO,
    invoiceNumber: "EN-2026-02-4489123",
    invoiceDate: "2026-02-28",
    dueDate: "2026-03-14",
    emailDate: "2026-03-01T08:00:00+01:00",
    currency: "EUR",
    language: "nl",
    dateStyle: "dutch-text",
    pdfFilename: "Eneco_Factuur_EN-2026-02-4489123.pdf",
    emailSubject: "Uw Eneco energiefactuur - februari 2026",
    emailBody: `Geachte klant,

Bijgaand uw Eneco energiefactuur voor de periode februari 2026.

Factuurnummer:   EN-2026-02-4489123
Factuurdatum:    28 februari 2026
Vervaldatum:     14 maart 2026
Totaalbedrag:    €234,56 incl. BTW

Wij incasseren dit bedrag automatisch van uw rekening.

Verbruik deze periode:
- Elektriciteit:  312 kWh
- Gas:            187 m³

Mijn Eneco: mijnenergie.eneco.nl
Klantenservice: 088 835 00 00 (ma-vr 8:00-20:00, za 9:00-17:00)

Met vriendelijke groet,
Eneco Energie Retail B.V.`,
    lines: [
      {
        description: "Elektriciteit — 312 kWh à €0,37",
        quantity: 1,
        unitPriceExclVat: 11544,
        vatRate: 21,
        vatType: "standard",
      },
      {
        description: "Aardgas — 187 m³ à €1,18",
        quantity: 1,
        unitPriceExclVat: 22066,
        vatRate: 21,
        vatType: "standard",
      },
      {
        description: "Netbeheerskosten elektriciteit",
        quantity: 1,
        unitPriceExclVat: 2000,
        vatRate: 21,
        vatType: "standard",
      },
      {
        description: "Energiebelasting (EB)",
        quantity: 1,
        unitPriceExclVat: 2074,
        vatRate: 21,
        vatType: "standard",
      },
    ],
  },
]

// ─── HELPERS ────────────────────────────────────────────────────────────────

async function writeOutput(dir: string, filename: string, content: string | Uint8Array) {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, filename), content)
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const saveFixtures = args.includes("--fixture")

console.log("Generating Phase 1 inbox batch...\n")

// Generate invoice emails
for (const scenario of INVOICE_SCENARIOS) {
  process.stdout.write(`  [invoice] ${scenario.id} ... `)

  const pdfBytes = await generateInvoicePdf(scenario)
  const eml = buildInvoiceEml(scenario, pdfBytes)

  const emlFilename = `${scenario.id}.eml`
  const jsonFilename = `${scenario.id}.json`

  const totals = calcAnnotationTotals(scenario)
  const annotation: Annotation = {
    emailFile: emlFilename,
    wasInvoice: true,
    supplier:
      scenario.supplier.type === "dutch"
        ? (scenario.supplier as { legalName: string }).legalName
        : scenario.supplier.name,
    invoiceNumber: scenario.invoiceNumber,
    invoiceDate: scenario.invoiceDate,
    ...totals,
    currency: scenario.currency,
    language: scenario.language,
  }

  await writeOutput(OUTPUT_DIR, emlFilename, eml)
  await writeOutput(OUTPUT_DIR, jsonFilename, JSON.stringify(annotation, null, 2))

  if (saveFixtures) {
    await writeOutput(FIXTURES_DIR, emlFilename, eml)
    await writeOutput(FIXTURES_DIR, jsonFilename, JSON.stringify(annotation, null, 2))
  }

  console.log("done")
}

// Generate noise emails
for (const noise of NOISE_SCENARIOS) {
  process.stdout.write(`  [noise]   ${noise.id} ... `)

  const eml = buildNoiseEml(noise)
  const emlFilename = `${noise.id}.eml`
  const jsonFilename = `${noise.id}.json`

  const annotation: Annotation = {
    emailFile: emlFilename,
    wasInvoice: false,
  }

  await writeOutput(OUTPUT_DIR, emlFilename, eml)
  await writeOutput(OUTPUT_DIR, jsonFilename, JSON.stringify(annotation, null, 2))

  if (saveFixtures) {
    await writeOutput(FIXTURES_DIR, emlFilename, eml)
    await writeOutput(FIXTURES_DIR, jsonFilename, JSON.stringify(annotation, null, 2))
  }

  console.log("done")
}

console.log(`\n✓ ${INVOICE_SCENARIOS.length} invoices + ${NOISE_SCENARIOS.length} noise emails`)
console.log(`  Output: ${OUTPUT_DIR}`)
if (saveFixtures) console.log(`  Fixtures: ${FIXTURES_DIR}`)
