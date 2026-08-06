import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  loadBacklog,
  renderBacklogMarkdown,
  renderCurrentMarkdown,
  repositoryRootFromModule,
} from "./backlog-lib";
import {
  assertBacklogPathsSafe,
  assertBacklogPolicy,
  assertGeneratedViewPathsSafe,
} from "./backlog-policy";

type Mode = "print" | "write" | "check";

function mode(args: readonly string[]): Mode {
  const selected = args.filter((argument) => argument === "--write" || argument === "--check");
  if (selected.length > 1) throw new Error("choose only one of --write or --check");
  if (selected[0] === "--write") return "write";
  if (selected[0] === "--check") return "check";
  return "print";
}

async function matches(path: string, expected: string): Promise<boolean> {
  try {
    return await readFile(path, "utf8") === expected;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function writeAtomic(path: string, content: string): Promise<void> {
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const root = repositoryRootFromModule(import.meta.url);
  await assertBacklogPathsSafe(root);
  const backlog = await loadBacklog(root);
  assertBacklogPolicy(backlog);

  const portfolio = renderBacklogMarkdown(backlog);
  const current = renderCurrentMarkdown(backlog);
  const portfolioPath = join(root, "BACKLOG.md");
  const currentPath = join(root, "docs", "backlog", "CURRENT.md");

  const selected = mode(args);
  if (selected === "print") {
    process.stdout.write(portfolio);
    return;
  }

  await assertGeneratedViewPathsSafe(root);
  if (selected === "write") {
    await writeAtomic(portfolioPath, portfolio);
    await writeAtomic(currentPath, current);
    process.stdout.write("backlog views updated\n");
    return;
  }

  const stale: string[] = [];
  if (!await matches(portfolioPath, portfolio)) stale.push("BACKLOG.md");
  if (!await matches(currentPath, current)) stale.push("docs/backlog/CURRENT.md");
  if (stale.length > 0) {
    process.stderr.write(`stale generated backlog views: ${stale.join(", ")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("backlog views are current\n");
}

if (import.meta.main) {
  await main();
}
