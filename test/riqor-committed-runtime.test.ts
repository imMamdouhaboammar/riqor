import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyCommittedRuntime } from "../scripts/verify-committed-runtime";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createRepositoryFixture() {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "riqor-committed-runtime-"));
  roots.push(repositoryRoot);
  const packageRoot = join(repositoryRoot, "packages", "riqor");
  const runtimeRoot = join(packageRoot, "runtime");
  const payload = Buffer.from("committed runtime\n");
  await mkdir(join(runtimeRoot, "config"), { recursive: true });
  await writeFile(join(packageRoot, "package.json"), JSON.stringify({ version: "0.2.6" }));
  await writeFile(join(runtimeRoot, "config", "sample.txt"), payload);
  await writeFile(join(runtimeRoot, "provenance.json"), JSON.stringify({
    version: "0.2.6",
    files: [{
      path: "config/sample.txt",
      sha256: createHash("sha256").update(payload).digest("hex"),
      bytes: payload.length,
    }],
  }));
  return { repositoryRoot, runtimeRoot };
}

describe("committed Riqor runtime gate", () => {
  test("accepts an intact runtime without modifying committed files", async () => {
    const { repositoryRoot, runtimeRoot } = await createRepositoryFixture();
    const provenancePath = join(runtimeRoot, "provenance.json");
    const before = await readFile(provenancePath, "utf8");

    const report = await verifyCommittedRuntime(repositoryRoot);

    expect(report.ok).toBe(true);
    expect(report.detail).toBe("verified 1 runtime files");
    expect(await readFile(provenancePath, "utf8")).toBe(before);
  });

  test("fails closed when a committed payload drifts from provenance", async () => {
    const { repositoryRoot, runtimeRoot } = await createRepositoryFixture();
    await writeFile(join(runtimeRoot, "config", "sample.txt"), "drifted runtime\n");

    const report = await verifyCommittedRuntime(repositoryRoot);

    expect(report.ok).toBe(false);
    expect(report.detail).toBe("payload integrity mismatch: config/sample.txt");
  });
});
