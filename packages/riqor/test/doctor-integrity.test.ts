import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assessCodexDoctorOutput, verifyPayloadProvenance } from "../src/commands/doctor";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const runtime = await mkdtemp(join(tmpdir(), "riqor-provenance-"));
  roots.push(runtime);
  const payload = Buffer.from("verified payload\n");
  await mkdir(join(runtime, "config"), { recursive: true });
  await writeFile(join(runtime, "config", "sample.txt"), payload);
  await writeFile(join(runtime, "provenance.json"), JSON.stringify({
    version: "0.1.1",
    sourceCommit: "0123456789abcdef0123456789abcdef01234567",
    files: [{
      path: "config/sample.txt",
      sha256: createHash("sha256").update(payload).digest("hex"),
      bytes: payload.length,
    }],
  }));
  return runtime;
}
describe("package integrity diagnostics", () => {
  test("accepts an intact provenance manifest and rejects payload tampering", async () => {
    const runtime = await fixture();
    const first = await verifyPayloadProvenance(runtime, "0.1.1");
    expect(first.ok).toBe(true);

    await writeFile(join(runtime, "config", "sample.txt"), "tampered\n");
    const second = await verifyPayloadProvenance(runtime, "0.1.1");
    expect(second.ok).toBe(false);
    expect(second.detail).toContain("config/sample.txt");
  });

  test("rejects provenance paths that escape the runtime root", async () => {
    const runtime = await fixture();
    await writeFile(join(runtime, "provenance.json"), JSON.stringify({
      version: "0.1.1",
      files: [{ path: "../outside", sha256: "0".repeat(64), bytes: 0 }],
    }));
    const report = await verifyPayloadProvenance(runtime, "0.1.1");
    expect(report.ok).toBe(false);
    expect(report.detail).toContain("unsafe provenance path");
  });

  test("separates Codex core health from unrelated doctor failures", () => {
    const report = assessCodexDoctorOutput(JSON.stringify({
      overallStatus: "fail",
      checks: {
        "auth.credentials": { status: "ok" },
        "config.load": { status: "ok" },
        "network.provider_reachability": { status: "ok" },
        "state.paths": { status: "ok" },
        "installation": { status: "fail", summary: "different install" },
      },
    }));
    expect(report.coreOk).toBe(true);
    expect(report.externalIssues).toContain("installation: different install");
  });
});
