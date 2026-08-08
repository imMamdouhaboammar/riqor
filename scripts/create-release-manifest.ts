import { createHash } from "node:crypto";
import { stat, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export type ReleaseManifestInput = Readonly<{
  version: string;
  tag: string;
  commit: string;
  artifactPaths: readonly string[];
  outputDir?: string;
}>;

export type ReleaseManifest = Readonly<{
  schemaVersion: 1;
  product: "riqor";
  version: string;
  tag: string;
  commit: string;
  artifacts: readonly {
    file: string;
    sha256: string;
    bytes: number;
    mediaType: string;
  }[];
}>;

export async function createReleaseManifest(input: ReleaseManifestInput): Promise<ReleaseManifest> {
  const outputDir = input.outputDir ?? process.cwd();
  const artifactRecords = [];
  const shaLines: string[] = [];

  for (const path of input.artifactPaths) {
    const file = basename(path);
    const content = await readFile(path);
    const sha256 = createHash("sha256").update(content).digest("hex");
    const st = await stat(path);
    const mediaType = file.endsWith(".tgz")
      ? "application/gzip"
      : file.endsWith(".zip")
      ? "application/zip"
      : "application/octet-stream";

    artifactRecords.push({
      file,
      sha256,
      bytes: st.size,
      mediaType,
    });
    shaLines.push(`${sha256}  ${file}`);
  }

  shaLines.sort((a, b) => a.split("  ")[1].localeCompare(b.split("  ")[1]));

  const manifest: ReleaseManifest = {
    schemaVersion: 1,
    product: "riqor",
    version: input.version,
    tag: input.tag,
    commit: input.commit,
    artifacts: artifactRecords,
  };

  await writeFile(join(outputDir, "release-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(join(outputDir, "SHA256SUMS"), shaLines.join("\n") + "\n");

  return manifest;
}

if (import.meta.main) {
  const pkg = JSON.parse(await readFile(join(process.cwd(), "packages", "riqor", "package.json"), "utf8")) as { version: string };
  const version = process.env.RIQOR_VERSION ?? pkg.version;
  const commit = process.env.RIQOR_COMMIT ?? "head";
  const outputDir = join(process.cwd(), "dist");
  const artifactPaths = [
    join(outputDir, `riqor-${version}.tgz`),
    join(outputDir, `riqor-${version}-homebrew.tar.gz`),
  ];
  try {
    const manifest = await createReleaseManifest({ version, tag: `v${version}`, commit, artifactPaths, outputDir });
    console.log(`Created dist/release-manifest.json with ${manifest.artifacts.length} artifacts`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
