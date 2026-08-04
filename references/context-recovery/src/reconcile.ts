export type LedgerEntry = { account: string; expectedCents: number; actualCents: number };
export type Reconciliation = LedgerEntry;

export function reconcile(entries: LedgerEntry[]): Reconciliation[] {
  const totals = new Map<string, Reconciliation>();
  for (const entry of entries) {
    const current = totals.get(entry.account) ?? { account: entry.account, expectedCents: 0, actualCents: 0 };
    totals.set(entry.account, {
      account: entry.account,
      expectedCents: current.expectedCents + entry.expectedCents,
      actualCents: current.actualCents + entry.actualCents,
    });
  }
  return [...totals.values()].sort((left, right) => left.account.localeCompare(right.account));
}
