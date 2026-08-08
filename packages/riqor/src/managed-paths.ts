import { lstat, readFile, readlink } from "node:fs/promises";

export type ManagedPathKind =
  | "absent"
  | "riqor-managed"
  | "legacy-managed"
  | "riqor-alias"
  | "foreign";

export async function classifyManagedPath(path: string): Promise<ManagedPathKind> {
  let stat;
  try {
    stat = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "absent";
    throw error;
  }

  if (stat.isSymbolicLink()) {
    const target = await readlink(path);
    return target === "riqor" ? "riqor-alias" : "foreign";
  }

  if (!stat.isFile() || stat.size > 64 * 1024) return "foreign";
  const content = await readFile(path, "utf8");
  const header = content.split(/\r?\n/, 6);
  if (header.includes("# Managed by Riqor")) return "riqor-managed";
  if (header.includes("# Managed by Codex Self Improvement")) return "legacy-managed";
  return "foreign";
}
