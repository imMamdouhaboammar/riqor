export type Order = { id: string; quantity: number; unitCents: number; status: string };

export function parseOrders(csv: string): Order[] {
  return csv
    .trim()
    .split("\n")
    .slice(1)
    .map((row) => {
      const [id, quantity, unitCents, status] = row.split(",");
      return { id, quantity: Number(quantity), unitCents: Number(unitCents), status };
    });
}

export function revenueReport(csv: string) {
  const orders = parseOrders(csv).filter(({ status }) => status === "paid");
  return { orders, totalNetCents: orders.reduce((sum, order) => sum + order.unitCents, 0) };
}
