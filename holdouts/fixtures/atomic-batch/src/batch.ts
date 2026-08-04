export type Operation = { id: string; type: "credit" | "debit"; cents: number };

export function applyBatch(startCents: number, operations: Operation[]) {
  let balanceCents = startCents;
  for (const operation of operations) {
    balanceCents += operation.type === "credit" ? operation.cents : -operation.cents;
    if (balanceCents < 0) return { balanceCents: startCents, appliedIds: [] };
  }
  return { balanceCents, appliedIds: operations.map(({ id }) => id) };
}
