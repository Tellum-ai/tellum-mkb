export interface JournalLine {
  debit: number | null;
  credit: number | null;
}

export function isBalanced(lines: JournalLine[]): boolean {
  const totalDebit = lines.reduce((sum, l) => sum + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit ?? 0), 0);
  return totalDebit === totalCredit;
}
