import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { resolveUserPaths } from "../paths";
import { runCommand } from "../process";
import { CheckRecord, DoctorOptions, DoctorReport } from "../types";

async function exists(path: string) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function doctor(options: DoctorOptions = {}): Promise<DoctorReport> {
  const paths = resolveUserPaths(options.home);
  const packageRoot = process.env.RIQOR_PACKAGE_ROOT ?? join(paths.riqorCurrentLink);
  const runtimeRoot = process.env.RIQOR_RUNTIME_ROOT ?? join(packageRoot, "runtime");

  const checks: CheckRecord[] = [];
  const externalIssues: string[] = [];

  // Package checks
  let pkgVersion = "missing";
  try {
    const pkg = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    pkgVersion = pkg.version ?? "unknown";
  } catch {}
  checks.push({ id: "package-version", ok: pkgVersion !== "missing", detail: pkgVersion });

  const provenancePath = join(runtimeRoot, "provenance.json");
  const hasProvenance = await exists(provenancePath);
  checks.push({ id: "payload-provenance", ok: hasProvenance, detail: hasProvenance ? "verified" : "missing" });

  const supportedPlatform = process.platform === "darwin" || process.platform === "linux";
  checks.push({ id: "supported-platform", ok: supportedPlatform, detail: process.platform });

  if (options.packageOnly) {
    return {
      ok: checks.every((c) => c.ok),
      checks,
      externalIssues,
    };
  }

  const hasBinShim = await exists(paths.riqorBinShim);
  checks.push({ id: "executable-shim", ok: hasBinShim, detail: hasBinShim ? "installed" : "missing" });

  // Full doctor checks
  const codex = await runCommand(["codex", "--version"]);
  checks.push({ id: "codex-cli", ok: codex.exitCode === 0, detail: codex.exitCode === 0 ? codex.stdout : "missing" });

  const codexDoctor = await runCommand(["codex", "doctor", "--json"]);
  let coreOk = false;
  if (codexDoctor.exitCode === 0 && codexDoctor.stdout) {
    try {
      const parsed = JSON.parse(codexDoctor.stdout) as { checks?: Record<string, { status?: string; summary?: string }> };
      const coreIds = ["auth.credentials", "config.load", "network.provider_reachability", "state.paths"];
      coreOk = coreIds.every((id) => parsed.checks?.[id]?.status === "ok");
      if (parsed.checks) {
        for (const [id, item] of Object.entries(parsed.checks)) {
          if (!coreIds.includes(id) && item.status !== "ok") {
            externalIssues.push(`${id}: ${item.summary ?? item.status ?? "issue"}`);
          }
        }
      }
    } catch {}
  }
  checks.push({ id: "codex-core", ok: coreOk, detail: coreOk ? "core passed" : "core unverified or failing" });

  const kaku = await runCommand(["kaku", "--version"]);
  checks.push({ id: "kaku-cli", ok: kaku.exitCode === 0, detail: kaku.exitCode === 0 ? kaku.stdout : "missing" });

  return {
    ok: checks.every((c) => c.ok),
    checks,
    externalIssues,
  };
}
