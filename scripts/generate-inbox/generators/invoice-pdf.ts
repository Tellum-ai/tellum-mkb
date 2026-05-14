import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import type { InvoiceScenario, DutchSupplier, SaasSupplier, DateStyle } from "../types.js"
import { CUSTOMER } from "../types.js"

const W = 595
const H = 842
const ML = 50
const MR = 50
const CW = W - ML - MR

const DARK = rgb(0.1, 0.1, 0.1)
const GRAY = rgb(0.45, 0.45, 0.45)
const LIGHT_BG = rgb(0.94, 0.94, 0.94)
const ACCENT = rgb(0.15, 0.35, 0.65)

const DUTCH_MONTHS = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
]

const US_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

function formatDate(iso: string, style: DateStyle): string {
  const [year, month, day] = iso.split("-").map(Number)
  const m = month! - 1
  switch (style) {
    case "dutch-text":
      return `${day} ${DUTCH_MONTHS[m]} ${year}`
    case "dutch-numeric":
      return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`
    case "dutch-slash":
      return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`
    case "us-text":
      return `${US_MONTHS[m]} ${day}, ${year}`
    case "us-slash":
      return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`
    case "iso":
      return iso
  }
}

function formatEur(cents: number): string {
  const euros = cents / 100
  const [intPart, decPart] = euros.toFixed(2).split(".")
  const thousands = intPart!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `€${thousands},${decPart}`
}

function formatUsd(cents: number): string {
  const dollars = cents / 100
  const [intPart, decPart] = dollars.toFixed(2).split(".")
  const thousands = intPart!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `$${thousands}.${decPart}`
}

interface Totals {
  exclVat: number
  vatByRate: Map<number, number>
  inclVat: number
}

function calcTotals(scenario: InvoiceScenario): Totals {
  const vatByRate = new Map<number, number>()
  let exclVat = 0

  for (const line of scenario.lines) {
    const lineTotal = line.quantity * line.unitPriceExclVat
    exclVat += lineTotal
    if (line.vatType === "standard") {
      const existing = vatByRate.get(line.vatRate) ?? 0
      vatByRate.set(line.vatRate, existing + Math.round((lineTotal * line.vatRate) / 100))
    }
  }

  let inclVat = exclVat
  for (const v of vatByRate.values()) inclVat += v

  return { exclVat, vatByRate, inclVat }
}

function drawLine(page: PDFPage, x1: number, y: number, x2: number, color = GRAY) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color })
}

function rightAlign(
  page: PDFPage,
  text: string,
  rightEdge: number,
  y: number,
  font: PDFFont,
  size: number,
  color = DARK,
) {
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: rightEdge - w, y, font, size, color })
}

export async function generateDutchInvoicePdf(scenario: InvoiceScenario): Promise<Uint8Array> {
  const sup = scenario.supplier as DutchSupplier
  const fmt = (c: number) => formatEur(c)
  const totals = calcTotals(scenario)

  const doc = await PDFDocument.create()
  const page = doc.addPage([W, H])
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const t = (
    text: string,
    x: number,
    y: number,
    font: PDFFont,
    size: number,
    color = DARK,
  ) => page.drawText(text, { x, y, font, size, color })

  // ─── HEADER ──────────────────────────────────────────────────────────────

  // Company name top-left
  t(sup.legalName, ML, H - 50, bold, 15, ACCENT)
  t(sup.address, ML, H - 65, regular, 9, GRAY)
  t(`${sup.postalCode}  ${sup.city}`, ML, H - 76, regular, 9, GRAY)
  t(`KvK: ${sup.kvk}  |  BTW: ${sup.btwNumber}`, ML, H - 87, regular, 8, GRAY)

  // FACTUUR label top-right
  rightAlign(page, "FACTUUR", W - MR, H - 50, bold, 22, DARK)

  // Invoice metadata box (top-right, below FACTUUR)
  const BOX_X = W - MR - 195
  const BOX_TOP = H - 68
  const BOX_H = 58
  page.drawRectangle({ x: BOX_X, y: BOX_TOP - BOX_H, width: 195, height: BOX_H, color: LIGHT_BG })

  const row = (label: string, value: string, yOffset: number) => {
    t(label, BOX_X + 6, BOX_TOP - yOffset, regular, 8, GRAY)
    rightAlign(page, value, BOX_X + 189, BOX_TOP - yOffset, bold, 8, DARK)
  }
  row("Factuurnummer:", scenario.invoiceNumber, 14)
  row("Factuurdatum:", formatDate(scenario.invoiceDate, scenario.dateStyle), 28)
  row("Vervaldatum:", formatDate(scenario.dueDate, scenario.dateStyle), 42)

  // ─── DIVIDER ────────────────────────────────────────────────────────────
  const dividerY = H - 105
  drawLine(page, ML, dividerY, W - MR, ACCENT)

  // ─── BILL TO ─────────────────────────────────────────────────────────────
  t("Factuuradres", ML, dividerY - 18, bold, 9, ACCENT)
  t(CUSTOMER.name, ML, dividerY - 32, bold, 10)
  t(CUSTOMER.address, ML, dividerY - 44, regular, 9)
  t(`${CUSTOMER.postalCode}  ${CUSTOMER.city}`, ML, dividerY - 55, regular, 9)
  t(CUSTOMER.country, ML, dividerY - 66, regular, 9)
  t(`BTW: ${CUSTOMER.btwNumber}`, ML, dividerY - 77, regular, 8, GRAY)

  // ─── LINE ITEMS TABLE ────────────────────────────────────────────────────
  const tableTop = dividerY - 105
  const COL_DESC = ML
  const COL_QTY = ML + 290
  const COL_PRICE = ML + 340
  const COL_VAT = ML + 400
  const COL_TOTAL = W - MR

  // Header row background
  page.drawRectangle({ x: ML, y: tableTop - 16, width: CW, height: 18, color: ACCENT })

  const headerColor = rgb(1, 1, 1)
  t("Omschrijving", COL_DESC + 4, tableTop - 11, bold, 8, headerColor)
  t("Aantal", COL_QTY, tableTop - 11, bold, 8, headerColor)
  t("Prijs", COL_PRICE, tableTop - 11, bold, 8, headerColor)
  t("BTW", COL_VAT, tableTop - 11, bold, 8, headerColor)
  rightAlign(page, "Bedrag", COL_TOTAL, tableTop - 11, bold, 8, headerColor)

  let rowY = tableTop - 30
  for (const line of scenario.lines) {
    const lineTotal = line.quantity * line.unitPriceExclVat
    const vatLabel =
      line.vatType === "verlegd"
        ? "verlegd"
        : line.vatType === "vrijgesteld"
          ? "vrijg."
          : `${line.vatRate}%`

    t(line.description, COL_DESC + 4, rowY, regular, 9)
    t(String(line.quantity), COL_QTY, rowY, regular, 9)
    rightAlign(page, fmt(line.unitPriceExclVat), COL_PRICE + 55, rowY, regular, 9)
    t(vatLabel, COL_VAT, rowY, regular, 9)
    rightAlign(page, fmt(lineTotal), COL_TOTAL, rowY, regular, 9)

    rowY -= 16
    drawLine(page, ML, rowY + 4, W - MR, LIGHT_BG)
    rowY -= 4
  }

  // ─── TOTALS BOX ──────────────────────────────────────────────────────────
  const totalsX = W - MR - 200
  const totalsTop = rowY - 10

  drawLine(page, totalsX, totalsTop, W - MR)

  const totRow = (label: string, value: string, yOff: number, isBold = false) => {
    const f = isBold ? bold : regular
    t(label, totalsX, totalsTop - yOff, f, 9)
    rightAlign(page, value, W - MR, totalsTop - yOff, f, 9)
  }

  let tOff = 14
  totRow("Subtotaal excl. BTW", fmt(totals.exclVat), tOff)

  for (const [rate, vatAmt] of totals.vatByRate) {
    tOff += 14
    totRow(`BTW ${rate}%`, fmt(vatAmt), tOff)
  }

  if (totals.vatByRate.size === 0) {
    tOff += 14
    totRow("BTW (verlegd)", fmt(0), tOff, false)
  }

  tOff += 4
  drawLine(page, totalsX, totalsTop - tOff, W - MR, ACCENT)
  tOff += 14
  page.drawRectangle({ x: totalsX, y: totalsTop - tOff - 2, width: 200, height: 16, color: LIGHT_BG })
  totRow("Totaal incl. BTW", fmt(totals.inclVat), tOff, true)

  // BTW verlegd notice
  if (scenario.lines.some((l) => l.vatType === "verlegd")) {
    tOff += 20
    t(
      "BTW verlegd — BTW verlegd naar afnemer (art. 12 lid 3 OB 1968)",
      totalsX - 100,
      totalsTop - tOff,
      regular,
      7,
      GRAY,
    )
  }

  // ─── PAYMENT DETAILS ─────────────────────────────────────────────────────
  const payY = 95
  drawLine(page, ML, payY + 32, W - MR, LIGHT_BG)
  t("Betaalgegevens", ML, payY + 20, bold, 9, ACCENT)
  t(`IBAN: ${sup.iban}`, ML, payY + 8, regular, 9)
  t(`T.n.v.: ${sup.legalName}`, ML, payY - 3, regular, 9)
  t(`Onder vermelding van factuurnummer: ${scenario.invoiceNumber}`, ML, payY - 14, regular, 9, GRAY)

  return doc.save()
}

export async function generateSaasInvoicePdf(scenario: InvoiceScenario): Promise<Uint8Array> {
  const sup = scenario.supplier as SaasSupplier
  const fmt = (c: number) => formatUsd(c)
  const totals = calcTotals(scenario)

  const doc = await PDFDocument.create()
  const page = doc.addPage([W, H])
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const t = (
    text: string,
    x: number,
    y: number,
    font: PDFFont,
    size: number,
    color = DARK,
  ) => page.drawText(text, { x, y, font, size, color })

  // ─── HEADER ──────────────────────────────────────────────────────────────
  t(sup.name, ML, H - 50, bold, 20, DARK)
  t(`${sup.address}`, ML, H - 65, regular, 9, GRAY)
  t(`${sup.city}, ${sup.state} ${sup.zip}`, ML, H - 76, regular, 9, GRAY)
  t(sup.country, ML, H - 87, regular, 9, GRAY)

  rightAlign(page, "Invoice", W - MR, H - 50, bold, 20, GRAY)

  // Invoice meta (right side)
  const metaX = W - MR - 180
  const metaTop = H - 68
  t("Invoice Number:", metaX, metaTop, regular, 9, GRAY)
  rightAlign(page, scenario.invoiceNumber, W - MR, metaTop, bold, 9)
  t("Invoice Date:", metaX, metaTop - 14, regular, 9, GRAY)
  rightAlign(page, formatDate(scenario.invoiceDate, scenario.dateStyle), W - MR, metaTop - 14, regular, 9)
  t("Due Date:", metaX, metaTop - 28, regular, 9, GRAY)
  rightAlign(page, formatDate(scenario.dueDate, scenario.dateStyle), W - MR, metaTop - 28, regular, 9)

  // ─── DIVIDER ────────────────────────────────────────────────────────────
  const dividerY = H - 110
  drawLine(page, ML, dividerY, W - MR, DARK)

  // ─── BILL TO ────────────────────────────────────────────────────────────
  t("Bill To", ML, dividerY - 18, bold, 10, DARK)
  t(CUSTOMER.name, ML, dividerY - 32, regular, 9)
  t(CUSTOMER.address, ML, dividerY - 43, regular, 9)
  t(`${CUSTOMER.postalCode} ${CUSTOMER.city}`, ML, dividerY - 54, regular, 9)
  t(CUSTOMER.country, ML, dividerY - 65, regular, 9)
  t(`VAT Number: ${CUSTOMER.btwNumber}`, ML, dividerY - 76, regular, 9, GRAY)

  // ─── LINE ITEMS TABLE ────────────────────────────────────────────────────
  const tableTop = dividerY - 104
  const COL_DESC = ML
  const COL_TOTAL = W - MR

  page.drawRectangle({ x: ML, y: tableTop - 16, width: CW, height: 18, color: DARK })
  t("Description", COL_DESC + 4, tableTop - 11, bold, 8, rgb(1, 1, 1))
  rightAlign(page, "Amount", COL_TOTAL, tableTop - 11, bold, 8, rgb(1, 1, 1))

  let rowY = tableTop - 30
  for (const line of scenario.lines) {
    const lineTotal = line.quantity * line.unitPriceExclVat
    t(line.description, COL_DESC + 4, rowY, regular, 9)
    rightAlign(page, fmt(lineTotal), COL_TOTAL, rowY, regular, 9)
    rowY -= 16
    drawLine(page, ML, rowY + 4, W - MR, LIGHT_BG)
    rowY -= 4
  }

  // ─── TOTALS ──────────────────────────────────────────────────────────────
  const totalsX = W - MR - 200
  const totalsTop = rowY - 10

  drawLine(page, totalsX, totalsTop, W - MR, GRAY)

  const totRow = (label: string, value: string, yOff: number, isBold = false) => {
    const f = isBold ? bold : regular
    t(label, totalsX, totalsTop - yOff, f, 9, isBold ? DARK : GRAY)
    rightAlign(page, value, W - MR, totalsTop - yOff, f, 9)
  }

  totRow("Subtotal", fmt(totals.exclVat), 14)
  totRow("Tax (0% - Reverse Charge)", fmt(0), 28)

  drawLine(page, totalsX, totalsTop - 36, W - MR, DARK)
  page.drawRectangle({ x: totalsX, y: totalsTop - 52, width: 200, height: 16, color: LIGHT_BG })
  totRow("Total", fmt(totals.inclVat), 50, true)

  // VAT notice
  t(
    "VAT/BTW has been reverse charged to the customer.",
    ML,
    totalsTop - 70,
    regular,
    8,
    GRAY,
  )
  t(
    `Customer VAT number: ${CUSTOMER.btwNumber}`,
    ML,
    totalsTop - 82,
    regular,
    8,
    GRAY,
  )

  // ─── FOOTER ──────────────────────────────────────────────────────────────
  drawLine(page, ML, 60, W - MR, LIGHT_BG)
  t(`${sup.name} · ${sup.city}, ${sup.state} · ${sup.country}`, ML, 45, regular, 8, GRAY)
  rightAlign(page, `billing@${sup.domain}`, W - MR, 45, regular, 8, GRAY)

  return doc.save()
}

export async function generateInvoicePdf(scenario: InvoiceScenario): Promise<Uint8Array> {
  if (scenario.supplier.type === "dutch") {
    return generateDutchInvoicePdf(scenario)
  }
  return generateSaasInvoicePdf(scenario)
}

export function calcAnnotationTotals(scenario: InvoiceScenario): {
  totalInclVat: string
  totalExclVat: string
  vatAmount: string
  vatRate: number
  vatType: string
} {
  const totals = calcTotals(scenario)
  const totalVat = totals.inclVat - totals.exclVat
  const rates = [...totals.vatByRate.keys()]
  const dominantRate = rates.length === 1 ? (rates[0] ?? 0) : rates.length > 1 ? -1 : 0
  const hasVerlegd = scenario.lines.some((l) => l.vatType === "verlegd")
  const fmt = (c: number) => (c / 100).toFixed(2)

  return {
    totalInclVat: fmt(totals.inclVat),
    totalExclVat: fmt(totals.exclVat),
    vatAmount: fmt(totalVat),
    vatRate: dominantRate,
    vatType: hasVerlegd ? "verlegd" : rates.length > 1 ? "mixed" : "standard",
  }
}
