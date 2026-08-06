import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type VerificationReport = Readonly<{
  ok: boolean;
  version: string;
  checked: readonly string[];
  errors: readonly string[];
}>;

export async function verifyReleaseArtifacts(directory: string): Promise<VerificationReport> {
  const errors: string[] = [];
  const checked: string[] = [];
  let version = "unknown";

  try {
    const manifestPath = join(directory, "release-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    version = manifest.version;
    checked.push("release-manifest.json");

    for (const art of manifest.artifacts) {
      const artPath = join(directory, art.file);
      const content = await readFile(artPath);
      const sha256 = createHash("sha256").update(content).digest("hex");
      if (sha256 !== art.sha256) {
        errors.push(`Digest mismatch for ${art.file}: expected ${art.sha256}, got ${sha256}`);
      }
      checked.push(art.file);
    }
  } catch (err) {
    errors.push(`Failed to read manifest or artifacts: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    ok: errors.length === 0,
    version,
    checked,
    errors,
  };
}

if (import.meta.main) {
  const dir = join(process.cwd(), "dist");
  verifyReleaseArtifacts(dir)
    .then((report) => {
      if (!report.ok) {
        console.error("Release verification failed:", report.errors);
        process.exit(1);
      }
      console.log(`Verified ${report.checked.length} release artifacts for v${report.version}`);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
