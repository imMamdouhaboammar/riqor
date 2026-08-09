import { basename } from "node:path";

export type CommandBrand = Readonly<{
  name: "riqor" | "codex-harness" | "cxh" | "riqor-agy" | "agy-harness";
  displayName: "Riqor" | "Codex Self Improvement" | "Google Antigravity Harness";
  compatibilityNames: readonly ["codex-harness", "cxh", "riqor-agy", "agy-harness"];
  stateDirectoryName: "riqor";
  environmentPrefix: "RIQOR";
}>;

export function resolveCommandBrand(
  argv0?: string,
  env: Record<string, string | undefined> = process.env
): CommandBrand {
  const envName = env.RIQOR_EXECUTABLE_NAME;
  const rawName = envName || (argv0 ? basename(argv0) : "riqor");
  let name: "riqor" | "codex-harness" | "cxh" | "riqor-agy" | "agy-harness" = "riqor";
  if (rawName === "codex-harness") name = "codex-harness";
  else if (rawName === "cxh") name = "cxh";
  else if (rawName === "riqor-agy") name = "riqor-agy";
  else if (rawName === "agy-harness") name = "agy-harness";

  return {
    name,
    displayName: name === "riqor" ? "Riqor" : name.includes("agy") ? "Google Antigravity Harness" : "Codex Self Improvement",
    compatibilityNames: ["codex-harness", "cxh", "riqor-agy", "agy-harness"] as const,
    stateDirectoryName: "riqor",
    environmentPrefix: "RIQOR",
  };
}
