import { doctor } from "./commands/doctor";
import { install } from "./commands/install";
import { status } from "./commands/status";
import { uninstall } from "./commands/uninstall";
import { main as harnessMain } from "../../../src/harness-cli";

function print(value: unknown, json: boolean) {
  process.stdout.write(json ? `${JSON.stringify(value, null, 2)}\n` : `${String(value)}\n`);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const [command, ...rest] = args;
  const json = args.includes("--json");
  const packageOnly = args.includes("--package-only");

  if (command === "version") {
    const report = await status({ json });
    return print({ name: "riqor", version: report.version, pluginVersion: report.pluginVersion }, json);
  }

  if (command === "status") {
    const report = await status({ json });
    return print(report, json);
  }

  if (command === "doctor") {
    const report = await doctor({ packageOnly, json });
    print(report, json);
    if (!report.ok) process.exitCode = 1;
    return;
  }

  if (command === "install") {
    const report = await install({ json });
    print(report, json);
    if (!report.ok) process.exitCode = 1;
    return;
  }

  if (command === "uninstall") {
    const report = await uninstall({ json });
    print(report, json);
    if (!report.ok) process.exitCode = 1;
    return;
  }

  // Fall back to root harness CLI for development / compatibility subcommands
  return harnessMain(args);
}
