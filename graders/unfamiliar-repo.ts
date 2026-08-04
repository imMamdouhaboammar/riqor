import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repo = resolve(process.argv[2]);
const { coalesceWindows } = await import(pathToFileURL(resolve(repo, "src/windows.ts")).href);
const windows = [{ start: 8, end: 10 }, { start: 1, end: 3 }, { start: 3, end: 5 }, { start: 4, end: 9 }];
const snapshot = structuredClone(windows);
assert.deepEqual(coalesceWindows(windows), [{ start: 1, end: 10 }]);
assert.deepEqual(windows, snapshot);
assert.throws(() => coalesceWindows([{ start: 2, end: 2 }]), /start|window|invalid/i);
assert.throws(() => coalesceWindows([{ start: 1.5, end: 3 }]), /integer|window|invalid/i);
