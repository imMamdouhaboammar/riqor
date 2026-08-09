import { afterEach, describe, expect, test } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  adoptionReport,
  exportAdoptionReceipt,
  formatAdoptionReport,
  readAdoptionLedger,
  recordAdoptionEvent,
  resetAdoption,
} from "../src/adoption";

const roots: string[] = [];
async function stateDir() { const root = await mkdtemp(join(tmpdir(), "riqor-adoption-")); roots.push(root); return root; }
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("offline adoption ledger", () => {
  test("records only coarse local counters across active UTC days and versions", async () => {
    const root = await stateDir();
    const day1 = Date.parse("2026-08-09T10:00:00Z");
    const day2 = Date.parse("2026-08-10T11:00:00Z");
    await recordAdoptionEvent({ stateDir: root, version: "0.2.4", kind: "install", now: day1 });
    await recordAdoptionEvent({ stateDir: root, version: "0.2.4", kind: "session", now: day1 + 60_000 });
    await recordAdoptionEvent({ stateDir: root, version: "0.2.4", kind: "session", now: day1 + 120_000 });
    await recordAdoptionEvent({ stateDir: root, version: "0.2.5", kind: "agentStart", now: day2 });
    await recordAdoptionEvent({ stateDir: root, version: "0.2.5", kind: "skill", skill: "engineering-code-reviewer", now: day2 + 60_000 });
    const ledger = await readAdoptionLedger(root);
    expect(ledger).toMatchObject({
      schemaVersion: 1,
      firstSeenVersion: "0.2.4",
      currentVersion: "0.2.5",
      activeDayCount: 2,
      lastActiveDay: "2026-08-10",
      sessions: 2,
      agentStarts: 1,
      skillInvocations: { "engineering-code-reviewer": 1 },
      versionsSeen: ["0.2.4", "0.2.5"],
    });
    expect(ledger?.installationId).toMatch(/^[0-9a-f-]{36}$/i);
    const serialized = JSON.stringify(ledger);
    for (const forbidden of ["prompt", "transcript", "sourceContent", "repository", "commandOutput", "environment", "credential", "cookie", "authToken", "ipAddress", "hardwareId"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test("reports Marketplace installs as unknown and formats a useful local summary", async () => {
    const root = await stateDir();
    await recordAdoptionEvent({ stateDir: root, version: "0.2.4", kind: "session", now: Date.parse("2026-08-09T10:00:00Z") });
    const report = await adoptionReport(root);
    expect(report).toMatchObject({ observed: true, marketplaceInstalls: "unknown", sessions: 1, activeDays: 1 });
    const text = formatAdoptionReport(report);
    expect(text).toContain("Marketplace installs  unknown");
    expect(text).toContain("Local sessions        1");
    expect(text).toContain("No network telemetry is sent by Riqor");
  });

  test("exports a bucketed receipt without the local installation identifier", async () => {
    const root = await stateDir();
    const output = join(root, "receipt.json");
    const now = Date.parse("2026-08-09T10:00:00Z");
    for (let i = 0; i < 23; i++) await recordAdoptionEvent({ stateDir: root, version: "0.2.4", kind: "session", now: now + i * 1_000 });
    for (let i = 0; i < 7; i++) await recordAdoptionEvent({ stateDir: root, version: "0.2.4", kind: "agentStart", now: now + i * 1_000 });
    for (let i = 0; i < 3; i++) await recordAdoptionEvent({ stateDir: root, version: "0.2.4", kind: "skill", skill: "reviewer", now: now + i * 1_000 });
    const receipt = await exportAdoptionReceipt({ stateDir: root, outputPath: output });
    expect(receipt).toMatchObject({
      schemaVersion: 1,
      product: "riqor",
      currentVersion: "0.2.4",
      firstSeenMonth: "2026-08",
      sessionsBucket: "20-49",
      agentStartsBucket: "5-19",
      skillInvocationsBucket: "1-4",
      topSkills: ["reviewer"],
    });
    expect(receipt).not.toHaveProperty("installationId");
    const raw = await readFile(output, "utf8");
    expect(raw).not.toContain("installationId");
  });

  test("contains no remote telemetry primitives", async () => {
    const repositoryRoot = resolve(import.meta.dir, "..", "..", "..");
    const sources = await Promise.all([
      readFile(join(repositoryRoot, "packages", "riqor", "src", "adoption.ts"), "utf8"),
      readFile(join(repositoryRoot, "plugins", "riqor", "hooks", "adoption.ts"), "utf8"),
    ]);
    const code = sources.join("\n");
    for (const primitive of ["fetch(", "node:http", "node:https", "XMLHttpRequest", "WebSocket(", "sendBeacon("]) {
      expect(code).not.toContain(primitive);
    }
  });

  test("reset removes only the adoption ledger", async () => {
    const root = await stateDir();
    await recordAdoptionEvent({ stateDir: root, version: "0.2.4", kind: "install", now: Date.now() });
    await resetAdoption(root);
    expect(await readAdoptionLedger(root)).toBeUndefined();
    await access(root);
    expect(true).toBe(true);
  });
});
