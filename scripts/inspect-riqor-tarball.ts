import { runProcess } from "../src/process";

export type TarballReport = Readonly<{
  ok: boolean;
  entries: readonly string[];
  errors: readonly string[];
}>;

const forbiddenPattern = /(?:^|\/)(?:auth\.json|\.env(?:\.|$)|credentials?|secrets?|\.DS_Store|work|fixtures|test)(?:\/|$)/i;

export async function inspectRiqorTarball(tarballPath: string): Promise<TarballReport> {
  const result = await runProcess(["tar", "-tzf", tarballPath]);
  if (result.exitCode !== 0) {
    return { ok: false, entries: [], errors: [`Failed to list tarball: ${result.stderr}`] };
  }

  const rawEntries = result.stdout.split("\n").filter(Boolean);
  const entries = rawEntries.map((entry) => entry.replace(/^package\//, ""));
  const errors: string[] = [];

  for (const entry of entries) {
    if (forbiddenPattern.test(entry)) {
      errors.push(`Forbidden tarball entry: ${entry}`);
    }
  }

  return {
    ok: errors.length === 0,
    entries,
    errors,
  };
}

if (import.meta.main) {
  const tarballPath = process.argv[2];
  if (!tarballPath) {
    console.error("Usage: bun run scripts/inspect-riqor-tarball.ts <path-to-tarball>");
    process.exit(1);
  }
  const report = await inspectRiqorTarball(tarballPath);
  if (!report.ok) {
    console.error("Tarball inspection failed:", report.errors);
    process.exit(1);
  }
  console.log(`Tarball inspection passed (${report.entries.length} entries)`);
}
