import type { InvoiceScenario, NoiseScenario } from "../types.js"

function base64Encode(bytes: Uint8Array): string {
  const binary = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("")
  const b64 = btoa(binary)
  // Wrap at 76 chars per RFC 2045
  return b64.replace(/(.{76})/g, "$1\r\n").trim()
}

function formatRfc2822Date(isoDatetime: string): string {
  const d = new Date(isoDatetime)
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const day = days[d.getUTCDay()]
  const date = String(d.getUTCDate()).padStart(2, "0")
  const month = months[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  const hh = String(d.getUTCHours()).padStart(2, "0")
  const mm = String(d.getUTCMinutes()).padStart(2, "0")
  const ss = String(d.getUTCSeconds()).padStart(2, "0")
  return `${day}, ${date} ${month} ${year} ${hh}:${mm}:${ss} +0000`
}

function generateMessageId(domain: string): string {
  const rand = Math.random().toString(36).substring(2, 12)
  const ts = Date.now().toString(36)
  return `<${ts}.${rand}@${domain}>`
}

export function buildInvoiceEml(scenario: InvoiceScenario, pdfBytes: Uint8Array): string {
  const boundary = `----=_Part_${Math.random().toString(36).substring(2, 10)}`
  const sup = scenario.supplier
  const fromName = sup.type === "dutch" ? (sup as { legalName: string }).legalName : sup.name
  const messageId = generateMessageId(sup.domain)
  const pdfB64 = base64Encode(pdfBytes)

  return [
    `MIME-Version: 1.0`,
    `Date: ${formatRfc2822Date(scenario.emailDate)}`,
    `From: "${fromName}" <${sup.email}>`,
    `To: "Tellum Finance" <tellumfinance@gmail.com>`,
    `Subject: ${scenario.emailSubject}`,
    `Message-ID: ${messageId}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    scenario.emailBody,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${scenario.pdfFilename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${scenario.pdfFilename}"`,
    ``,
    pdfB64,
    ``,
    `--${boundary}--`,
  ].join("\r\n")
}

export function buildNoiseEml(noise: NoiseScenario): string {
  const messageId = generateMessageId(noise.from.split("@")[1] ?? "example.com")

  return [
    `MIME-Version: 1.0`,
    `Date: ${formatRfc2822Date(noise.date)}`,
    `From: "${noise.fromName}" <${noise.from}>`,
    `To: "Tellum Finance" <tellumfinance@gmail.com>`,
    `Subject: ${noise.subject}`,
    `Message-ID: ${messageId}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    noise.body,
  ].join("\r\n")
}
