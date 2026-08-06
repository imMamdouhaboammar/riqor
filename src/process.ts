import { completionExitCode } from "./runner";
import { randomUUID } from "node:crypto";

function processTree(roots: Set<number>) {
  if (process.platform === "win32") return [...roots];
  const psCmd = process.platform === "darwin" ? ["/bin/ps", "-axo", "pid=,ppid="] : ["ps", "-eo", "pid=,ppid="];
  const listing = Bun.spawnSync(psCmd, { stdout: "pipe", stderr: "ignore" });
  if (listing.exitCode !== 0) return [...roots];
  const children = new Map<number, number[]>();
  for (const line of listing.stdout.toString().split("\n")) {
    const [pid, parent] = line.trim().split(/\s+/).map(Number);
    if (!Number.isInteger(pid) || !Number.isInteger(parent)) continue;
    children.set(parent!, [...(children.get(parent!) ?? []), pid!]);
  }
  const discovered = [...roots];
  for (let index = 0; index < discovered.length; index += 1) {
    for (const pid of children.get(discovered[index]!) ?? []) {
      if (!roots.has(pid)) {
        roots.add(pid);
        discovered.push(pid);
      }
    }
  }
  return discovered;
}

function markedProcesses(marker: string) {
  if (process.platform === "win32") return [];
  const psCmd = process.platform === "darwin" ? ["/bin/ps", "eww", "-axo", "pid=,command="] : ["ps", "auxe"];
  const listing = Bun.spawnSync(psCmd, { stdout: "pipe", stderr: "ignore" });
  if (listing.exitCode !== 0) return [];
  const needle = `CODEX_HARNESS_PROCESS_MARKER=${marker}`;
  return listing.stdout.toString().split("\n").flatMap((line) => {
    if (!line.includes(needle)) return [];
    const pid = Number(line.trim().match(/^\d+/)?.[0] ?? line.trim().split(/\s+/)[1]);
    return Number.isInteger(pid) ? [pid] : [];
  });
}

export async function runProcess(
  command: string[],
  cwdOrOptions?: string | { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number },
  environment: NodeJS.ProcessEnv = process.env,
  timeoutMs = 10 * 60 * 1000,
  forceKillGraceMs = 2_000,
) {
  const cwd = typeof cwdOrOptions === "string" ? cwdOrOptions : (cwdOrOptions?.cwd ?? process.cwd());
  const env = typeof cwdOrOptions === "object" && cwdOrOptions?.env ? cwdOrOptions.env : (environment ?? process.env);
  const timeoutLimit = typeof cwdOrOptions === "object" && cwdOrOptions?.timeoutMs ? cwdOrOptions.timeoutMs : timeoutMs;

  const marker = randomUUID();
  const child = Bun.spawn(command, {
    cwd,
    env: { ...process.env, ...env, CODEX_HARNESS_PROCESS_MARKER: marker },
    stdout: "pipe",
    stderr: "pipe",
    detached: process.platform !== "win32",
  });
  let timedOut = false;
  let forceKill: ReturnType<typeof setTimeout> | undefined;
  let forceKillDone: Promise<void> | undefined;
  const trackedPids = new Set([child.pid]);
  const killTree = (signal: NodeJS.Signals | number) => {
    for (const pid of markedProcesses(marker)) trackedPids.add(pid);
    const pids = processTree(trackedPids).reverse();
    if (process.platform === "win32") {
      Bun.spawnSync(["taskkill", "/PID", String(child.pid), "/T", ...(signal === "SIGKILL" ? ["/F"] : [])], {
        stdout: "ignore",
        stderr: "ignore",
      });
      return;
    }
    for (const pid of pids) {
      try { process.kill(-pid, signal); } catch {}
      try { process.kill(pid, signal); } catch {}
    }
    try {
      child.kill(signal);
    } catch {
      // The PID and process-group signals above already handled the common exit paths.
    }
  };
  const timeout = setTimeout(() => {
    timedOut = true;
    killTree("SIGTERM");
    forceKillDone = new Promise((resolve) => {
      forceKill = setTimeout(() => {
        killTree("SIGKILL");
        resolve();
      }, forceKillGraceMs);
    });
  }, timeoutMs);
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { stdout, stderr, exitCode: completionExitCode(exitCode, timedOut) };
  } finally {
    clearTimeout(timeout);
    if (timedOut && forceKillDone) await forceKillDone;
    else if (forceKill) clearTimeout(forceKill);
    killTree("SIGKILL");
  }
}
