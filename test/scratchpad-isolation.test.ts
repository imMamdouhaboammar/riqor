import { describe, expect, it } from "bun:test";
import {
  listActiveSessions,
  readScratchpad,
  recordHeartbeat,
  writeScratchpadEntry,
} from "../src/scratchpad-isolation.js";

describe("scratchpad and heartbeat isolation", () => {
  it("records session heartbeat and lists active sessions", () => {
    const sessionId = `session-${Date.now()}`;
    const hb = recordHeartbeat(sessionId, process.cwd());
    expect(hb.sessionId).toBe(sessionId);
    expect(hb.active).toBe(true);

    const active = listActiveSessions(process.cwd());
    expect(active.some((s) => s.sessionId === sessionId)).toBe(true);
  });

  it("writes and reads per-session scratchpad entries", () => {
    const sessionId = `session-scratch-${Date.now()}`;
    writeScratchpadEntry(sessionId, "goal", "build riqor v0.1.1", process.cwd());

    const scratchpad = readScratchpad(sessionId, process.cwd());
    expect(scratchpad).toHaveProperty("goal");
    expect(scratchpad.goal.value).toBe("build riqor v0.1.1");
  });
});
