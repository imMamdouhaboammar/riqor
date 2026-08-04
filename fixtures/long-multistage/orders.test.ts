import { expect, test } from "bun:test";
import { revenueReport } from "./src/orders";

test("paid quantities contribute to revenue", () => {
  const report = revenueReport("id,quantity,unit_cents,status\nb,2,300,paid\na,1,100,void");
  expect(report.totalNetCents).toBe(600);
});
