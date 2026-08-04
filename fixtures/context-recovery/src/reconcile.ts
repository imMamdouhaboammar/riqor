export type LedgerEntry = { account: string; expectedCents: number; actualCents: number };
export type Reconciliation = LedgerEntry;

export function reconcile(_entries: LedgerEntry[]): Reconciliation[] {
  throw new Error("not implemented");
}
