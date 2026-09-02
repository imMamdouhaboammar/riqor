const packageManagers = new Set(["bun", "npm", "pnpm", "yarn"]);
const verificationScriptParts = new Set(["build", "check", "lint", "test", "typecheck", "validate"]);
const nonExecutingFlags = new Set(["--help", "-h", "--version"]);

// Keep quoted selectors together without evaluating shell syntax or expansions.
function commandTokens(command: string) {
  const tokens: string[] = [];
  let token = "";
  let quote = "";
  let started = false;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index]!;
    if (character === "\\" && quote !== "'" && index + 1 < command.length) {
      token += command[++index];
      started = true;
    } else if (character === quote) {
      quote = "";
    } else if (!quote && (character === "'" || character === '"')) {
      quote = character;
      started = true;
    } else if (!quote && /\s/.test(character)) {
      if (started) tokens.push(token);
      token = "";
      started = false;
    } else {
      token += character;
      started = true;
    }
  }
  if (started) tokens.push(token);
  return tokens;
}

const pytestInspectionFlags = new Set([
  "--collect-only", "--co", "--fixtures", "--funcargs", "--fixtures-per-test",
  "--setup-only", "--setup-plan",
]);
const pytestValueFlags = new Set([
  "-k", "-m", "-c", "-o", "--override-ini", "--ignore", "--ignore-glob", "--deselect",
  "--confcutdir", "--rootdir", "--basetemp", "--import-mode", "--tb", "--capture",
  "--maxfail", "--durations", "--durations-min", "--junitxml", "--junit-xml", "-p",
]);
const goValueFlags = new Set([
  "-run", "-bench", "-skip", "-count", "-cpu", "-parallel", "-timeout", "-benchtime",
  "-fuzz", "-fuzztime", "-fuzzminimizetime", "-shuffle", "-tags", "-ldflags", "-gcflags",
  "-asmflags", "-exec", "-o", "-coverprofile", "-outputdir", "-modfile", "-overlay",
  "-blockprofile", "-blockprofilerate", "-cpuprofile", "-memprofile", "-memprofilerate",
  "-mutexprofile", "-mutexprofilefraction", "-trace", "-testlogfile", "-gocoverdir",
  "-covermode", "-coverpkg", "-buildmode", "-compiler", "-gccgoflags", "-installsuffix",
  "-mod", "-p", "-pgo", "-pkgdir", "-toolexec",
]);
const dotnetValueFlags = new Set([
  "--filter", "--logger", "-l", "--settings", "-s", "--configuration", "-c", "--framework", "-f",
  "--runtime", "-r", "--results-directory", "--test-adapter-path", "--collect", "--diag", "-d",
  "--verbosity", "-v", "--output", "-o", "--arch", "-a", "--os", "--environment", "-e",
]);

function hasRunnerInspectionMode(tokens: string[]) {
  const executable = tokens[0]?.toLowerCase();
  const pytest = executable === "pytest"
    || (executable === "python" && tokens[1] === "-m" && tokens[2] === "pytest");
  const go = executable === "go" && tokens[1] === "test";
  const dotnet = executable === "dotnet" && tokens[1] === "test";
  if (!pytest && !go && !dotnet) return false;
  const start = pytest ? (executable === "python" ? 3 : 1) : 2;
  let goListPattern = "";
  let goForwarded = false;
  for (let index = start; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (token === "--") break;
    // Unlike package selection before -args, a positional test-binary argument
    // terminates Go's forwarded flag parsing. Later tokens cannot override -list.
    if (goForwarded && (!token.startsWith("-") || token === "-")) break;
    if (pytest && pytestInspectionFlags.has(token)) return true;
    if (dotnet && (token === "--list-tests" || token === "-t")) return true;
    // Go accepts both -flag and --flag, including the forwarded test.flag form.
    const goToken = go ? token.replace(/^--/, "-").replace(/^-test\./, "-") : token;
    const equals = goToken.indexOf("=");
    const flag = equals < 0 ? goToken : goToken.slice(0, equals);
    if (go && !goForwarded && goToken === "-args") {
      goForwarded = true;
    } else if (go && flag === "-list") {
      goListPattern = equals < 0 ? (tokens[++index] ?? "") : goToken.slice(equals + 1);
    } else if ((pytest && pytestValueFlags.has(token))
      || (go && goValueFlags.has(goToken))
      || (dotnet && dotnetValueFlags.has(token))) {
      index += 1;
    }
  }
  // An empty Go list pattern executes tests; repeated flags use the last value.
  return go && goListPattern !== "";
}

export function hasNonExecutingVerificationMode(command: string) {
  const tokens = commandTokens(command);
  const genericMode = tokens.some((token) => {
    const normalized = token.toLowerCase();
    return nonExecutingFlags.has(normalized)
      || normalized.startsWith("--help=")
      || normalized.startsWith("--version=");
  });
  if (genericMode) return true;
  if (hasRunnerInspectionMode(tokens)) return true;

  const executable = tokens[0]?.toLowerCase();
  if (executable === "mvn") return tokens.some((token) => ["-v", "-version"].includes(token.toLowerCase()));
  if (executable === "xcodebuild") return tokens.some((token) => ["-help", "-version"].includes(token.toLowerCase()));
  if (executable === "phpunit") return tokens.includes("-V");
  return false;
}

/**
 * Recognize package-manager checks by exact colon, dash, or underscore-delimited
 * script-name parts. Substrings such as `contest` and `latest`, and invocations
 * that only request help or version output, are not evidence.
 */
export function isPackageVerificationCommand(command: string) {
  const tokens = command.trim().split(/\s+/);
  if (hasNonExecutingVerificationMode(command)) return false;
  const manager = tokens[0]?.toLowerCase();
  if (!manager || !packageManagers.has(manager)) return false;
  const script = tokens[1]?.toLowerCase() === "run" ? tokens[2] : tokens[1];
  if (!script || !/^[a-z0-9:_-]+$/i.test(script)) return false;
  return script.split(/[:_-]/).some((part) => verificationScriptParts.has(part));
}
