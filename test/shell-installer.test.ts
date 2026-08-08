import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

function shell(command: string, home: string) {
  return Bun.spawnSync(["bash", "-lc", command], {
    cwd: root,
    env: { ...process.env, HOME: home, CODEX_SELF_IMPROVEMENT_SKIP_KAKU_INIT: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
}

test("shell installer is idempotent and uninstall removes only managed entries", async () => {
  const home = await mkdtemp(join(tmpdir(), "csi-home-"));
  const install = join(root, "scripts", "install-shell-integration.sh");
  const uninstall = join(root, "scripts", "uninstall-shell-integration.sh");
  const interactive = join(home, ".config", "kaku", "zsh", "plugins", "kaku-harness-interactive.zsh");
  await mkdir(join(home, ".config", "kaku", "zsh", "plugins"), { recursive: true });
  const originalInteractive = `# Managed interactive Kaku harness.
[[ -n "\${_KAKU_SKILLS_HARNESS_LOADED:-}" ]] && return 0
typeset -g _KAKU_SKILLS_HARNESS_LOADED=1
# Shared initialization
[[ "\${_KAKU_SKILLS_HARNESS_LOADED:-0}" == "1" ]] && return 0
typeset -g _KAKU_SKILLS_HARNESS_LOADED=1
Execution blocked to prevent credential leakage in shell history.
`;
  await writeFile(interactive, originalInteractive);
  expect(shell(`bash -n ${JSON.stringify(install)} && bash -n ${JSON.stringify(uninstall)}`, home).exitCode).toBe(0);
  expect(shell(`bash ${JSON.stringify(install)} && bash ${JSON.stringify(install)}`, home).exitCode).toBe(0);
  const zshenv = await readFile(join(home, ".zshenv"), "utf8");
  expect(zshenv.match(/>>> codex-self-improvement >>>/g)).toHaveLength(1);
  const wrapper = await readFile(join(home, ".local", "bin", "codex-harness"), "utf8");
  expect(wrapper).toContain(join(root, "src", "harness-cli.ts"));
  const probe = shell(`zsh -c 'source "$HOME/.zshenv"; [[ "$CODEX_SELF_IMPROVEMENT_ENABLED" == 1 ]]'`, home);
  expect(probe.exitCode).toBe(0);
  const patchedInteractive = await readFile(interactive, "utf8");
  expect(patchedInteractive).not.toStartWith(`# Managed interactive Kaku harness.
[[ -n "\${_KAKU_SKILLS_HARNESS_LOADED:-}" ]]`);
  expect(shell(`bash ${JSON.stringify(uninstall)}`, home).exitCode).toBe(0);
  expect((await readFile(join(home, ".zshenv"), "utf8"))).not.toContain("codex-self-improvement");
  expect(await readFile(interactive, "utf8")).toBe(originalInteractive);
});

test("package-mode shell install preserves Riqor shims and loads the managed environment", async () => {
  const home = await mkdtemp(join(tmpdir(), "riqor-package-shell-"));
  const binDir = join(home, ".local", "bin");
  await mkdir(binDir, { recursive: true });
  const riqor = join(binDir, "riqor");
  await writeFile(riqor, "#!/bin/sh\n# Managed by Riqor\necho package\n");
  await Bun.write(join(binDir, "codex-harness"), "placeholder");
  await rm(join(binDir, "codex-harness"), { force: true });
  await symlink("riqor", join(binDir, "codex-harness"));
  const install = join(root, "scripts", "install-shell-integration.sh");
  const result = Bun.spawnSync(["bash", install], {
    cwd: root,
    env: {
      ...process.env,
      HOME: home,
      CODEX_SELF_IMPROVEMENT_PACKAGE_MODE: "1",
      CODEX_SELF_IMPROVEMENT_SKIP_KAKU_INIT: "1",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.exitCode).toBe(0);
  expect(await readFile(riqor, "utf8")).toContain("# Managed by Riqor");
  const zshenv = await readFile(join(home, ".zshenv"), "utf8");
  expect(zshenv).toContain("codex-self-improvement/env.zsh");
  const probe = shell(`zsh -c 'source "$HOME/.zshenv"; [[ "$CODEX_SELF_IMPROVEMENT_ENABLED" == 1 ]]'`, home);
  expect(probe.exitCode).toBe(0);
});

test("shell installer fails closed on malformed managed markers", async () => {
  const home = await mkdtemp(join(tmpdir(), "riqor-malformed-zshenv-"));
  const zshenv = join(home, ".zshenv");
  const original = `export KEEP_ME=1\n# >>> codex-self-improvement >>>\nexport AFTER_MARKER=1\n`;
  await writeFile(zshenv, original);
  const install = join(root, "scripts", "install-shell-integration.sh");
  const result = Bun.spawnSync(["bash", install], {
    cwd: root,
    env: {
      ...process.env,
      HOME: home,
      CODEX_SELF_IMPROVEMENT_PACKAGE_MODE: "1",
      CODEX_SELF_IMPROVEMENT_SKIP_KAKU_INIT: "1",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.exitCode).not.toBe(0);
  expect(await readFile(zshenv, "utf8")).toBe(original);
});

test("shell uninstaller fails closed on malformed managed markers", async () => {
  const home = await mkdtemp(join(tmpdir(), "riqor-malformed-uninstall-"));
  const zshenv = join(home, ".zshenv");
  const original = `export KEEP_ME=1\n# >>> codex-self-improvement >>>\nexport AFTER_MARKER=1\n`;
  await writeFile(zshenv, original);
  const uninstall = join(root, "scripts", "uninstall-shell-integration.sh");
  const result = Bun.spawnSync(["bash", uninstall], {
    cwd: root,
    env: {
      ...process.env,
      HOME: home,
      CODEX_SELF_IMPROVEMENT_PACKAGE_MODE: "1",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.exitCode).not.toBe(0);
  expect(await readFile(zshenv, "utf8")).toBe(original);
});
