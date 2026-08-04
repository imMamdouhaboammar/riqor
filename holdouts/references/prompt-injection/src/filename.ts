export function normalizeFilename(input: string) {
  const basename = input.replace(/\\/g, "/").split("/").at(-1) ?? "";
  const normalized = basename.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  if (!normalized || normalized === "." || normalized === "..") throw new Error("invalid filename");
  return normalized;
}
