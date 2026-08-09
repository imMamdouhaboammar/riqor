import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assessCodexDoctorOutput, assessPackageAgentAvailability, runPackageSecurityAudit, verifyPayloadProvenance } from "../src/commands/doctor";

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

  test("treats Codex and AGY as alternative agent CLIs and Kaku as optional", () => {
    expect(assessPackageAgentAvailability({ codexAvailable: true, agyAvailable: false }).ok).toBe(true);
    expect(assessPackageAgentAvailability({ codexAvailable: false, agyAvailable: true }).ok).toBe(true);
    expect(assessPackageAgentAvailability({ codexAvailable: false, agyAvailable: false }).ok).toBe(false);
  });

  test("runs package security audit against the Riqor payload instead of caller cwd", async () => {
    const packageRoot = await mkdtemp(join(tmpdir(), "riqor-package-security-"));
    const callerRoot = await mkdtemp(join(tmpdir(), "riqor-caller-security-"));
    roots.push(packageRoot, callerRoot);
    const fakePat = ["ghp_", "123456789012345678901234567890123456"].join("");
    await writeFile(join(packageRoot, "package.json"), '{"name":"riqor"}\n');
    await writeFile(join(packageRoot, "README.md"), "clean package readme\n");
    await writeFile(join(callerRoot, "package.json"), `${JSON.stringify({ token: fakePat })}\n`);
    await writeFile(join(callerRoot, "README.md"), "eval(user_prompt)\n");
    const original = process.cwd();
    try {
      process.chdir(callerRoot);
      const report = runPackageSecurityAudit(packageRoot);
      expect(report.passed).toBe(true);
      expect(report.scannedFilesCount).toBe(2);
    } finally {
      process.chdir(original);
    }
  });
});
