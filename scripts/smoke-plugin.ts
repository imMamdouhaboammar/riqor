import { chmod, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "..");
const smokeRoot = join(repositoryRoot, "work", "plugin-smoke");
const codexHome = join(smokeRoot, "codex-home");
const directData = join(smokeRoot, "direct-data");
const repo = join(smokeRoot, "repo");
const pluginSelector = "riqor@riqor";

function spawnCommand(command: string[], cwd = repositoryRoot, environment: NodeJS.ProcessEnv = {}) {
  return Bun.spawnSync(command, {
    cwd,
    env: { ...process.env, ...environment },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
}

function run(command: string[], cwd = repositoryRoot, environment: NodeJS.ProcessEnv = {}) {
  const execution = spawnCommand(command, cwd, environment);
  if (execution.exitCode !== 0) {
    throw new Error(`${command.join(" ")} failed with ${execution.exitCode}: ${execution.stderr.toString().trim()}\n${execution.stdout.toString().trim()}`);
  }
  return execution.stdout.toString();
}

async function findRuntimeMarkers(root: string): Promise<string[]> {
  const markers: string[] = [];
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); }
  catch { return markers; }
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) markers.push(...await findRuntimeMarkers(path));
    else if (entry.name === "runtime.json") markers.push(path);
  }
  return markers;
}

await rm(smokeRoot, { recursive: true, force: true });
await Promise.all([
  mkdir(codexHome, { recursive: true, mode: 0o700 }),
  mkdir(directData, { recursive: true, mode: 0o700 }),
  mkdir(repo, { recursive: true, mode: 0o700 }),
]);
await chmod(codexHome, 0o700);
const authLink = join(codexHome, "auth.json");
await symlink(join(homedir(), ".codex", "auth.json"), authLink);
try {
  await writeFile(join(repo, "README.md"), "# Plugin smoke repository\n");

  const environment = { CODEX_HOME: codexHome, HOME: codexHome };
  run(["codex", "plugin", "marketplace", "add", repositoryRoot, "--json"], repositoryRoot, environment);
  const installed = JSON.parse(run(["codex", "plugin", "add", pluginSelector, "--json"], repositoryRoot, environment));
  if (!installed.installedPath) throw new Error("plugin install did not return an installed path");

  const directInput = JSON.stringify({
    session_id: "direct-smoke",
    turn_id: "one",
    hook_event_name: "SessionStart",
    source: "startup",
    model: "gpt-5.6-sol",
    permission_mode: "never",
    cwd: repo,
    transcript_path: null,
  });
  const direct = Bun.spawnSync(["bun", join(installed.installedPath, "hooks", "main.ts")], {
    cwd: repo,
    env: { ...process.env, PLUGIN_ROOT: installed.installedPath, PLUGIN_DATA: directData },
    stdin: new TextEncoder().encode(directInput),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (direct.exitCode !== 0) throw new Error(`direct hook failed: ${direct.stderr.toString().trim()}`);
  const directOutput = JSON.parse(direct.stdout.toString());
  if (!String(directOutput.hookSpecificOutput?.additionalContext ?? "").includes("measured control plane")) {
    throw new Error("direct SessionStart hook did not return the expected context");
  }

  const codexExecution = spawnCommand([
    "codex",
    "exec",
    "--json",
    "--ephemeral",
    "--skip-git-repo-check",
    "--dangerously-bypass-hook-trust",
    "-s",
    "read-only",
    "-c",
    'approval_policy="never"',
    "-m",
    "gpt-5.6-sol",
    "-C",
    repo,
    "Do not use tools. Reply with exactly SMOKE_OK",
  ], repo, environment);
  const codexOutput = codexExecution.stdout.toString();
  const events = codexOutput.trim().split("\n").filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  const message = events.findLast((event) => event.item?.type === "agent_message")?.item?.text ?? "";
  const failureText = `${codexExecution.stderr.toString()}\n${codexOutput}`;
  const quotaBlocked = /usage limit|purchase more credits/i.test(failureText);
  if (codexExecution.exitCode === 0 && !String(message).includes("SMOKE_OK")) {
    throw new Error("Codex smoke response was not observed");
  }
  if (codexExecution.exitCode !== 0 && !quotaBlocked) {
    throw new Error(`Codex smoke turn failed with ${codexExecution.exitCode}: ${failureText.trim()}`);
  }

  const markers = await findRuntimeMarkers(join(codexHome, "plugins", "data"));
  if (markers.length === 0) throw new Error("Codex did not execute the installed SessionStart hook");
  const marker = JSON.parse(await readFile(markers[0]!, "utf8"));
  if (marker.event !== "SessionStart" || marker.version !== 1) throw new Error("runtime marker is invalid");

  process.stdout.write(`${JSON.stringify({
    ok: true,
    pluginId: installed.pluginId,
    version: installed.version,
    installedPath: installed.installedPath,
    runtimeMarker: markers[0],
    hookExecution: "verified",
    modelTurn: codexExecution.exitCode === 0 ? "completed" : "quota-blocked",
    response: message || null,
    limitation: quotaBlocked ? "Codex model turn was blocked by the account usage limit" : null,
  }, null, 2)}\n`);
} finally {
  await rm(authLink, { force: true });
}
