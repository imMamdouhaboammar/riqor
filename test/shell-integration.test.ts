import { expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

test("shell templates are silent, idempotent, and preserve original binaries", async () => {
  const env = await readFile(`${root}/config/shell/codex-self-improvement-env.zsh`, "utf8");
  const kaku = await readFile(`${root}/config/shell/codex-self-improvement-kaku.zsh`, "utf8");
  expect(env).toContain("_CODEX_SELF_IMPROVEMENT_ENV_LOADED");
  expect(env).toContain("CODEX_SELF_IMPROVEMENT_ROOT");
  expect(env).toContain("$HOME/.config/kaku/zsh/bin");
  expect(env).not.toMatch(/echo|print /);
  expect(kaku).toContain("_CODEX_SELF_IMPROVEMENT_KAKU_LOADED");
  expect(kaku).toContain("command codex");
  expect(kaku).not.toContain("alias codex=");
  expect(kaku).toContain("add-zsh-hook preexec");
  expect(kaku).toContain("add-zsh-hook precmd");
  expect(kaku).toContain("compdef _codex_harness codex-harness cxh");
});


test("Kaku skips runtime startup for ordinary commands", async () => {
  const home = await mkdtemp(join(tmpdir(), "csi-kaku-filter-"));
  const bin = join(home, "bin");
  const log = join(home, "calls.log");
  await mkdir(bin);
  const mock = join(bin, "codex-harness");
  await writeFile(mock, `#!/bin/sh\nprintf '%s\n' "$*" >> ${JSON.stringify(log)}\n`);
  await chmod(mock, 0o755);
  const plugin = `${root}/config/shell/codex-self-improvement-kaku.zsh`;
  const script = `source ${JSON.stringify(plugin)}; _csi_preexec pwd; [[ ! -e ${JSON.stringify(log)} ]]; _csi_preexec 'printf x > src/a.ts'; grep -q 'terminal preexec' ${JSON.stringify(log)}`;
  const result = Bun.spawnSync(["zsh", "-dfc", script], {
    env: { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH ?? ""}` },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.exitCode).toBe(0);
});


test("Kaku evidence hook runs before existing precmd hooks", () => {
  const plugin = `${root}/config/shell/codex-self-improvement-kaku.zsh`;
  const script = `existing_precmd() { return 0 }; precmd_functions=(existing_precmd); source ${JSON.stringify(plugin)}; [[ "\${precmd_functions[1]}" == "_csi_precmd" ]]`;
  const result = Bun.spawnSync(["zsh", "-dfc", script], { stdout: "pipe", stderr: "pipe" });
  expect(result.exitCode).toBe(0);
});
