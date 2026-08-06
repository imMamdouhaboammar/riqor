import { readFile } from "node:fs/promises";

export async function verifyActionPins(workflowPaths: string[]): Promise<void> {
  const errors: string[] = [];
  const shaRegex = /uses:\s+[^\s]+@([a-f0-9]{40})\b/;

  for (const path of workflowPaths) {
    const content = await readFile(path, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("uses:") && !line.includes("docker://")) {
        if (!shaRegex.test(line)) {
          errors.push(`${path}:${i + 1}: action reference is not pinned to a 40-character commit SHA: "${line.trim()}"`);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Action pin verification failed:\n${errors.join("\n")}`);
  }
}

if (import.meta.main) {
  verifyActionPins([
    ".github/workflows/ci.yml",
    ".github/workflows/release.yml",
  ]).then(() => {
    console.log("Action pin verification passed.");
  }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
