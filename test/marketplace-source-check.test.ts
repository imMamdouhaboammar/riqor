import { expect, test } from "bun:test";
import { resolve } from "node:path";

const script = resolve(import.meta.dir, "..", "scripts", "check-marketplace-source.py");

function check(payload: unknown, name = "riqor", root = "/repo") {
  return Bun.spawnSync(["python3", script, name, root], {
    stdin: Buffer.from(JSON.stringify(payload)),
    stdout: "pipe",
    stderr: "pipe",
  });
}

test("accepts only an exact local marketplace source", () => {
  const match = check({ marketplaces: [{
    name: "riqor",
    root: "/repo",
    marketplaceSource: { sourceType: "local", source: "/repo" },
  }] });
  expect(match.exitCode).toBe(0);
  expect(match.stdout.toString().trim()).toBe("match");

  const absent = check({ marketplaces: [] });
  expect(absent.exitCode).toBe(3);
  expect(absent.stdout.toString().trim()).toBe("absent");

  const mismatch = check({ marketplaces: [{
    name: "riqor",
    root: "/another-repo",
    marketplaceSource: { sourceType: "local", source: "/another-repo" },
  }] });
  expect(mismatch.exitCode).toBe(4);
  expect(mismatch.stderr.toString()).toContain("remove or rename the conflicting marketplace");
});
