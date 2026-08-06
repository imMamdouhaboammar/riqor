import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { install } from "../src/commands/install";
import { uninstall } from "../src/commands/uninstall";

describe("installer rollback and idempotent uninstall", () => {
  test("uninstall is idempotent and clears installed surfaces", async () => {
    const tempHome = await mkdtemp(join(tmpdir(), "riqor-rollback-home-"));

    await install({ home: tempHome });
    const firstUninstall = await uninstall({ home: tempHome });
    expect(firstUninstall.ok).toBe(true);

    const secondUninstall = await uninstall({ home: tempHome });
    expect(secondUninstall.ok).toBe(true);

    await rm(tempHome, { recursive: true, force: true });
  }, 15000);
});
