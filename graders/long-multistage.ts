import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repo = resolve(process.argv[2]);
const { parseOrders, revenueReport } = await import(pathToFileURL(resolve(repo, "src/orders.ts")).href);
const csv = "id,quantity,unit_cents,status\n\nz,2,5000,paid\na,3,100,paid\nv,1,900,void\n";
assert.deepEqual(revenueReport(csv), {
  orders: [
    { id: "a", quantity: 3, unitCents: 100, status: "paid" },
    { id: "z", quantity: 2, unitCents: 5000, status: "paid" },
  ],
  totalNetCents: 9300,
});
assert.throws(() => parseOrders("id,quantity,unit_cents,status\na,1,2,paid\nb,0,2,paid"), /3/);
assert.throws(() => parseOrders("id,quantity,unit_cents,status\na,1,2,paid\na,1,3,paid"), /3/);
