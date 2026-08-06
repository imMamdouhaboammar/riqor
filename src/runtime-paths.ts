import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type RuntimeLayoutOptions = {
  moduleDirectory?: string;
  env?: Record<string, string | undefined>;
};

export type RuntimeLayout = {
  packageRoot: string;
  runtimeRoot: string;
  pluginRoot: string;
  scriptsRoot: string;
  shellTemplatesRoot: string;
  packageJsonPath: string;
  distribution: "repository" | "package";
};

export function resolveRuntimeLayout(options: RuntimeLayoutOptions = {}): RuntimeLayout {
  const env = options.env ?? process.env;
  const currentDir = options.moduleDirectory ?? (typeof import.meta.dir === "string" ? import.meta.dir : dirname(fileURLToPath(import.meta.url)));
  const repositoryRoot = resolve(currentDir, "..");
  const runtimeRoot = resolve(env.RIQOR_RUNTIME_ROOT ?? repositoryRoot);
  const packageRoot = resolve(env.RIQOR_PACKAGE_ROOT ?? repositoryRoot);
  const distribution = env.RIQOR_RUNTIME_ROOT ? "package" : "repository";
  return {
    packageRoot,
    runtimeRoot,
    pluginRoot: resolve(runtimeRoot, "plugins", "codex-self-improvement"),
    scriptsRoot: resolve(runtimeRoot, "scripts"),
    shellTemplatesRoot: resolve(runtimeRoot, "config", "shell"),
    packageJsonPath: resolve(packageRoot, "package.json"),
    distribution,
  };
}
