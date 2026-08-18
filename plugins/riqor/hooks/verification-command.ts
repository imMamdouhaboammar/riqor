const packageManagers = new Set(["bun", "npm", "pnpm", "yarn"]);
const verificationScriptParts = new Set(["build", "check", "lint", "test", "typecheck", "validate"]);

/**
 * Recognize package-manager checks by exact colon, dash, or underscore-delimited
 * script-name parts. Substrings such as `contest` and `latest` are not evidence.
 */
export function isPackageVerificationCommand(command: string) {
  const tokens = command.trim().split(/\s+/);
  const manager = tokens[0]?.toLowerCase();
  if (!manager || !packageManagers.has(manager)) return false;
  const script = tokens[1]?.toLowerCase() === "run" ? tokens[2] : tokens[1];
  if (!script || !/^[a-z0-9:_-]+$/i.test(script)) return false;
  return script.split(/[:_-]/).some((part) => verificationScriptParts.has(part));
}
