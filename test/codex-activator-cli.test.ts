import { describe, expect, test } from "bun:test";
import {
  buildActivatorEnvironment,
  buildCodexEnvironment,
  parseActivatorDuration,
  parseCodexActivatorArgs,
} from "../src/harness-cli";

describe("riqor codex activator CLI", () => {
  test("uses bounded recommended defaults when explicitly enabled", () => {
    expect(parseCodexActivatorArgs(["--activator", "--model", "gpt-5.6-codex"])).toEqual({
      codexArgs: ["--model", "gpt-5.6-codex"],
      activator: { enabled: true, intervalMs: 15 * 60_000, watchdogMs: 3 * 60_000 },
    });
  });

  test("parses durations and preserves Codex argument order", () => {
    expect(parseCodexActivatorArgs([
      "--sandbox", "workspace-write",
      "--activator-watchdog=45s",
      "--activator",
      "--activator-interval", "20m",
      "resume", "session-id",
    ])).toEqual({
      codexArgs: ["--sandbox", "workspace-write", "resume", "session-id"],
      activator: { enabled: true, intervalMs: 20 * 60_000, watchdogMs: 45_000 },
    });
  });

  test("stops interpreting Riqor flags after the argument separator", () => {
    expect(parseCodexActivatorArgs(["--activator", "--", "--activator-interval", "2m"])).toEqual({
      codexArgs: ["--", "--activator-interval", "2m"],
      activator: { enabled: true, intervalMs: 15 * 60_000, watchdogMs: 3 * 60_000 },
    });
  });

  test("rejects timing flags unless activator is enabled", () => {
    expect(() => parseCodexActivatorArgs(["--activator-interval", "5m"])).toThrow("requires --activator");
  });

  test("rejects missing, malformed, and out-of-range durations", () => {
    expect(() => parseCodexActivatorArgs(["--activator", "--activator-interval"])).toThrow("requires a duration");
    expect(() => parseCodexActivatorArgs(["--activator", "--activator-interval", "soon"])).toThrow("invalid activator interval");
    expect(() => parseCodexActivatorArgs(["--activator", "--activator-interval", "30s"])).toThrow("between 1m and 24h");
    expect(() => parseCodexActivatorArgs(["--activator", "--activator-watchdog", "5s"])).toThrow("between 10s and 30m");
    expect(() => parseActivatorDuration("9007199254740992h", 1, Number.MAX_SAFE_INTEGER, "test")).toThrow("invalid test");
  });

  test("builds content-free managed-session environment", () => {
    const env = buildActivatorEnvironment(
      { enabled: true, intervalMs: 60_000, watchdogMs: 10_000 },
      "2ef73b51-52d7-45c0-974f-784bcfb8ab79",
    );
    expect(env).toEqual({
      RIQOR_ACTIVATOR_ENABLED: "1",
      RIQOR_ACTIVATOR_SESSION: "2ef73b51-52d7-45c0-974f-784bcfb8ab79",
      RIQOR_ACTIVATOR_INTERVAL_MS: "60000",
      RIQOR_ACTIVATOR_WATCHDOG_MS: "10000",
    });
    expect(JSON.stringify(env)).not.toContain("prompt");
  });

  test("removes inherited activator values unless this command opts in", () => {
    const inherited = {
      PATH: "/bin",
      RIQOR_ACTIVATOR_ENABLED: "1",
      RIQOR_ACTIVATOR_SESSION: "old-session",
      RIQOR_ACTIVATOR_INTERVAL_MS: "1",
      RIQOR_ACTIVATOR_WATCHDOG_MS: "1",
    };

    expect(buildCodexEnvironment(inherited)).toEqual({
      PATH: "/bin",
      CODEX_SELF_IMPROVEMENT_ENABLED: "1",
      CODEX_SELF_IMPROVEMENT_SURFACE: "codex-harness",
    });

    expect(buildCodexEnvironment(
      inherited,
      { enabled: true, intervalMs: 60_000, watchdogMs: 10_000 },
      "2ef73b51-52d7-45c0-974f-784bcfb8ab79",
    )).toMatchObject({
      RIQOR_ACTIVATOR_ENABLED: "1",
      RIQOR_ACTIVATOR_SESSION: "2ef73b51-52d7-45c0-974f-784bcfb8ab79",
      RIQOR_ACTIVATOR_INTERVAL_MS: "60000",
      RIQOR_ACTIVATOR_WATCHDOG_MS: "10000",
    });
  });
});
