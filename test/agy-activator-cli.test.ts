import { describe, expect, test } from "bun:test";
import {
  buildActivatorEnvironment,
  buildAgyEnvironment,
  parseActivatorDuration,
  parseAgyActivatorArgs,
} from "../src/harness-cli";

describe("riqor agy activator CLI", () => {
  test("uses bounded recommended defaults when explicitly enabled", () => {
    expect(parseAgyActivatorArgs(["--activator", "--model", "gemini-3.6-flash"])).toEqual({
      agyArgs: ["--model", "gemini-3.6-flash"],
      activator: { enabled: true, intervalMs: 15 * 60_000, watchdogMs: 3 * 60_000 },
    });
  });

  test("parses durations and preserves AGY argument order", () => {
    expect(parseAgyActivatorArgs([
      "--activator-watchdog=45s",
      "--activator",
      "--activator-interval", "20m",
      "run", "task-id",
    ])).toEqual({
      agyArgs: ["run", "task-id"],
      activator: { enabled: true, intervalMs: 20 * 60_000, watchdogMs: 45_000 },
    });
  });

  test("stops interpreting Riqor flags after the argument separator", () => {
    expect(parseAgyActivatorArgs(["--activator", "--", "--activator-interval", "2m"])).toEqual({
      agyArgs: ["--", "--activator-interval", "2m"],
      activator: { enabled: true, intervalMs: 15 * 60_000, watchdogMs: 3 * 60_000 },
    });
  });

  test("rejects timing flags unless activator is enabled", () => {
    expect(() => parseAgyActivatorArgs(["--activator-interval", "5m"])).toThrow("require --activator");
  });

  test("rejects missing, malformed, and out-of-range durations", () => {
    expect(() => parseAgyActivatorArgs(["--activator", "--activator-interval"])).toThrow("requires a duration");
    expect(() => parseAgyActivatorArgs(["--activator", "--activator-interval", "soon"])).toThrow("invalid activator interval");
    expect(() => parseAgyActivatorArgs(["--activator", "--activator-interval", "30s"])).toThrow("between 1m and 24h");
    expect(() => parseAgyActivatorArgs(["--activator", "--activator-watchdog", "5s"])).toThrow("between 10s and 30m");
    expect(() => parseActivatorDuration("9007199254740992h", 1, Number.MAX_SAFE_INTEGER, "test")).toThrow("invalid test");
  });

  test("builds content-free managed-session AGY environment", () => {
    const env = buildAgyEnvironment(
      { PATH: "/usr/bin" },
      { enabled: true, intervalMs: 60_000, watchdogMs: 10_000 },
      "2ef73b51-52d7-45c0-974f-784bcfb8ab79",
    );
    expect(env).toEqual({
      PATH: "/usr/bin",
      AGY_SELF_IMPROVEMENT_ENABLED: "1",
      ANTIGRAVITY_HARNESS_ENABLED: "1",
      AGY_HARNESS_SURFACE: "agy-harness",
      RIQOR_ACTIVATOR_ENABLED: "1",
      RIQOR_ACTIVATOR_SESSION: "2ef73b51-52d7-45c0-974f-784bcfb8ab79",
      RIQOR_ACTIVATOR_INTERVAL_MS: "60000",
      RIQOR_ACTIVATOR_WATCHDOG_MS: "10000",
    });
    expect(JSON.stringify(env)).not.toContain("prompt");
  });
});
