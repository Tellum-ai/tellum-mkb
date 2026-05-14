#!/usr/bin/env bun
/**
 * Appends .eml files from a directory into a Gmail IMAP inbox.
 *
 * Usage:
 *   GMAIL_USER=tellumfinance@gmail.com \
 *   GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
 *   bun scripts/generate-inbox/append-to-inbox.ts [--dir ./scripts/generate-inbox/fixtures]
 *
 * Requires a Gmail App Password (not your regular password).
 * Enable at: myaccount.google.com/apppasswords
 */

import { readdir, readFile } from "fs/promises"
import { join } from "path"
import { ImapFlow } from "imapflow"

const args = process.argv.slice(2)
const dirIndex = args.indexOf("--dir")
const sourceDir =
  dirIndex !== -1 && args[dirIndex + 1]
    ? args[dirIndex + 1]!
    : join(import.meta.dirname, "fixtures")

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error("Error: GMAIL_USER and GMAIL_APP_PASSWORD environment variables are required.")
  console.error("Set a Gmail App Password at: myaccount.google.com/apppasswords")
  process.exit(1)
}

// Find all .eml files in the source directory
const files = (await readdir(sourceDir)).filter((f) => f.endsWith(".eml")).sort()

if (files.length === 0) {
  console.error(`No .eml files found in ${sourceDir}`)
  process.exit(1)
}

console.log(`Appending ${files.length} email(s) to ${GMAIL_USER} INBOX...\n`)

const client = new ImapFlow({
  host: "imap.gmail.com",
  port: 993,
  secure: true,
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
  logger: false,
})

await client.connect()

let success = 0
let failed = 0

for (const file of files) {
  process.stdout.write(`  ${file} ... `)
  try {
    const content = await readFile(join(sourceDir, file))

    // Extract the Date header from the .eml to preserve realistic timestamps
    const dateMatch = content.toString("utf8").match(/^Date:\s*(.+)$/m)
    const idate = dateMatch ? new Date(dateMatch[1]!) : new Date()

    // Append with no flags (unread), preserving the original email date
    await client.append("INBOX", content, [], idate)
    console.log("ok")
    success++
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`FAILED: ${msg}`)
    failed++
  }
}

await client.logout()

console.log(`\n✓ ${success} appended${failed > 0 ? `, ${failed} failed` : ""}`)
console.log(`  Check ${GMAIL_USER} inbox — emails will appear as unread.`)
