import { expect, test } from "bun:test";
import { clearCache, renderProduct } from "./src/cache";

test("renders an English label", () => {
  clearCache();
  expect(renderProduct({ id: "p1", names: { en: "Chair" }, tags: [] }, "en").label).toBe("Chair");
});
