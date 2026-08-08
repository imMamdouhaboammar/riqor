import { describe, expect, it } from "bun:test";
import {
  addCrystallizedRule,
  formatCrystallizedRulesHighDensity,
  loadCrystallizedRules,
} from "../src/crystallized-rules.js";

describe("crystallized rules engine", () => {
  it("loads default rules when no local rules file exists", () => {
    const rules = loadCrystallizedRules(process.cwd());
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
  });

  it("formats rules into high density text", () => {
    const rules = [
      {
        id: "test-1",
        rule: "Test rule execution",
        category: "constraint" as const,
        createdAt: new Date().toISOString(),
        active: true,
      },
    ];
    const formatted = formatCrystallizedRulesHighDensity(rules);
    expect(formatted).toContain("[CRYSTALLIZED RULES & CONSTRAINTS]");
    expect(formatted).toContain("[CONSTRAINT] Test rule execution");
  });
});
