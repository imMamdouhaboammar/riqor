import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { verifyPayloadProvenance } from "../packages/riqor/src/commands/doctor";

export type CommittedRuntimeVerification = Readonly<{
  ok: boolean;
  detail: string;
  packageRoot: string;
}>;

export async function verifyCommittedRuntime(repositoryRoot = resolve(import.meta.dir, "..")): Promise<CommittedRuntimeVerification> {
  const packageRoot = join(resolve(repositoryRoot), "packages", "riqor");
  try {
    const pkg = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as { version?: unknown };
    if (typeof pkg.version !== "string" || pkg.version.length === 0) {
      return { ok: false, detail: "package version is missing", packageRoot };
    }
    const result = await verifyPayloadProvenance(join(packageRoot, "runtime"), pkg.version);
    return { ...result, packageRoot };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "committed runtime verification failed",
      packageRoot,
    };
  }
}

if (import.meta.main) {
  const report = await verifyCommittedRuntime(process.argv[2]);
  console.log(JSON.stringify(report));
  if (!report.ok) process.exitCode = 1;
}
