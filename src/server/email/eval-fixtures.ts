import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface FixtureAnnotation {
  emailFile: string;
  /** RFC 2822 Message-ID (no angle brackets) — written by the generator. */
  messageId: string;
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
 * Index ground-truth annotations by Message-ID so that during an inbox scan
 * we can pair each processed email with its expected output. The generator
 * writes `messageId` directly into each .json — no need to reparse the .eml.
 * Result is cached for the process lifetime.
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
    console.warn(
      `[eval-fixtures] Could not read ${FIXTURES_DIR}. Evals disabled.`,
    );
    cache = map;
    return map;
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  for (const jsonFile of jsonFiles) {
    const annotation = JSON.parse(
      await readFile(join(FIXTURES_DIR, jsonFile), "utf-8"),
    ) as FixtureAnnotation;

    if (!annotation.messageId) {
      console.warn(
        `[eval-fixtures] ${jsonFile} has no messageId — regenerate fixtures.`,
      );
      continue;
    }

    map.set(annotation.messageId, annotation);
  }

  console.log(
    `[eval-fixtures] Loaded ${map.size} fixture annotations (indexed by Message-ID).`,
  );
  cache = map;
  return map;
}
