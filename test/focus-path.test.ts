import { describe, expect, test } from "bun:test";
import { harnessPaths, harnessPathForProfile } from "../plugins/riqor/hooks/paths";
import { classifyPrompt } from "../plugins/riqor/hooks/router";

describe("Anti-Overwhelm Focus Path (i-have-adhd integration)", () => {
  test("defines anti-overwhelm-focus path with micro-step guardrails", () => {
    const focusPath = harnessPaths.find((p) => p.id === "anti-overwhelm-focus");
    expect(focusPath).toBeDefined();
    expect(focusPath?.objective).toContain("micro-step");
    expect(focusPath?.guardrails).toEqual(
      expect.arrayContaining([
        "enforce exactly one atomic action per turn",
        "verify micro-step completion immediately after mutation",
      ]),
    );
  });

  test("maps focus profile to anti-overwhelm-focus path", () => {
    const path = harnessPathForProfile("focus");
    expect(path.id).toBe("anti-overwhelm-focus");
  });

  test("classifies focus, adhd, micro-step, and overwhelmed prompts correctly", () => {
    expect(classifyPrompt("please execute this step-by-step with focus").profile).toBe("focus");
    expect(classifyPrompt("I have adhd and need micro-step execution").profile).toBe("focus");
    expect(classifyPrompt("I feel overwhelmed by this large refactor").profile).toBe("focus");
  });
});
