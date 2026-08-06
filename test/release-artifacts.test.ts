import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReleaseManifest } from "../scripts/create-release-manifest";
import { verifyReleaseArtifacts } from "../scripts/verify-release-artifacts";

describe("release artifacts and manifest verification", () => {
  test("createReleaseManifest generates release-manifest.json and SHA256SUMS", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "riqor-release-test-"));
    const dummyArtifact = join(tempDir, "sample.tar.gz");
    await writeFile(dummyArtifact, "test-content");

    const manifest = await createReleaseManifest({
      version: "0.1.0",
      tag: "v0.1.0",
      commit: "0123456789abcdef0123456789abcdef01234567",
      artifactPaths: [dummyArtifact],
      outputDir: tempDir,
    });

    expect(manifest.version).toBe("0.1.0");
    expect(manifest.artifacts.length).toBe(1);

    const report = await verifyReleaseArtifacts(tempDir);
    expect(report.ok).toBe(true);

    await rm(tempDir, { recursive: true, force: true });
  });
});
