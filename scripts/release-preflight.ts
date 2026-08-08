import { execFile } from "node:child_process";

export type ResourceState = "available" | "owned" | "conflict" | "unreachable";

export type PreflightOptions = Readonly<{
  repositoryRoot?: string;
  expectedOwner: "imMamdouhaboammar";
  expectedNpmUser?: string;
}>;

export type PreflightReport = Readonly<{
  ok: boolean;
  githubUser: string | null;
  npmUser: string | null;
  resources: Readonly<Record<"githubRepo" | "homebrewTap" | "npmPackage", ResourceState>>;
  errors: readonly string[];
  exitCode: number;
}>;

function runCmd(command: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const [file, ...args] = command;
    execFile(file, args, { encoding: "utf8", timeout: 15000 }, (err, stdout, stderr) => {
      resolve({
        exitCode: err ? (typeof err.code === "number" ? err.code : 1) : 0,
        stdout: (stdout || "").trim(),
        stderr: (stderr || "").trim(),
      });
    });
  });
}

export function classifyGitHub(
  result: { exitCode: number; stderr?: string; owner?: string },
  expectedOwner: string
): ResourceState {
  if (result.exitCode === 0 && result.owner) {
    return result.owner.toLowerCase() === expectedOwner.toLowerCase() ? "owned" : "conflict";
  }
  const err = (result.stderr || "").toLowerCase();
  if (err.includes("could not resolve to a repository") || err.includes("not found") || err.includes("404")) {
    return "available";
  }
  return "unreachable";
}

export function classifyNpm(
  result: { status?: number; maintainers?: readonly string[] },
  expectedOwner: string
): ResourceState {
  if (result.status === 404) return "available";
  if (result.status === 200 && result.maintainers) {
    const expected = expectedOwner.trim().toLowerCase();
    const isOwner = result.maintainers.some((maintainer) => {
      const normalized = maintainer.trim().toLowerCase();
      const username = normalized.split(/\s|</, 1)[0];
      return username === expected;
    });
    return isOwner ? "owned" : "conflict";
  }
  return "unreachable";
}

export async function runReleasePreflight(options: PreflightOptions): Promise<PreflightReport> {
  const errors: string[] = [];

  // GitHub user check
  const ghUserCmd = await runCmd(["gh", "api", "user", "--jq", ".login"]);
  const githubUser = ghUserCmd.exitCode === 0 ? ghUserCmd.stdout : null;

  // npm user check
  const npmUserCmd = await runCmd(["npm", "whoami"]);
  const npmUser = npmUserCmd.exitCode === 0 ? npmUserCmd.stdout : null;

  // GitHub main repo check
  const ghRepoCmd = await runCmd(["gh", "repo", "view", `${options.expectedOwner}/riqor`, "--json", "owner"]);
  let ghRepoOwner: string | undefined;
  if (ghRepoCmd.exitCode === 0 && ghRepoCmd.stdout) {
    try {
      ghRepoOwner = JSON.parse(ghRepoCmd.stdout).owner?.login;
    } catch {}
  }
  const githubRepoState = classifyGitHub({ exitCode: ghRepoCmd.exitCode, stderr: ghRepoCmd.stderr, owner: ghRepoOwner }, options.expectedOwner);

  // Homebrew tap repo check
  const ghTapCmd = await runCmd(["gh", "repo", "view", `${options.expectedOwner}/homebrew-tap`, "--json", "owner"]);
  let ghTapOwner: string | undefined;
  if (ghTapCmd.exitCode === 0 && ghTapCmd.stdout) {
    try {
      ghTapOwner = JSON.parse(ghTapCmd.stdout).owner?.login;
    } catch {}
  }
  const homebrewTapState = classifyGitHub({ exitCode: ghTapCmd.exitCode, stderr: ghTapCmd.stderr, owner: ghTapOwner }, options.expectedOwner);

  // npm package check
  const npmViewCmd = await runCmd(["npm", "view", "riqor", "--json"]);
  let npmStatus = 200;
  let npmMaintainers: string[] = [];
  if (npmViewCmd.exitCode !== 0) {
    npmStatus = npmViewCmd.stderr.includes("E404") || npmViewCmd.stdout.includes("E404") ? 404 : 500;
  } else if (npmViewCmd.stdout) {
    try {
      const parsed = JSON.parse(npmViewCmd.stdout);
      if (Array.isArray(parsed.maintainers)) {
        npmMaintainers = parsed.maintainers.map((m: any) => (typeof m === "string" ? m : m.name));
      }
    } catch {}
  }
  const expectedNpm = options.expectedNpmUser ?? npmUser ?? options.expectedOwner;
  const npmPackageState = classifyNpm({ status: npmStatus, maintainers: npmMaintainers }, expectedNpm);

  const resources = {
    githubRepo: githubRepoState,
    homebrewTap: homebrewTapState,
    npmPackage: npmPackageState,
  };

  let exitCode = 0;
  if (Object.values(resources).includes("conflict")) {
    exitCode = 2;
    errors.push("Resource ownership conflict detected");
  } else if (Object.values(resources).includes("unreachable") || !githubUser || !npmUser) {
    exitCode = 3;
    errors.push("Authentication or network state cannot be verified");
  }

  return {
    ok: exitCode === 0,
    githubUser,
    npmUser,
    resources,
    errors,
    exitCode,
  };
}

if (import.meta.main) {
  runReleasePreflight({ expectedOwner: "imMamdouhaboammar" })
    .then((report) => {
      if (process.argv.includes("--json")) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(`Preflight status: ${report.ok ? "OK" : "FAILED"}`);
        console.log(`GitHub User: ${report.githubUser ?? "unverified"}`);
        console.log(`npm User: ${report.npmUser ?? "unverified"}`);
        console.log(`Resources:`, report.resources);
      }
      process.exit(report.exitCode);
    })
    .catch((err) => {
      console.error(err);
      process.exit(3);
    });
}
