#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.env.RIQOR_PACKAGE_ROOT ??= packageRoot;
process.env.RIQOR_RUNTIME_ROOT ??= resolve(packageRoot, "runtime");
process.env.RIQOR_EXECUTABLE_NAME ??= "riqor";
const { main } = await import("../dist/cli.mjs");
await main(process.argv.slice(2));
