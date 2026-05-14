import { db } from "~/server/db";
import { ledgerAccounts } from "~/server/db/schema";

const DEFAULT_ACCOUNTS = [
  { number: 1000, name: "Bank", type: "activa" },
  { number: 1100, name: "Crediteuren", type: "passiva" },
  { number: 1200, name: "Debiteuren", type: "activa" },
  { number: 1500, name: "BTW te vorderen", type: "activa" },
  { number: 1510, name: "BTW te betalen", type: "passiva" },
  { number: 1800, name: "BTW verlegd / ICP", type: "passiva" },
  { number: 4000, name: "Inkoopkosten algemeen", type: "kosten" },
  { number: 4100, name: "Personeelskosten", type: "kosten" },
  { number: 4200, name: "Huisvestingskosten", type: "kosten" },
  { number: 4300, name: "Vervoerskosten", type: "kosten" },
  { number: 4400, name: "Kantoorkosten", type: "kosten" },
  { number: 4500, name: "ICT / Software", type: "kosten" },
  { number: 4600, name: "Marketing", type: "kosten" },
  { number: 4700, name: "Telefoon / Telecom", type: "kosten" },
  { number: 8000, name: "Omzet", type: "omzet" },
] as const;

export async function seedLedgerAccounts(userId: string) {
  await db.insert(ledgerAccounts).values(
    DEFAULT_ACCOUNTS.map((a) => ({ ...a, userId })),
  );
}
