import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { autoHealEnvironment, repairShellMarkers } from "../src/doctor-auto-healer.js";

describe("DoctorAutoHealer (inspired by millionco/react-doctor)", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = join(tmpdir(), `riqor-healer-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    mkdirSync(tempHome, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true });
    }
  });

  test("repairs malformed shell markers in .zshenv while creating backup", () => {
    const zshenvPath = join(tempHome, ".zshenv");
    const corruptedContent = `
# UNRELATED CONFIG
export FOO="bar"
# BEGIN RIQOR MANAGED BLOCK (CORRUPTED)
export PATH="/tmp/fake:$PATH"
# MISSING END MARKER
`;
    writeFileSync(zshenvPath, corruptedContent, "utf8");

    const repairResult = repairShellMarkers(zshenvPath);

    expect(repairResult.success).toBe(true);
    expect(repairResult.backupCreated).toBe(true);

    const repairedContent = readFileSync(zshenvPath, "utf8");
    expect(repairedContent).toContain("# BEGIN RIQOR MANAGED BLOCK");
    expect(repairedContent).toContain("# END RIQOR MANAGED BLOCK");
    expect(repairedContent).toContain('export FOO="bar"');
  });

  test("runs autoHealEnvironment and reports applied healing actions", () => {
    const zshenvPath = join(tempHome, ".zshenv");
    writeFileSync(zshenvPath, "export PATH=$PATH\n", "utf8");

    const healResult = autoHealEnvironment({
      targetHome: tempHome,
      zshenvPath,
    });

    expect(healResult.healed).toBe(true);
    expect(healResult.actionsApplied.length).toBeGreaterThan(0);
    expect(healResult.actionsApplied.some((a) => a.category === "shell-integration")).toBe(true);
  });
});
