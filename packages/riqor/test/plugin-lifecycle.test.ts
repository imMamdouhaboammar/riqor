import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { install } from "../src/commands/install";
import { uninstall } from "../src/commands/uninstall";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function makeFakeCodex(home: string) {
  const bin = join(home, "mock-bin");
  const log = join(home, "codex-calls.log");
  await mkdir(bin, { recursive: true });
  const codex = join(bin, "codex");
  await writeFile(codex, `#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "$RIQOR_TEST_CODEX_LOG"
case "$*" in
  "--version") printf '%s\\n' 'codex-cli test' ;;
  "plugin marketplace list --json") printf '%s\\n' '{"marketplaces":[]}' ;;
  "plugin marketplace add "*) exit 0 ;;
  "plugin add "*) exit 0 ;;
  "plugin list --json") printf '%s\\n' '{"installed":[{"name":"riqor","marketplaceName":"riqor","installed":true,"enabled":true}]}' ;;
  "plugin remove "*) exit 0 ;;
  "plugin marketplace remove "*) exit 0 ;;
  *) printf '%s\\n' "unexpected codex args: $*" >&2; exit 2 ;;
esac
`);
  await chmod(codex, 0o755);
  return { bin, log };
}
describe("packaged Codex plugin lifecycle", () => {
  test("install and uninstall manage the bundled plugin without Bun", async () => {
    const home = await mkdtemp(join(tmpdir(), "riqor-plugin-lifecycle-"));
    roots.push(home);
    const { bin, log } = await makeFakeCodex(home);
    const previousPath = process.env.PATH;
    const previousLog = process.env.RIQOR_TEST_CODEX_LOG;
    const python = Bun.which("python3");
    const bash = Bun.which("bash");
    if (!python || !bash) throw new Error("python3 and bash are required for this test");
    process.env.PATH = [bin, dirname(python), dirname(bash), "/usr/bin", "/bin"].join(":");
    process.env.RIQOR_TEST_CODEX_LOG = log;

    try {
      const installed = await install({ home, codexHome: join(home, ".codex") });
      expect(installed.ok).toBe(true);
      expect(installed.surfaces).toContain("codex-plugin");
      const afterInstall = await readFile(log, "utf8");
      expect(afterInstall).toContain("plugin marketplace add");
      expect(afterInstall).toContain("plugin add riqor@riqor");

      const removed = await uninstall({ home, codexHome: join(home, ".codex") });
      expect(removed.ok).toBe(true);
      const afterUninstall = await readFile(log, "utf8");
      expect(afterUninstall).toContain("plugin remove riqor@riqor");
      expect(afterUninstall).toContain("plugin marketplace remove riqor");
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      if (previousLog === undefined) delete process.env.RIQOR_TEST_CODEX_LOG;
      else process.env.RIQOR_TEST_CODEX_LOG = previousLog;
    }
  }, 15000);
});
