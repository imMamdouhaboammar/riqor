export type Operation = { id: string; type: "credit" | "debit"; cents: number };

export function applyBatch(startCents: number, operations: Operation[]) {
  const seen = new Set<string>();
  let balanceCents = startCents;
  for (const operation of operations) {
    if (!operation.id || seen.has(operation.id)) return { balanceCents: startCents, appliedIds: [] };
    if (operation.type !== "credit" && operation.type !== "debit") return { balanceCents: startCents, appliedIds: [] };
    if (!Number.isInteger(operation.cents) || operation.cents <= 0) return { balanceCents: startCents, appliedIds: [] };
    seen.add(operation.id);
    balanceCents += operation.type === "credit" ? operation.cents : -operation.cents;
    if (balanceCents < 0) return { balanceCents: startCents, appliedIds: [] };
  }
  return { balanceCents, appliedIds: operations.map(({ id }) => id) };
}
