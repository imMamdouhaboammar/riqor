// plugins/riqor/hooks/activator.ts
import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
var uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var keyPattern = /^[a-f0-9]{64}$/;
var minIntervalMs = 60000;
var maxIntervalMs = 24 * 60 * 60 * 1000;
var minWatchdogMs = 1e4;
var maxWatchdogMs = 30 * 60 * 1000;
var maxStateBytes = 1024;
var maxStateFiles = 128;
var staleStateMs = 24 * 60 * 60 * 1000;
var staleLockMs = 60000;
var lockAttempts = 40;
var lockRetryMs = 5;
function boundedInteger(value, minimum, maximum) {
  if (!value || !/^\d+$/.test(value))
    return;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum)
    return;
  return number;
}
function readActivatorConfig(environment) {
  if (environment.RIQOR_ACTIVATOR_ENABLED !== "1")
    return;
  const session = environment.RIQOR_ACTIVATOR_SESSION;
  const intervalMs = boundedInteger(environment.RIQOR_ACTIVATOR_INTERVAL_MS, minIntervalMs, maxIntervalMs);
  const watchdogMs = boundedInteger(environment.RIQOR_ACTIVATOR_WATCHDOG_MS, minWatchdogMs, maxWatchdogMs);
  if (!session || !uuidPattern.test(session) || intervalMs === undefined || watchdogMs === undefined)
    return;
  return { session, intervalMs, watchdogMs };
}
function activatorKey(config) {
  return createHash("sha256").update(config.session).digest("hex");
}
function activatorDirectory(dataDir) {
  return join(dataDir, "activator");
}
function statePath(dataDir, key) {
  if (!keyPattern.test(key))
    throw new Error("invalid activator key");
  return join(activatorDirectory(dataDir), `${key}.json`);
}
function lockPath(dataDir, key) {
  if (!keyPattern.test(key))
    throw new Error("invalid activator key");
  return join(activatorDirectory(dataDir), `.${key}.lock`);
}
async function secureRealDirectory(path, label) {
  await mkdir(path, { recursive: true, mode: 448 });
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error(`${label} must be a real directory`);
  await chmod(path, 448);
}
async function secureDirectory(dataDir) {
  await secureRealDirectory(dataDir, "PLUGIN_DATA");
  const directory = activatorDirectory(dataDir);
  await secureRealDirectory(directory, "activator state path");
  return directory;
}
function validTime(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function parseState(contents, config) {
  try {
    const value = JSON.parse(contents);
    if (value.version !== 1)
      return;
    if (value.intervalMs !== config.intervalMs || value.watchdogMs !== config.watchdogMs)
      return;
    if (!validTime(value.startedAt) || !validTime(value.lastActivityAt) || !validTime(value.lastActivatedAt))
      return;
    if (!validTime(value.nextDueAt) || typeof value.cycle !== "number" || !Number.isSafeInteger(value.cycle) || value.cycle < 0)
      return;
    if (value.phase !== "waiting" && value.phase !== "reviewing")
      return;
    if (value.phase === "reviewing") {
      if (!validTime(value.reviewStartedAt) || !validTime(value.reviewDeadlineAt))
        return;
    }
    return value;
  } catch {
    return;
  }
}
async function readState(dataDir, config) {
  const path = statePath(dataDir, activatorKey(config));
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > maxStateBytes) {
      await rm(path, { force: true });
      return;
    }
    const value = parseState(await readFile(path, "utf8"), config);
    if (!value)
      await rm(path, { force: true });
    return value;
  } catch (error) {
    if (error.code === "ENOENT")
      return;
    throw error;
  }
}
async function writeState(dataDir, config, state) {
  const directory = await secureDirectory(dataDir);
  const key = activatorKey(config);
  const target = statePath(dataDir, key);
  const temporary = join(directory, `.${key}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(state)}
`, { encoding: "utf8", flag: "wx", mode: 384 });
    await rename(temporary, target);
    await chmod(target, 384);
  } finally {
    await rm(temporary, { force: true });
  }
}
var delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function acquireLock(dataDir, key) {
  await secureDirectory(dataDir);
  const path = lockPath(dataDir, key);
  for (let attempt = 0;attempt < lockAttempts; attempt += 1) {
    try {
      await mkdir(path, { mode: 448 });
    } catch (error) {
      if (error.code !== "EEXIST")
        throw error;
      try {
        const info = await lstat(path);
        if (!info.isDirectory() || info.isSymbolicLink() || Date.now() - info.mtimeMs > staleLockMs) {
          await rm(path, { recursive: true, force: true });
          continue;
        }
      } catch (readError) {
        if (readError.code === "ENOENT")
          continue;
        throw readError;
      }
      await delay(lockRetryMs);
      continue;
    }
    try {
      await writeFile(join(path, "owner.json"), `${JSON.stringify({ version: 1, pid: process.pid, createdAt: Date.now() })}
`, {
        encoding: "utf8",
        flag: "wx",
        mode: 384
      });
      return path;
    } catch (error) {
      await rm(path, { recursive: true, force: true });
      throw error;
    }
  }
  throw new Error("timed out acquiring activator state lock");
}
async function withLock(dataDir, config, operation) {
  const key = activatorKey(config);
  const path = await acquireLock(dataDir, key);
  try {
    return await operation();
  } finally {
    await rm(path, { recursive: true, force: true });
  }
}
function initialState(config, now) {
  return {
    version: 1,
    intervalMs: config.intervalMs,
    watchdogMs: config.watchdogMs,
    startedAt: now,
    lastActivityAt: now,
    lastActivatedAt: now,
    nextDueAt: now + config.intervalMs,
    cycle: 0,
    phase: "waiting"
  };
}
async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT")
      return false;
    throw error;
  }
}
async function pruneActivatorState(dataDir, now = Date.now()) {
  const directory = await secureDirectory(dataDir);
  const candidates = [];
  for (const name of await readdir(directory)) {
    if (!name.endsWith(".json"))
      continue;
    const key = name.slice(0, -5);
    if (!keyPattern.test(key))
      continue;
    const path = join(directory, name);
    try {
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink()) {
        await rm(path, { force: true });
        continue;
      }
      candidates.push({ key, path, modifiedAt: info.mtimeMs });
    } catch (error) {
      if (error.code !== "ENOENT")
        throw error;
    }
  }
  candidates.sort((left, right) => left.modifiedAt - right.modifiedAt);
  const excess = Math.max(0, candidates.length - maxStateFiles);
  for (let index = 0;index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const stale = now - candidate.modifiedAt > staleStateMs;
    if (!stale && index >= excess)
      continue;
    if (await pathExists(lockPath(dataDir, candidate.key)))
      continue;
    await rm(candidate.path, { force: true });
  }
}
async function initializeActivator(dataDir, config, now = Date.now()) {
  await pruneActivatorState(dataDir, now);
  await withLock(dataDir, config, async () => {
    const current = await readState(dataDir, config);
    if (current) {
      await writeState(dataDir, config, {
        ...current,
        lastActivityAt: Math.max(current.lastActivityAt, now)
      });
      return;
    }
    await writeState(dataDir, config, initialState(config, now));
  });
}
async function touchActivator(dataDir, config, now = Date.now()) {
  await withLock(dataDir, config, async () => {
    const current = await readState(dataDir, config);
    const state = current ?? initialState(config, now);
    await writeState(dataDir, config, { ...state, lastActivityAt: now });
  });
}
async function observeActivatorStop(dataDir, config, now = Date.now(), allowStart = true) {
  return withLock(dataDir, config, async () => {
    const current = await readState(dataDir, config);
    if (!current) {
      await writeState(dataDir, config, initialState(config, now));
      return { kind: "none" };
    }
    if (current.phase === "reviewing") {
      const timedOut = now > (current.reviewDeadlineAt ?? 0);
      await writeState(dataDir, config, {
        ...current,
        phase: "waiting",
        lastActivityAt: now,
        lastActivatedAt: now,
        nextDueAt: now + config.intervalMs,
        reviewStartedAt: undefined,
        reviewDeadlineAt: undefined
      });
      return { kind: timedOut ? "timeout" : "completed", cycle: current.cycle };
    }
    if (!allowStart || now < current.nextDueAt)
      return { kind: "none" };
    const cycle = current.cycle + 1;
    await writeState(dataDir, config, {
      ...current,
      phase: "reviewing",
      cycle,
      lastActivityAt: now,
      reviewStartedAt: now,
      reviewDeadlineAt: now + config.watchdogMs
    });
    return { kind: "block", cycle };
  });
}
async function clearActivator(dataDir, config) {
  await withLock(dataDir, config, () => rm(statePath(dataDir, activatorKey(config)), { force: true }));
}

// plugins/riqor/hooks/paths.ts
function path(definition) {
  return Object.freeze({
    ...definition,
    curatedSkills: Object.freeze([...definition.curatedSkills]),
    evidence: Object.freeze([...definition.evidence]),
    guardrails: Object.freeze([...definition.guardrails]),
    automaticActions: Object.freeze([...definition.automaticActions]),
    requiresExplicitApproval: Object.freeze([...definition.requiresExplicitApproval])
  });
}
var harnessPaths = Object.freeze([
  path({
    id: "architecture-conformance",
    objective: "Prevent duplicate capabilities and architecture drift before non-trivial cross-module or contract changes",
    curatedSkills: ["architecture-guardian"],
    evidence: ["current architecture and reuse evidence", "post-change conformance result or an explicit not-applicable reason"],
    guardrails: ["review mode is the default", "never create a baseline, exception, or broader contract to make a check pass", "apply Ponytail YAGNI decision ladder: skip unnecessary code, reuse existing helpers, prefer 1-3 line diffs"],
    automaticActions: [],
    requiresExplicitApproval: ["enable strict architecture enforcement", "create or update a baseline", "add an architecture exception"]
  }),
  path({
    id: "controlled-evolution",
    objective: "Capture reusable workflow learning as a reviewed proposal without silently changing durable agent behavior",
    curatedSkills: ["agent-kernel-evolve"],
    evidence: ["repeated failure or correction evidence", "candidate playbook with acceptance and rollback criteria"],
    guardrails: ["proposal-only by default", "store no prompt, source content, credentials, or command output in durable memory"],
    automaticActions: [],
    requiresExplicitApproval: ["publish durable memory", "install lifecycle hooks", "start a daemon", "modify environment vault state"]
  }),
  path({
    id: "evidence-loop",
    objective: "Move from a reproduced symptom or acceptance criterion to fresh focused checks and an evidence-scoped completion claim",
    curatedSkills: [],
    evidence: ["reproduction or failing check before the change", "focused passing check after the final mutation"],
    guardrails: ["change one causal variable at a time", "never convert confidence, a diff, or prior agent output into proof", "apply Ponytail YAGNI decision ladder: skip unnecessary code, reuse existing helpers, prefer minimal diffs"],
    automaticActions: [],
    requiresExplicitApproval: ["expand scope beyond the reviewed request"]
  }),
  path({
    id: "independent-review",
    objective: "Review implementation against repository standards and the originating specification using isolated reviewer contexts",
    curatedSkills: ["code-review", "agency-multi-agent-systems-architect"],
    evidence: ["fixed review base and concrete specification", "findings reconciled against the real diff and fresh checks"],
    guardrails: ["reviewers do not inherit the author verdict", "reviewer output is a lead and not verification evidence"],
    automaticActions: [],
    requiresExplicitApproval: ["send repository content to an external model", "create more than two reviewer agents", "change code during review"]
  }),
  path({
    id: "privacy-minimization",
    objective: "Verify collection purpose, retention, deletion, and data minimization without copying personal data into harness artifacts",
    curatedSkills: ["agency-privacy-engineer"],
    evidence: ["field-level purpose and store inventory using metadata", "retention and deletion-path checks with synthetic records"],
    guardrails: ["use synthetic identifiers in fixtures and reports", "retain no personal data or free-text payloads in harness evidence"],
    automaticActions: [],
    requiresExplicitApproval: ["inspect live personal data", "execute deletion outside a disposable fixture", "contact a third-party processor"]
  }),
  path({
    id: "secure-change",
    objective: "Trace trust boundaries, authorization, and credential handling while keeping secret values outside prompts and artifacts",
    curatedSkills: ["agency-application-security-engineer", "agency-secrets-credential-hygiene-engineer"],
    evidence: ["attacker-controlled source to security-sensitive sink trace", "focused security regression check after the final mutation"],
    guardrails: ["prefer installed Codex Security tools for repository scans", "record secret locations and fingerprints only, never values"],
    automaticActions: [],
    requiresExplicitApproval: ["read live secret values", "rotate or revoke credentials", "scan an external target"]
  }),
  path({
    id: "performance-evidence",
    objective: "Compare performance under a fixed local or synthetic workload without turning production traffic into a benchmark fixture",
    curatedSkills: ["agency-performance-benchmarker"],
    evidence: ["reproducible workload, environment digest, and warm-up policy", "control and candidate latency, throughput, resource, and error measurements"],
    guardrails: ["use the same environment and workload for control and candidate", "correctness, safety, and resource ceilings override speed gains"],
    automaticActions: [],
    requiresExplicitApproval: ["run load against a shared or production target", "increase cost or resource limits", "install a new load generator"]
  }),
  path({
    id: "e2e-evidence",
    objective: "Validate critical user flows with isolated test data, condition-based waits, and traceable browser artifacts",
    curatedSkills: ["agency-test-automation-engineer"],
    evidence: ["deterministic user-flow assertion in a test environment", "failure trace, screenshot, or video when the check fails"],
    guardrails: ["never retry until green without diagnosing the flake", "use no production account, credential, or personal data"],
    automaticActions: [],
    requiresExplicitApproval: ["run against production", "create persistent external test data", "upload traces or screenshots externally"]
  }),
  path({
    id: "anti-overwhelm-focus",
    objective: "Break complex tasks into single-action micro-steps to reduce cognitive overhead and eliminate multi-turn drift",
    curatedSkills: [],
    evidence: ["single micro-step completion state", "focused empirical verification after each mutation"],
    guardrails: [
      "enforce exactly one atomic action per turn",
      "verify micro-step completion immediately after mutation",
      "pause execution before attempting multi-layer edits"
    ],
    automaticActions: [],
    requiresExplicitApproval: ["broaden scope to multiple subsystems"]
  })
]);
var pathById = new Map(harnessPaths.map((candidate) => [candidate.id, candidate]));
var profilePaths = {
  database: "architecture-conformance",
  debugging: "evidence-loop",
  review: "independent-review",
  security: "secure-change",
  ui: "e2e-evidence",
  research: "evidence-loop",
  privacy: "privacy-minimization",
  performance: "performance-evidence",
  evolution: "controlled-evolution",
  focus: "anti-overwhelm-focus",
  engineering: "architecture-conformance"
};
function harnessPathById(id) {
  const selected = pathById.get(id);
  if (!selected)
    throw new Error(`missing harness path ${id}`);
  return selected;
}
function harnessPathForProfile(profile) {
  return harnessPathById(profilePaths[profile]);
}

// plugins/riqor/hooks/router.ts
function decision(profile, skills, guidance) {
  const selectedPath = harnessPathForProfile(profile);
  return Object.freeze({
    profile,
    path: selectedPath,
    skills: Object.freeze([...new Set([...skills, ...selectedPath.curatedSkills])]),
    guidance
  });
}
var decisions = {
  database: decision("database", ["postgresql-table-design", "verification-before-completion"], "Inspect data contracts, tenant boundaries, constraints, indexes, migrations, reuse candidates, and query evidence before changing the schema"),
  debugging: decision("debugging", ["systematic-debugging", "test-driven-development", "verification-before-completion"], "Reproduce the symptom, trace the data flow to the root cause, change one variable, then prove the regression check fails before and passes after"),
  review: decision("review", ["verification-before-completion", "requesting-code-review"], "Fix the review base and specification, isolate reviewer contexts, inspect the real diff and callers, then verify accepted findings independently"),
  security: decision("security", ["security-scan", "threat-model", "verification-before-completion"], "Map the trust boundary, attacker-controlled inputs, authorization checks, secret locations, and failure modes before proposing a change"),
  ui: decision("ui", ["ui-review-loop", "test-driven-development", "verification-before-completion"], "Inspect the rendered flow, interaction states, accessibility, responsive behavior, and RTL or localization requirements with browser evidence"),
  research: decision("research", ["find-docs", "context7", "verification-before-completion"], "Use current primary documentation for unstable APIs, separate sourced facts from inference, and pin the exact version or date used"),
  privacy: decision("privacy", ["verification-before-completion"], "Map data fields to purpose, stores, retention, and deletion paths using metadata and synthetic records only"),
  performance: decision("performance", ["verification-before-completion"], "Freeze the local workload and environment, compare control and candidate distributions, and reject gains that regress correctness or resource ceilings"),
  evolution: decision("evolution", ["self-improvement-loop", "verification-before-completion"], "Capture a repeated evidence-backed pattern, draft a bounded playbook, evaluate it on holdouts, and leave publication for explicit review"),
  focus: decision("focus", ["verification-before-completion"], "Break down complex work into single-action micro-steps, verify each step immediately, and avoid multi-subsystem cognitive overload"),
  engineering: decision("engineering", ["evidence-engineering", "test-driven-development", "verification-before-completion"], "Define observable acceptance criteria, inspect existing patterns and reuse candidates, make the smallest coherent change, and run focused checks before project gates")
};
var patterns = [
  ["focus", /\b(focus|adhd|micro[- ]step|step[- ]by[- ]step|overwhelmed)\b/i],
  ["evolution", /\b(self[- ]?evolv|playbook|workflow synthesis|capture learning|agent learning|repeatable workflow)\w*/i],
  ["privacy", /\b(pii|personal data|data minimization|retention|consent|dsar|right to deletion|right to erasure|gdpr|privacy)\b/i],
  ["performance", /\b(benchmark|latency|throughput|load test|stress test|cpu profile|memory profile|core web vitals|requests per second|p95|p99)\b/i],
  ["database", /\b(postgres(?:ql)?|schema|migration|foreign key|index|constraint|tenant|row.level|rls|sql)\b/i],
  ["security", /\b(security|authorization|authentication|oauth|permission|privilege|injection|xss|csrf|ssrf|secret|token|vulnerab|threat)\w*/i],
  ["debugging", /\b(bug|failure|failing|broken|wrong|intermittent|flaky|root cause|regression|crash|timeout|deadlock|race condition)\b/i],
  ["ui", /\b(ui|ux|layout|react|component|css|responsive|accessibility|a11y|rtl|visual|browser|screen|frontend)\b/i],
  ["research", /\b(latest|current (?:api )?documentation|current docs|official (?:api )?documentation|docs|research|look up|search|verify online|context7)\b/i],
  ["review", /\b(review|audit|completion claim|verdict|code quality|pull request|\bpr\b)\b/i]
];
function classifyPrompt(prompt) {
  for (const [profile, pattern] of patterns) {
    if (pattern.test(prompt))
      return decisions[profile];
  }
  return decisions.engineering;
}
function routingContext(prompt) {
  const selected = classifyPrompt(prompt);
  return [
    "Codex Self Improvement route",
    `Profile: ${selected.profile}`,
    `Harness path: ${selected.path.id}`,
    `Relevant skills to inspect when installed: ${selected.skills.join(", ")}`,
    `Evidence target: ${selected.path.evidence[0]}`,
    selected.guidance,
    "Routing is not proof that a skill loaded, an action ran, or a check passed"
  ].join(`
`).slice(0, 900);
}

// plugins/riqor/hooks/state.ts
import { createHash as createHash2, randomUUID as randomUUID2 } from "node:crypto";
import { chmod as chmod2, lstat as lstat2, mkdir as mkdir2, readdir as readdir2, readFile as readFile2, rename as rename2, rm as rm2, rmdir, writeFile as writeFile2 } from "node:fs/promises";
import { join as join2 } from "node:path";
var mutationKinds = new Set(["code", "docs", "config", "unknown"]);
var keyPattern2 = /^[a-f0-9]{64}$/;
var lockRetryMs2 = 5;
var lockAttempts2 = 40;
function turnKey(input) {
  return createHash2("sha256").update(`${String(input.session_id ?? "unknown")}\x00${String(input.turn_id ?? "unknown")}`).digest("hex");
}
function statePath2(dataDir, key) {
  if (!keyPattern2.test(key))
    throw new Error("invalid state key");
  return join2(dataDir, `${key}.json`);
}
async function secureDataDir(dataDir) {
  await mkdir2(dataDir, { recursive: true, mode: 448 });
  const info = await lstat2(dataDir);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error("PLUGIN_DATA must be a real directory");
  await chmod2(dataDir, 448);
}
function lockPath2(dataDir, key) {
  if (!keyPattern2.test(key))
    throw new Error("invalid state key");
  return join2(dataDir, `.${key}.lock`);
}
var delay2 = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
var lockLeaseMs = 60000;
var lockHardExpiryMs = 24 * 60 * 60 * 1000;
function parseLockOwner(contents) {
  try {
    const owner = JSON.parse(contents);
    if (owner.version !== 1)
      return;
    if (typeof owner.token !== "string" || owner.token.length < 1 || owner.token.length > 128)
      return;
    if (!Number.isInteger(owner.pid) || Number(owner.pid) <= 0)
      return;
    if (!validTime2(owner.createdAt))
      return;
    return owner;
  } catch {
    return;
  }
}
async function readLockOwner(path2) {
  try {
    const info = await lstat2(path2);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 512)
      return;
    return parseLockOwner(await readFile2(path2, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT")
      return;
    throw error;
  }
}
function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}
async function recoverAbandonedLock(path2) {
  let directoryInfo;
  try {
    directoryInfo = await lstat2(path2);
  } catch (error) {
    if (error.code === "ENOENT")
      return true;
    throw error;
  }
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink())
    return false;
  const ownerPath = join2(path2, "owner.json");
  const observedOwner = await readLockOwner(ownerPath);
  const observedAt = observedOwner?.createdAt ?? directoryInfo.mtimeMs;
  const observedAge = Date.now() - observedAt;
  if (observedAge <= lockLeaseMs)
    return false;
  if (observedOwner && observedAge <= lockHardExpiryMs && processIsAlive(observedOwner.pid))
    return false;
  const recoveryPath = join2(path2, ".recovery.json");
  const recoveryToken = randomUUID2();
  const staleMarker = await readLockOwner(recoveryPath);
  if (staleMarker) {
    const markerAge = Date.now() - staleMarker.createdAt;
    if (markerAge > lockLeaseMs && (markerAge > lockHardExpiryMs || !processIsAlive(staleMarker.pid))) {
      const confirmedMarker = await readLockOwner(recoveryPath);
      if (confirmedMarker?.token === staleMarker.token)
        await rm2(recoveryPath, { force: true });
    }
  }
  try {
    await writeFile2(recoveryPath, `${JSON.stringify({ version: 1, token: recoveryToken, pid: process.pid, createdAt: Date.now() })}
`, {
      encoding: "utf8",
      flag: "wx",
      mode: 384
    });
  } catch (error) {
    if (error.code === "EEXIST")
      return false;
    if (error.code === "ENOENT")
      return true;
    throw error;
  }
  try {
    const currentOwner = await readLockOwner(ownerPath);
    if (observedOwner && currentOwner?.token !== observedOwner.token)
      return false;
    if (currentOwner) {
      const currentAge = Date.now() - currentOwner.createdAt;
      if (currentAge <= lockLeaseMs)
        return false;
      if (currentAge <= lockHardExpiryMs && processIsAlive(currentOwner.pid))
        return false;
    }
    await rm2(ownerPath, { force: true });
  } finally {
    const recovery = await readLockOwner(recoveryPath);
    if (recovery?.token === recoveryToken)
      await rm2(recoveryPath, { force: true });
  }
  try {
    await rmdir(path2);
    return true;
  } catch (error) {
    const code = error.code;
    if (code === "ENOENT")
      return true;
    if (code === "ENOTEMPTY" || code === "EEXIST")
      return false;
    throw error;
  }
}
async function acquireTurnLock(dataDir, key) {
  await secureDataDir(dataDir);
  const path2 = lockPath2(dataDir, key);
  const ownerPath = join2(path2, "owner.json");
  const token = randomUUID2();
  for (let attempt = 0;attempt < lockAttempts2; attempt += 1) {
    try {
      await mkdir2(path2, { mode: 448 });
      try {
        await writeFile2(ownerPath, `${JSON.stringify({ version: 1, token, pid: process.pid, createdAt: Date.now() })}
`, {
          encoding: "utf8",
          flag: "wx",
          mode: 384
        });
      } catch (error) {
        await rm2(ownerPath, { force: true });
        await rmdir(path2).catch(() => {
          return;
        });
        throw error;
      }
      return { path: path2, ownerPath, token };
    } catch (error) {
      const code = error.code;
      if (code !== "EEXIST")
        throw error;
      await recoverAbandonedLock(path2);
      await delay2(lockRetryMs2);
    }
  }
  throw new Error("timed out acquiring turn state lock");
}
async function releaseTurnLock(lock) {
  const owner = await readLockOwner(lock.ownerPath);
  if (owner?.token !== lock.token)
    return;
  await rm2(lock.ownerPath, { force: true });
  try {
    await rmdir(lock.path);
  } catch (error) {
    const code = error.code;
    if (code !== "ENOENT" && code !== "ENOTEMPTY" && code !== "EEXIST")
      throw error;
  }
}
async function withTurnLock(dataDir, key, operation) {
  const lock = await acquireTurnLock(dataDir, key);
  try {
    return await operation();
  } finally {
    await releaseTurnLock(lock);
  }
}
function validTime2(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function parseState2(contents) {
  try {
    const candidate = JSON.parse(contents);
    if (candidate.version !== 1)
      return;
    if (!mutationKinds.has(candidate.mutationKind))
      return;
    if (!validTime2(candidate.mutatedAt))
      return;
    if (candidate.verifiedAt !== undefined && !validTime2(candidate.verifiedAt))
      return;
    if (typeof candidate.blockedOnce !== "boolean")
      return;
    return candidate;
  } catch {
    return;
  }
}
async function readState2(dataDir, key) {
  const path2 = statePath2(dataDir, key);
  try {
    const info = await lstat2(path2);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 512) {
      await rm2(path2, { force: true });
      return;
    }
    const state = parseState2(await readFile2(path2, "utf8"));
    if (!state)
      await rm2(path2, { force: true });
    return state;
  } catch (error) {
    if (error.code === "ENOENT")
      return;
    throw error;
  }
}
async function writeState2(dataDir, key, state) {
  await secureDataDir(dataDir);
  const path2 = statePath2(dataDir, key);
  const temporary = join2(dataDir, `.${key}.${randomUUID2()}.tmp`);
  try {
    await writeFile2(temporary, `${JSON.stringify(state)}
`, { encoding: "utf8", flag: "wx", mode: 384 });
    await rename2(temporary, path2);
  } finally {
    await rm2(temporary, { force: true });
  }
}
async function markRuntimeSeen(dataDir, now = Date.now()) {
  await secureDataDir(dataDir);
  const path2 = join2(dataDir, "runtime.json");
  const temporary = join2(dataDir, `.runtime.${randomUUID2()}.tmp`);
  try {
    await writeFile2(temporary, `${JSON.stringify({ version: 1, event: "SessionStart", lastSeenAt: now })}
`, {
      encoding: "utf8",
      flag: "wx",
      mode: 384
    });
    await rename2(temporary, path2);
  } finally {
    await rm2(temporary, { force: true });
  }
}
async function recordMutation(dataDir, key, mutationKind, now = Date.now()) {
  if (!mutationKinds.has(mutationKind))
    throw new Error("invalid mutation kind");
  await withTurnLock(dataDir, key, () => writeState2(dataDir, key, { version: 1, mutationKind, mutatedAt: now, blockedOnce: false }));
}
function scopeCovers(mutationKind, scope) {
  return scope === "code" || mutationKind === "docs";
}
async function recordVerification(dataDir, key, now = Date.now(), scope = "code") {
  await withTurnLock(dataDir, key, async () => {
    const current = await readState2(dataDir, key);
    if (!current || !scopeCovers(current.mutationKind, scope))
      return;
    await writeState2(dataDir, key, { ...current, verifiedAt: now, blockedOnce: false });
  });
}
async function clearTurnUnlocked(dataDir, key) {
  await rm2(statePath2(dataDir, key), { force: true });
}
async function consumeEvidenceGate(dataDir, key) {
  return withTurnLock(dataDir, key, async () => {
    const current = await readState2(dataDir, key);
    if (!current)
      return { pending: false };
    if (current.verifiedAt !== undefined && current.verifiedAt >= current.mutatedAt) {
      await clearTurnUnlocked(dataDir, key);
      return { pending: false };
    }
    if (!current.blockedOnce) {
      await writeState2(dataDir, key, { ...current, blockedOnce: true });
      return { pending: true, firstBlock: true, mutationKind: current.mutationKind };
    }
    await clearTurnUnlocked(dataDir, key);
    return { pending: true, firstBlock: false, mutationKind: current.mutationKind };
  });
}
async function clearTurn(dataDir, key) {
  await withTurnLock(dataDir, key, () => clearTurnUnlocked(dataDir, key));
}
async function tryWithTurnLock(dataDir, key, operation) {
  try {
    return { acquired: true, value: await withTurnLock(dataDir, key, operation) };
  } catch (error) {
    if (error instanceof Error && error.message === "timed out acquiring turn state lock")
      return { acquired: false };
    throw error;
  }
}
async function inspectPruneCandidateUnlocked(dataDir, key, removeInvalid) {
  const path2 = statePath2(dataDir, key);
  try {
    const info = await lstat2(path2);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 512) {
      if (removeInvalid)
        await rm2(path2, { force: true });
      return;
    }
    const state = parseState2(await readFile2(path2, "utf8"));
    if (!state) {
      if (removeInvalid)
        await rm2(path2, { force: true });
      return;
    }
    return {
      key,
      path: path2,
      modifiedAt: Math.max(state.mutatedAt, state.verifiedAt ?? 0, info.mtimeMs)
    };
  } catch (error) {
    if (error.code === "ENOENT")
      return;
    throw error;
  }
}
async function pruneState(dataDir, now = Date.now(), limits = {}) {
  await secureDataDir(dataDir);
  const maxAgeMs = Math.max(0, limits.maxAgeMs ?? 14 * 24 * 60 * 60 * 1000);
  const maxFiles = Math.max(0, Math.floor(limits.maxFiles ?? 256));
  const candidates = [];
  for (const name of await readdir2(dataDir)) {
    const match = name.match(/^([a-f0-9]{64})\.json$/);
    if (!match)
      continue;
    const key = match[1];
    const attempt = await tryWithTurnLock(dataDir, key, async () => {
      const current = await inspectPruneCandidateUnlocked(dataDir, key, true);
      if (!current)
        return;
      if (now - current.modifiedAt > maxAgeMs) {
        await rm2(current.path, { force: true });
        return;
      }
      return current;
    });
    if (attempt.acquired && attempt.value)
      candidates.push(attempt.value);
  }
  candidates.sort((left, right) => right.modifiedAt - left.modifiedAt || left.key.localeCompare(right.key));
  let survivorRank = 0;
  for (const candidate of candidates) {
    const attempt = await tryWithTurnLock(dataDir, candidate.key, async () => {
      const current = await inspectPruneCandidateUnlocked(dataDir, candidate.key, true);
      if (!current)
        return false;
      if (now - current.modifiedAt > maxAgeMs) {
        await rm2(current.path, { force: true });
        return true;
      }
      if (current.modifiedAt !== candidate.modifiedAt) {
        survivorRank += 1;
        return false;
      }
      if (survivorRank < maxFiles) {
        survivorRank += 1;
        return false;
      }
      await rm2(current.path, { force: true });
      return true;
    });
    if (!attempt.acquired)
      survivorRank += 1;
  }
}

// plugins/riqor/hooks/io.ts
async function readStdinText(stream = process.stdin) {
  return new Promise((resolve, reject) => {
    let data = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      data += chunk;
    });
    stream.on("end", () => resolve(data));
    stream.on("error", (err) => reject(err));
  });
}
function isMainModule(metaUrl, argv1 = process.argv[1]) {
  if (!argv1)
    return false;
  try {
    const normalizedArgv = argv1.startsWith("file://") ? argv1 : `file://${argv1}`;
    return metaUrl === normalizedArgv || metaUrl === new URL(`file://${argv1}`).href;
  } catch {
    return false;
  }
}

// plugins/riqor/hooks/main.ts
var sessionContext = [
  "Riqor is a measured control plane around the model",
  "Define observable success, inspect the real flow, load only relevant skills, and make the smallest coherent change",
  "Fresh checks are required after observed mutations and all completion claims must name changed files, check outcomes, and unverified boundaries",
  "This plugin does not change model weights or prove AGI, determinism, or parity with another model"
].join(`
`);
var activatorCheckpointReason = [
  "Riqor activator checkpoint: restore the current task and observable success criteria from this conversation",
  "Inspect relevant repository evidence such as status, diff, tests, and recent tool results",
  "Summarize only work actually completed",
  "Identify scope drift, repeated work, stale assumptions, missing checks, and unsupported completion claims",
  "Correct the plan and continue with the smallest relevant next action",
  "Preserve the current approval policy and do not introduce destructive actions merely because this checkpoint ran",
  "Keep the checkpoint concise and do not repeat the full conversation"
].join(". ");
var mutationTools = /^(?:apply_patch|write_file|edit_file|edit_block|multi_replace|create_file|delete_file)$/i;
var shellTools = /^(?:bash|shell|exec_command|run_shell_command|start_process|interact_with_process)$/i;
var docsExtension = /\.(?:md|mdx|rst|txt|adoc)$/i;
var configExtension = /(?:^|\/)(?:Dockerfile|Makefile)$|\.(?:json|ya?ml|toml|ini|cfg|conf|lock)$/i;
var codeExtension = /\.(?:c|cc|cpp|cs|css|go|h|html|java|js|jsx|kt|kts|php|py|rb|rs|scss|sh|sql|swift|ts|tsx|vue|xml)$/i;
function object(value) {
  return value !== null && typeof value === "object" ? value : undefined;
}
function commandFrom(input) {
  const toolInput = object(input.tool_input);
  for (const key of ["command", "cmd", "script", "input"]) {
    if (typeof toolInput?.[key] === "string")
      return toolInput[key];
  }
  return "";
}
function filePathsFromPatch(command) {
  return command.split(`
`).flatMap((line) => {
    const match = line.match(/^\*\*\* (?:Add|Delete|Update) File: (.+)$/);
    return match ? [match[1].trim()] : [];
  });
}
function mutationKindForPaths(paths) {
  if (paths.length === 0)
    return "unknown";
  if (paths.every((path2) => docsExtension.test(path2)))
    return "docs";
  if (paths.some((path2) => codeExtension.test(path2)))
    return "code";
  if (paths.some((path2) => configExtension.test(path2)))
    return "config";
  return "unknown";
}
function shellMutates(command) {
  return /(?:^|[;&|]\s*)(?:rm|mv|cp|touch|mkdir|install)\b|\b(?:sed\s+-i|perl\s+-pi|git\s+(?:checkout|restore|reset|clean|apply)|npm\s+install|pnpm\s+(?:add|install)|yarn\s+add)\b|(?:^|\s)(?:cat|printf|echo)\b[^\n]*(?:>>?|\|\s*tee\b)/i.test(command);
}
function observedMutation(input) {
  const toolName = String(input.tool_name ?? "");
  const command = commandFrom(input);
  if (/^apply_patch$/i.test(toolName))
    return mutationKindForPaths(filePathsFromPatch(command));
  if (mutationTools.test(toolName))
    return mutationKindForPaths(filePathsFromPatch(command));
  if (shellTools.test(toolName) && shellMutates(command))
    return "unknown";
  return;
}
function structuredExitCode(response) {
  const value = object(response);
  for (const candidate of [value?.exit_code, value?.exitCode, object(value?.metadata)?.exit_code, object(value?.output)?.exit_code]) {
    if (typeof candidate === "number" && Number.isInteger(candidate))
      return candidate;
  }
  return;
}
function normalizeCheckCommand(command) {
  let normalized = command.trim();
  const scopedDirectory = normalized.match(/^cd\s+(?:"[^"]+"|'[^']+'|[^\s;&|]+)\s*&&\s*/);
  if (scopedDirectory)
    normalized = normalized.slice(scopedDirectory[0].length);
  normalized = normalized.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s;&|]+)\s+)+/, "");
  return normalized.trim();
}
function verificationScope(input) {
  if (!shellTools.test(String(input.tool_name ?? "")))
    return;
  if (structuredExitCode(input.tool_response) !== 0)
    return;
  const normalized = normalizeCheckCommand(commandFrom(input));
  if (!normalized || /(?:\|\||&&|[;&|`]|\$\()/.test(normalized))
    return;
  if (/^git\s+diff\s+--check(?:\s|$)/i.test(normalized) || /^(?:npx\s+)?markdownlint\b/i.test(normalized))
    return "docs";
  if (/^(?:bun\s+test\b|bun\s+run\s+[A-Za-z0-9:_-]*(?:build|check|lint|test|typecheck|validate)[A-Za-z0-9:_-]*\b)/i.test(normalized))
    return "code";
  if (/^(?:(?:npm|pnpm|yarn)\s+(?:run\s+)?[A-Za-z0-9:_-]*(?:build|check|lint|test|typecheck|validate)[A-Za-z0-9:_-]*\b)/i.test(normalized))
    return "code";
  if (/^(?:pytest\b|python\s+-m\s+pytest\b|cargo\s+test\b|go\s+test\b|dotnet\s+test\b|mvn\b[^\n]*\btest\b|gradle\S*\s+test\b|swift\s+test\b|xcodebuild\b[^\n]*\btest\b|phpunit\b)/i.test(normalized))
    return "code";
  return;
}
function promptFrom(input) {
  for (const key of ["prompt", "user_prompt", "userPrompt", "message"]) {
    if (typeof input[key] === "string")
      return input[key];
  }
  return "";
}
function evidenceReason(kind) {
  if (kind === "docs")
    return "Run a documentation check such as `git diff --check` or the project documentation linter";
  return "Run the smallest relevant test, build, lint, typecheck, or validation command with a structured zero exit";
}
async function boundedActivatorOperation(operation) {
  try {
    return await operation();
  } catch {
    return;
  }
}
function activatorStopOutput(result) {
  if (!result || result.kind === "none" || result.kind === "completed")
    return {};
  if (result.kind === "timeout") {
    return {
      systemMessage: `Riqor activator watchdog expired for checkpoint ${result.cycle}; the session was allowed to stop and the next interval was scheduled`
    };
  }
  return {
    decision: "block",
    reason: `${activatorCheckpointReason}. Checkpoint cycle: ${result.cycle}`
  };
}
async function handleHook(input, dataDir, environment = process.env, now = Date.now()) {
  const event = String(input.hook_event_name ?? "");
  const key = turnKey(input);
  const activator = readActivatorConfig(environment);
  const actionsFirst = environment.RIQOR_ACTIONS_FIRST === "1";
  const actionsFirstSuffix = actionsFirst ? `
⚡ Actions-First Mode: Provide executable code, diffs, or commands FIRST. Omit conversational fluff. Max 3 bullet points summary.
✂️ Ponytail YAGNI Filter: Apply 6-step filter (Skip -> Native -> Reuse -> Existing Dep -> One-liner -> Minimal diff) before creating code.` : "";
  if (event === "SessionStart") {
    await pruneState(dataDir);
    await markRuntimeSeen(dataDir, now);
    if (activator)
      await boundedActivatorOperation(() => initializeActivator(dataDir, activator, now));
    return { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: `${sessionContext}${actionsFirstSuffix}` } };
  }
  if (event === "UserPromptSubmit") {
    if (activator)
      await boundedActivatorOperation(() => touchActivator(dataDir, activator, now));
    return {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: `${routingContext(promptFrom(input))}${actionsFirstSuffix}`
      }
    };
  }
  if (event === "SubagentStart") {
    return {
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: "Work independently from the evidence and do not inherit a parent agent verdict without checking it"
      }
    };
  }
  if (event === "PostToolUse") {
    const mutationKind = observedMutation(input);
    if (mutationKind)
      await recordMutation(dataDir, key, mutationKind, now);
    else {
      const scope = verificationScope(input);
      if (scope)
        await recordVerification(dataDir, key, now, scope);
    }
    if (activator)
      await boundedActivatorOperation(() => touchActivator(dataDir, activator, now));
    return {};
  }
  if (event === "Stop") {
    if (input.stop_hook_active === true) {
      await clearTurn(dataDir, key);
      if (!activator)
        return {};
      const result2 = await boundedActivatorOperation(() => observeActivatorStop(dataDir, activator, now, false));
      return activatorStopOutput(result2);
    }
    const gate = await consumeEvidenceGate(dataDir, key);
    if (gate.pending) {
      if (gate.firstBlock) {
        return {
          decision: "block",
          reason: `Riqor evidence gate: a ${gate.mutationKind} mutation was observed after the last accepted check. ${evidenceReason(gate.mutationKind)}. Then finish with changed files, exact check outcomes, and anything not verified`
        };
      }
      return {
        systemMessage: "Riqor allowed completion after one evidence reminder and cleared its pending state. Any missing check must be disclosed as not verified"
      };
    }
    if (!activator)
      return {};
    const result = await boundedActivatorOperation(() => observeActivatorStop(dataDir, activator, now, true));
    return activatorStopOutput(result);
  }
  if (event === "SessionEnd") {
    await clearTurn(dataDir, key);
    if (activator)
      await boundedActivatorOperation(() => clearActivator(dataDir, activator));
  }
  return {};
}
if (isMainModule(import.meta.url)) {
  try {
    const dataDir = process.env.PLUGIN_DATA;
    if (!dataDir)
      throw new Error("PLUGIN_DATA is required");
    const rawText = typeof Bun !== "undefined" && Bun.stdin ? await Bun.stdin.text() : await readStdinText();
    const input = JSON.parse(rawText);
    const output = await handleHook(input, dataDir);
    if (Object.keys(output).length > 0)
      process.stdout.write(JSON.stringify(output));
  } catch {
    process.stdout.write(JSON.stringify({ systemMessage: "Riqor skipped a local hook because bounded state was unavailable" }));
  }
}
export {
  handleHook
};
