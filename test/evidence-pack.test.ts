import { expect, test, describe } from "bun:test";
import { generateEvidencePack, verifyEvidencePackIntegrity, type EvidencePackInput } from "../src/evidence-pack.js";

describe("EvidencePack (harness inspired verification bundle)", () => {
  const sampleInput: EvidencePackInput = {
    sessionId: "sess-99",
    repository: "imMamdouhaboammar/riqor",
    commitSha: "abc123def456",
    passRate: 1.0,
    testsExecuted: 350,
    testsPassed: 350,
    durationMs: 4500,
    diagnosticsCount: 0,
    securityScanPassed: true,
    modifiedFiles: ["src/evidence-pack.ts", "test/evidence-pack.test.ts"],
  };

  test("generates evidence pack with stable integrity hash", () => {
    const pack = generateEvidencePack(sampleInput);

    expect(pack.metadata.sessionId).toBe("sess-99");
    expect(pack.metrics.passRate).toBe(1.0);
    expect(pack.integrityHash).toBeDefined();
    expect(pack.integrityHash.length).toBe(64); // SHA-256 hex string

    const isIntegrityValid = verifyEvidencePackIntegrity(pack);
    expect(isIntegrityValid).toBe(true);
  });

  test("detects tampering if evidence pack contents are altered", () => {
    const pack = generateEvidencePack(sampleInput);

    // Tamper with passRate
    const tamperedPack = { ...pack, metrics: { ...pack.metrics, passRate: 0.5 } };
    const isIntegrityValid = verifyEvidencePackIntegrity(tamperedPack);
    expect(isIntegrityValid).toBe(false);
  });

  test("serializes evidence pack into TOON scannable format", () => {
    const pack = generateEvidencePack(sampleInput);
    expect(pack.toonRepresentation).toContain("SESSION: sess-99");
    expect(pack.toonRepresentation).toContain("PASS_RATE: 1.00");
    expect(pack.toonRepresentation).toContain("SECURITY_SCAN: PASSED");
  });
});
