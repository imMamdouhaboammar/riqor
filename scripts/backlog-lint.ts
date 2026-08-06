import { loadBacklog, repositoryRootFromModule } from "./backlog-lib";
import { validateBacklogPolicy } from "./backlog-policy";

export async function main(): Promise<void> {
  const root = repositoryRootFromModule(import.meta.url);
  const backlog = await loadBacklog(root);
  const errors = validateBacklogPolicy(backlog);
  if (errors.length > 0) {
    process.stderr.write(`${errors.map((error) => `- ${error}`).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `backlog valid: ${backlog.initiatives.length} initiatives, ${backlog.items.length} items\n`,
  );
}

if (import.meta.main) {
  await main();
}
