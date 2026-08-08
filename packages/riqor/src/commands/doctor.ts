import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, lstat, readdir, readFile } from "node:fs/promises";
import { isAbsolute, join, normalize, relative } from "node:path";
import { resolveUserPaths } from "../paths";
import { runCommand } from "../process";
import { CheckRecord, DoctorOptions, DoctorReport } from "../types";
import { runOfflineSecurityScan } from "../../../../src/security-scan";

async function exists(path: string) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function assessCodexDoctorOutput(output: string) {
  try {
    const parsed = JSON.parse(output) as {
      overallStatus?: string;
      checks?: Record<string, { status?: string; summary?: string }>;
    };
    const checks = parsed.checks ?? {};
    const coreIds = ["auth.credentials", "config.load", "network.provider_reachability", "state.paths"];
    const coreOk = coreIds.every((id) => checks[id]?.status === "ok");
    const externalIssues = Object.entries(checks)
      .filter(([id, item]) => !coreIds.includes(id) && item.status !== "ok")
      .map(([id, item]) => `${id}: ${item.summary ?? item.status ?? "issue"}`)
      .sort();
    return { coreOk, overallStatus: parsed.overallStatus ?? "unknown", externalIssues };
  } catch {
    return { coreOk: false, overallStatus: "unreadable", externalIssues: ["Codex doctor returned invalid JSON"] };
  }
}
async function runtimeFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(current, entry.name);
    if (entry.isDirectory()) files.push(...await runtimeFiles(root, full));
    else files.push(relative(root, full).replaceAll("\\", "/"));
  }
  return files;
}

export async function verifyPayloadProvenance(runtimeRoot: string, expectedVersion: string) {
  try {
    const raw = JSON.parse(await readFile(join(runtimeRoot, "provenance.json"), "utf8")) as {
      version?: unknown;
      files?: Array<{ path?: unknown; sha256?: unknown; bytes?: unknown }>;
    };
    if (raw.version !== expectedVersion) {
      return { ok: false, detail: `provenance version mismatch: ${String(raw.version ?? "missing")}` };
    }
    if (!Array.isArray(raw.files) || raw.files.length === 0) {
      return { ok: false, detail: "provenance file list is missing" };
    }

    const expected = new Set<string>();
    for (const entry of raw.files) {
      if (
        typeof entry.path !== "string"
        || entry.path === ".."
        || entry.path.startsWith("../")
        || entry.path.includes("/../")
        || isAbsolute(entry.path)
        || normalize(entry.path).replaceAll("\\", "/") !== entry.path
      ) {
        return { ok: false, detail: `unsafe provenance path: ${String(entry.path)}` };
      }
      if (expected.has(entry.path)) return { ok: false, detail: `duplicate provenance path: ${entry.path}` };
      if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(entry.sha256)) {
        return { ok: false, detail: `invalid provenance digest: ${entry.path}` };
      }
      if (!Number.isInteger(entry.bytes) || Number(entry.bytes) < 0) {
        return { ok: false, detail: `invalid provenance size: ${entry.path}` };
      }
      const full = join(runtimeRoot, entry.path);
      const stat = await lstat(full);
      if (!stat.isFile()) return { ok: false, detail: `provenance entry is not a regular file: ${entry.path}` };
      const content = await readFile(full);
      const digest = createHash("sha256").update(content).digest("hex");
      if (digest !== entry.sha256 || content.length !== entry.bytes) {
        return { ok: false, detail: `payload integrity mismatch: ${entry.path}` };
      }
      expected.add(entry.path);
    }

    const actual = new Set((await runtimeFiles(runtimeRoot)).filter((path) => path !== "provenance.json"));
    for (const path of actual) {
      if (!expected.has(path)) return { ok: false, detail: `unexpected runtime file: ${path}` };
    }
    for (const path of expected) {
      if (!actual.has(path)) return { ok: false, detail: `missing runtime file: ${path}` };
    }
    return { ok: true, detail: `verified ${expected.size} runtime files` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "provenance verification failed" };
  }
}

export async function doctor(options: DoctorOptions = {}): Promise<DoctorReport> {
  const paths = resolveUserPaths(options.home);
  const packageRoot = process.env.RIQOR_PACKAGE_ROOT ?? paths.riqorCurrentLink;
  const runtimeRoot = process.env.RIQOR_RUNTIME_ROOT ?? join(packageRoot, "runtime");
  const checks: CheckRecord[] = [];
  const externalIssues: string[] = [];

  let pkgVersion = "missing";
  try {
    const pkg = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as { version?: string };
    pkgVersion = pkg.version ?? "unknown";
  } catch {}
  checks.push({ id: "package-version", ok: pkgVersion !== "missing" && pkgVersion !== "unknown", detail: pkgVersion });
  const provenance = pkgVersion === "missing" || pkgVersion === "unknown"
    ? { ok: false, detail: "package version unavailable" }
    : await verifyPayloadProvenance(runtimeRoot, pkgVersion);
  checks.push({ id: "payload-provenance", ok: provenance.ok, detail: provenance.detail });

  const supportedPlatform = process.platform === "darwin" || process.platform === "linux";
  checks.push({ id: "supported-platform", ok: supportedPlatform, detail: process.platform });

  if (options.packageOnly) {
    return { ok: checks.every((check) => check.ok), checks, externalIssues };
  }

  const hasBinShim = await exists(paths.riqorBinShim);
  checks.push({ id: "executable-shim", ok: hasBinShim, detail: hasBinShim ? "installed" : "missing" });

  const codex = await runCommand(["codex", "--version"]);
  checks.push({ id: "codex-cli", ok: codex.exitCode === 0, detail: codex.exitCode === 0 ? codex.stdout : "missing" });

  const codexDoctor = await runCommand(["codex", "doctor", "--json"]);
  const assessment = codexDoctor.stdout
    ? assessCodexDoctorOutput(codexDoctor.stdout)
    : { coreOk: false, overallStatus: "unavailable", externalIssues: [codexDoctor.stderr || "Codex doctor produced no JSON"] };
  checks.push({
    id: "codex-core",
    ok: assessment.coreOk,
    detail: assessment.coreOk ? `core passed; overall ${assessment.overallStatus}` : `core failed; overall ${assessment.overallStatus}`,
  });
  externalIssues.push(...assessment.externalIssues);

  const kaku = await runCommand(["kaku", "--version"]);
  checks.push({ id: "kaku-cli", ok: kaku.exitCode === 0, detail: kaku.exitCode === 0 ? kaku.stdout : "missing" });

  const securityResult = runOfflineSecurityScan(["package.json", "README.md"]);
  checks.push({
    id: "security-audit",
    ok: securityResult.passed,
    detail: securityResult.passed ? "0 critical security findings" : `${securityResult.findings.length} security finding(s)`,
  });

  return { ok: checks.every((check) => check.ok), checks, externalIssues };
}
