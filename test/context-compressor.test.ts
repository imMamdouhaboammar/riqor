import { describe, test, expect } from "bun:test";
import { compressContext, CompressionMode } from "../src/context-compressor";

describe("State-Adaptive Context Compressor (Caveman & RTK Pattern)", () => {
  const sampleVerbosePrompt = `
=== SYSTEM DIRECTIVES ===
You are an AI assistant. Please follow all guidelines carefully.
Make sure you never introduce bugs into the codebase.
Always format your answers nicely using Markdown syntax.

=== CONTEXT DATA ===
File: src/index.ts
Line 1: console.log("Hello World");
Line 2: console.log("Verbose output");

=== REPETITIVE LOGS ===
[INFO] 2026-08-09 10:00:00 - Server starting on port 3000...
[INFO] 2026-08-09 10:00:01 - Loading plugins...
[INFO] 2026-08-09 10:00:02 - Plugin A loaded.
[INFO] 2026-08-09 10:00:03 - Plugin B loaded.
[INFO] 2026-08-09 10:00:04 - Server ready.

=== EVIDENCE REQUIREMENT ===
MUST preserve safety check: status = VERIFIED.
`;

  test("returns original text when mode is Full", () => {
    const result = compressContext(sampleVerbosePrompt, "Full");
    expect(result.compressedText).toBe(sampleVerbosePrompt);
    expect(result.compressionRatio).toBe(1.0);
  });

  test("compresses repetitive system and log context in Compact mode while preserving evidence", () => {
    const result = compressContext(sampleVerbosePrompt, "Compact");

    expect(result.compressionRatio).toBeLessThan(1.0);
    expect(result.compressedText).toContain("EVIDENCE REQUIREMENT");
    expect(result.compressedText).toContain("status = VERIFIED");
    expect(result.compressedText).not.toContain("Plugin A loaded");
  });

  test("aggressively truncates redundant whitespace and boilerplate in Tersest mode", () => {
    const result = compressContext(sampleVerbosePrompt, "Tersest");

    expect(result.compressionRatio).toBeLessThan(0.7);
    expect(result.compressedText).toContain("status = VERIFIED");
    expect(result.compressedText).not.toContain("Please follow all guidelines carefully");
  });
});
