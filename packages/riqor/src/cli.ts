import { doctor } from "./commands/doctor";
import { install } from "./commands/install";
import { status } from "./commands/status";
import { uninstall } from "./commands/uninstall";
import { main as harnessMain } from "../../../src/harness-cli";
import { adoptionReport, exportAdoptionReceipt, formatAdoptionReport, resetAdoption } from "./adoption";
import { resolveUserPaths } from "./paths";

function print(value: unknown, json: boolean) {
  process.stdout.write(json ? `${JSON.stringify(value, null, 2)}\n` : `${String(value)}\n`);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const [command] = args;
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

  if (command === "adoption") {
    const stateDir = resolveUserPaths().riqorStateDir;
    if (args.includes("--reset")) {
      await resetAdoption(stateDir);
      return print(json ? { ok: true, reset: true } : "Riqor local adoption ledger reset", json);
    }
    const exportIndex = args.indexOf("--export");
    const exportValue = args.find((arg) => arg.startsWith("--export="))?.slice("--export=".length);
    const outputPath = exportValue ?? (exportIndex >= 0 ? args[exportIndex + 1] : undefined);
    if (exportIndex >= 0 && !outputPath) throw new Error("adoption --export requires a path");
    if (outputPath) {
      const receipt = await exportAdoptionReceipt({ stateDir, outputPath });
      return print(json ? receipt : `Riqor adoption receipt written to ${outputPath}`, json);
    }
    const report = await adoptionReport(stateDir);
    return print(json ? report : formatAdoptionReport(report), json);
  }

  try {
    await harnessMain(args);
  } catch (error) {
    process.stderr.write(`riqor: ${error instanceof Error ? error.message : "unexpected failure"}\n`);
    process.exitCode = 64;
  }
}
