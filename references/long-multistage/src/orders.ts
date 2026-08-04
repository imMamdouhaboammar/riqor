export type Order = { id: string; quantity: number; unitCents: number; status: string };

export function parseOrders(csv: string): Order[] {
  const seen = new Set<string>();
  return csv.split("\n").slice(1).flatMap((row, index) => {
    if (!row.trim()) return [];
    const [id, quantityText, unitText, status] = row.split(",").map((part) => part.trim());
    const quantity = Number(quantityText);
    const unitCents = Number(unitText);
    const line = index + 2;
    if (!id || !Number.isInteger(quantity) || quantity <= 0 || !Number.isInteger(unitCents) || unitCents <= 0) {
      throw new Error(`invalid order at line ${line}`);
    }
    if (seen.has(id)) throw new Error(`duplicate order at line ${line}`);
    seen.add(id);
    return [{ id, quantity, unitCents, status }];
  });
}

export function revenueReport(csv: string) {
  const orders = parseOrders(csv).filter(({ status }) => status === "paid").sort((left, right) => left.id.localeCompare(right.id));
  const totalNetCents = orders.reduce((sum, order) => {
    const subtotal = order.quantity * order.unitCents;
    return sum + subtotal - (subtotal >= 10_000 ? Math.floor(subtotal / 10) : 0);
  }, 0);
  return { orders, totalNetCents };
}
