import { describe, expect, test } from "bun:test";
import { scanContentForSecrets, scanFilesForSecrets } from "../src/secret-scanner.js";

function openAiFixture(): string {
  return ["sk-proj-", "1234567890", "abcdefghij", "klmnopqrst", "uvwxyz1234", "567890abcd", "ef"].join("");
}

function githubFixture(): string {
  return ["ghp_", "1234567890", "abcdefghij", "klmnopqrst", "uvwxyz1234"].join("");
}

describe("SecretScanner (inspired by trufflehog)", () => {
  test("detects explicit API keys and tokens", () => {
    const awsKey = ["AKIA", "IOSFODNN7EXAMPLE"].join("");
    const openaiKey = openAiFixture();
    const githubToken = githubFixture();
    const codeWithSecrets = `
      const awsKey = "${awsKey}";
      const openaiKey = "${openaiKey}";
      const githubToken = "${githubToken}";
    `;

    const result = scanContentForSecrets(codeWithSecrets, "config/keys.ts");

    expect(result.hasSecrets).toBe(true);
    expect(result.findings.length).toBeGreaterThanOrEqual(3);

    const rulesDetected = result.findings.map((finding) => finding.ruleId);
    expect(rulesDetected).toContain("aws-access-key");
    expect(rulesDetected).toContain("openai-api-key");
    expect(rulesDetected).toContain("github-pat");
  });

  test("detects high-entropy secret strings", () => {
    const entropyFixture = ["xK9#mQ2$pL7!", "vW4&zN8*jF1@", "bV5"].join("");
    const codeWithEntropy = `const DB_PASSWORD = "${entropyFixture}";`;

    const result = scanContentForSecrets(codeWithEntropy, "src/db.ts");

    expect(result.hasSecrets).toBe(true);
    expect(result.findings.some((finding) => finding.ruleId === "high-entropy-secret")).toBe(true);
  });

  test("passes clean code with no secrets", () => {
    const cleanCode = `
      export function add(a: number, b: number): number {
        return a + b;
      }
    `;

    const result = scanContentForSecrets(cleanCode, "src/math.ts");

    expect(result.hasSecrets).toBe(false);
    expect(result.findings.length).toBe(0);
  });

  test("masks detected secrets in findings to prevent logging leaks", () => {
    const fakeKey = openAiFixture();
    const code = `const key = "${fakeKey}";`;
    const result = scanContentForSecrets(code, "test.ts");

    expect(result.findings.length).toBeGreaterThan(0);
    const finding = result.findings[0];
    expect(finding.maskedSecret).not.toContain("1234567890abcdef");
    expect(finding.maskedSecret).toContain("...");
  });

  test("scans multiple files in batch", () => {
    const fakeToken = githubFixture();
    const files = [
      { path: "src/clean.ts", content: "const x = 1;" },
      { path: "src/secret.ts", content: `const token = "${fakeToken}";` },
    ];

    const batchResult = scanFilesForSecrets(files);
    expect(batchResult.hasSecrets).toBe(true);
    expect(batchResult.scannedFileCount).toBe(2);
    expect(batchResult.findings.length).toBe(1);
    expect(batchResult.findings[0].filePath).toBe("src/secret.ts");
  });

  test("does not flag ordinary hashes, paths, or commands as high-entropy secrets", () => {
    const clean = `
      const digest = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const command = "codex-harness <version|status|doctor|paths-list>";
      const path = "/Users/example/Documents/project/generated-artifact.json";
      const surface = "antigravity-2.0-chat-canvas-and-auxiliary-pane";
      const pluginSurface = "native-plugin-shared-CODEX_HOME";
    `;
    const result = scanContentForSecrets(clean, "src/metadata.ts");
    expect(result.hasSecrets).toBe(false);
  });
});
