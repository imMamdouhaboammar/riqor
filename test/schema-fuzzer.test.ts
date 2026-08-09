import { describe, expect, test } from "bun:test";
import { SchemaContractFuzzer, type FuzzOptions, type SchemaDefinition } from "../src/assurance/schema-fuzzer";

describe("SchemaContractFuzzer (schemathesis-inspired property fuzzer)", () => {
  const sampleTaskSchema: SchemaDefinition = {
    type: "object",
    required: ["id", "action"],
    properties: {
      id: { type: "string" },
      action: { type: "string" },
      retryCount: { type: "number", minimum: 0, maximum: 10 },
      isDaemon: { type: "boolean" },
    },
  };

  test("generates random valid payload samples conforming to JSON schema", () => {
    const fuzzer = new SchemaContractFuzzer(sampleTaskSchema);
    const validSamples = fuzzer.generateValidPayloads({ seed: 42, count: 5 });

    expect(validSamples.length).toBe(5);
    for (const sample of validSamples) {
      expect(typeof sample.id).toBe("string");
      expect(typeof sample.action).toBe("string");
      if ("retryCount" in sample) {
        expect(typeof sample.retryCount).toBe("number");
        expect(sample.retryCount as number).toBeGreaterThanOrEqual(0);
        expect(sample.retryCount as number).toBeLessThanOrEqual(10);
      }
    }
  });

  test("generates boundary and hostile invalid payload samples for negative testing", () => {
    const fuzzer = new SchemaContractFuzzer(sampleTaskSchema);
    const hostilePayloads = fuzzer.generateHostilePayloads({ seed: 123, count: 4 });

    expect(hostilePayloads.length).toBe(4);
    // At least some payloads should violate requirements (e.g. missing required field, type mismatch, out of bounds)
    const hasViolation = hostilePayloads.some((p) => {
      const isMissingId = !("id" in p);
      const isBadType = typeof p.retryCount === "string" || (typeof p.retryCount === "number" && p.retryCount < 0);
      return isMissingId || isBadType;
    });

    expect(hasViolation).toBe(true);
  });

  test("executes contract fuzzing loop against target invariant handler without crashing", () => {
    const fuzzer = new SchemaContractFuzzer(sampleTaskSchema);

    // Target handler that validates invariants and fails gracefully on invalid inputs
    const handler = (input: unknown): boolean => {
      if (!input || typeof input !== "object") return false;
      const record = input as Record<string, unknown>;
      if (typeof record.id !== "string" || typeof record.action !== "string") return false;
      if ("retryCount" in record && (typeof record.retryCount !== "number" || record.retryCount < 0 || record.retryCount > 10)) {
        return false;
      }
      return true;
    };

    const result = fuzzer.fuzzContract(handler, { iterations: 20, seed: 99 });
    expect(result.totalIterations).toBe(20);
    expect(result.validCount).toBeGreaterThan(0);
    expect(result.unhandledErrors.length).toBe(0);
  });
});
