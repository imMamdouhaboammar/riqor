import { basename } from "node:path";

export type CommandBrand = Readonly<{
  name: "riqor" | "codex-harness" | "cxh";
  displayName: "Riqor" | "Codex Self Improvement";
  compatibilityNames: readonly ["codex-harness", "cxh"];
  stateDirectoryName: "riqor";
  environmentPrefix: "RIQOR";
}>;

export function resolveCommandBrand(
  argv0?: string,
  env: Record<string, string | undefined> = process.env
): CommandBrand {
  const envName = env.RIQOR_EXECUTABLE_NAME;
  const rawName = envName || (argv0 ? basename(argv0) : "riqor");
  let name: "riqor" | "codex-harness" | "cxh" = "riqor";
  if (rawName === "codex-harness") name = "codex-harness";
  else if (rawName === "cxh") name = "cxh";

  return {
    name,
    displayName: name === "riqor" ? "Riqor" : "Codex Self Improvement",
    compatibilityNames: ["codex-harness", "cxh"] as const,
    stateDirectoryName: "riqor",
    environmentPrefix: "RIQOR",
  };
}
