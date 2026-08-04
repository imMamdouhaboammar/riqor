import { writeFile } from "node:fs/promises";

export async function exportReport(path: string, contents: string) {
  await writeFile(path, contents, "utf8");
}
