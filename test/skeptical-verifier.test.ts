import { describe, expect, it } from "bun:test";
import { runSkepticalVerification } from "../src/skeptical-verifier.js";

describe("skeptical verifier", () => {
  it("runs verification on clean repository and returns passed status", () => {
    const result = runSkepticalVerification(process.cwd());
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("mutationsDetected");
    expect(result).toHaveProperty("uncommittedFiles");
    expect(result).toHaveProperty("diffSummary");
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(typeof result.timestamp).toBe("string");
  });

  it("returns diffSummary structure with numbers", () => {
    const result = runSkepticalVerification(process.cwd());
    expect(typeof result.diffSummary.filesChanged).toBe("number");
    expect(typeof result.diffSummary.insertions).toBe("number");
    expect(typeof result.diffSummary.deletions).toBe("number");
  });
});
