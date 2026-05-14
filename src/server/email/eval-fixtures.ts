import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface FixtureAnnotation {
  emailFile: string;
  wasInvoice: boolean;
  supplier?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  totalInclVat?: string;
  totalExclVat?: string;
  vatAmount?: string;
  vatRate?: number;
  vatType?: string;
  currency?: string;
  language?: string;
}

const FIXTURES_DIR = join(process.cwd(), "scripts/generate-inbox/output");

let cache: Map<string, FixtureAnnotation> | null = null;

/**
 * Index ground-truth annotations by RFC 2822 Message-ID so that during an inbox
 * scan we can pair each processed email with its expected output. Result is
 * cached for the process lifetime — fixtures don't change between runs.
 */
export async function loadFixtureAnnotations(): Promise<
  Map<string, FixtureAnnotation>
> {
  if (cache) return cache;

  const map = new Map<string, FixtureAnnotation>();

  let files: string[];
  try {
    files = await readdir(FIXTURES_DIR);
  } catch {
    cache = map;
    return map;
  }

  const emlFiles = files.filter((f) => f.endsWith(".eml"));

  for (const eml of emlFiles) {
    const jsonName = eml.replace(/\.eml$/, ".json");
    if (!files.includes(jsonName)) continue;

    const emlContent = await readFile(join(FIXTURES_DIR, eml), "utf-8");
    const match = /^Message-ID:\s*<([^>]+)>/im.exec(emlContent);
    if (!match) continue;
    const messageId = match[1]!;

    const annotation = JSON.parse(
      await readFile(join(FIXTURES_DIR, jsonName), "utf-8"),
    ) as FixtureAnnotation;

    map.set(messageId, annotation);
  }

  cache = map;
  return map;
}
