import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

export interface CrystallizedRule {
  id: string;
  rule: string;
  category: "constraint" | "verification" | "convention";
  createdAt: string;
  active: boolean;
}

export function getRulesFilePath(repoRoot: string = process.cwd()): string {
  const localDir = join(resolve(repoRoot), ".riqor");
  const localFile = join(localDir, "rules.json");
  if (existsSync(localFile)) {
    return localFile;
  }
  const globalDir = join(homedir(), ".config", "riqor");
  return join(globalDir, "rules.json");
}

export function loadCrystallizedRules(repoRoot: string = process.cwd()): CrystallizedRule[] {
  const filePath = getRulesFilePath(repoRoot);
  if (!existsSync(filePath)) {
    return [
      {
        id: "default-rule-1",
        rule: "Do not execute repository sandbox checks inside OS temporary storage (/tmp).",
        category: "constraint",
        createdAt: new Date().toISOString(),
        active: true,
      },
      {
        id: "default-rule-2",
        rule: "Always run repository test suites before claiming verification pass.",
        category: "verification",
        createdAt: new Date().toISOString(),
        active: true,
      },
    ];
  }

  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addCrystallizedRule(
  repoRoot: string = process.cwd(),
  ruleText: string,
  category: "constraint" | "verification" | "convention" = "constraint",
): CrystallizedRule {
  const resolvedRoot = resolve(repoRoot);
  const localDir = join(resolvedRoot, ".riqor");
  if (!existsSync(localDir)) {
    mkdirSync(localDir, { recursive: true });
  }

  const filePath = join(localDir, "rules.json");
  const currentRules = loadCrystallizedRules(resolvedRoot);

  const newRule: CrystallizedRule = {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    rule: ruleText.trim(),
    category,
    createdAt: new Date().toISOString(),
    active: true,
  };

  currentRules.push(newRule);
  writeFileSync(filePath, JSON.stringify(currentRules, null, 2), "utf8");
  return newRule;
}

export function formatCrystallizedRulesHighDensity(rules: CrystallizedRule[]): string {
  const activeRules = rules.filter((r) => r.active);
  if (activeRules.length === 0) return "";

  const lines = activeRules.map((r, index) => `${index + 1}. [${r.category.toUpperCase()}] ${r.rule}`);
  return `[CRYSTALLIZED RULES & CONSTRAINTS]\n${lines.join("\n")}`;
}
