const packageManagers = new Set(["bun", "npm", "pnpm", "yarn"]);
const verificationScriptParts = new Set(["build", "check", "lint", "test", "typecheck", "validate"]);
const nonExecutingFlags = new Set(["--help", "-h", "--version"]);

function unquoteToken(token: string) {
  return token.length > 1 && token[0] === token.at(-1) && /['"]/.test(token[0]!)
      ? token.slice(1, -1)
      : token;
}

export function hasNonExecutingVerificationMode(command: string) {
  const tokens = command.trim().split(/\s+/).map(unquoteToken);
  const genericMode = tokens.some((token) => {
    const normalized = token.toLowerCase();
    return nonExecutingFlags.has(normalized)
      || normalized.startsWith("--help=")
      || normalized.startsWith("--version=");
  });
  if (genericMode) return true;

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
