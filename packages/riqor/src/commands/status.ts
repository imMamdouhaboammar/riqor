import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveUserPaths } from "../paths";
import { StatusOptions, StatusReport } from "../types";

export async function status(options: StatusOptions = {}): Promise<StatusReport> {
  const paths = resolveUserPaths(options.home);
  const packageRoot = process.env.RIQOR_PACKAGE_ROOT ?? join(paths.riqorCurrentLink);

  let version = "missing";
  let pluginVersion = "missing";

  try {
    const pkg = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    version = pkg.version ?? version;
  } catch {}

  try {
    const plugin = JSON.parse(await readFile(join(packageRoot, "runtime", "plugins", "riqor", ".codex-plugin", "plugin.json"), "utf8"));
    pluginVersion = plugin.version ?? pluginVersion;
  } catch {}

  return {
    version,
    pluginVersion,
    surfaces: {
      codexApp: "native-plugin-shared-CODEX_HOME",
      codexCli: "native-plugin-shared-CODEX_HOME",
      agyCli: "native-cli-or-ide-integration",
      agyIde: "sidebar-and-inline-lenses",
      agyApp: "antigravity-2.0-chat-canvas-and-auxiliary-pane",
      agySdk: "python-agent-leasing-and-orchestration",
      kaku: "interactive-shell-hooks",
      chatgptTerminalControl: "inherits-kaku-or-zsh-environment",
      chatgptConversation: "no-native-local-plugin-runtime",
    },
  };
}
