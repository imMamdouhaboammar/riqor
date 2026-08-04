export function normalizePostgres(source: string, preservedLiterals: ReadonlySet<string> = new Set()) {
  let output = "";
  for (let index = 0; index < source.length;) {
    if (source.startsWith("--", index)) {
      index = source.indexOf("\n", index + 2);
      if (index < 0) break;
      output += "\n";
      continue;
    }
    if (source.startsWith("/*", index)) {
      let depth = 1;
      index += 2;
      while (index < source.length && depth > 0) {
        if (source.startsWith("/*", index)) { depth += 1; index += 2; }
        else if (source.startsWith("*/", index)) { depth -= 1; index += 2; }
        else index += 1;
      }
      output += " ";
      continue;
    }
    const dollarTag = source.slice(index).match(/^\$[a-z_][a-z0-9_]*\$|^\$\$/i)?.[0];
    if (dollarTag) {
      const end = source.indexOf(dollarTag, index + dollarTag.length);
      index = end < 0 ? source.length : end + dollarTag.length;
      output += " ";
      continue;
    }
    let escapeString = false;
    if (/e/i.test(source[index] ?? "") && source[index + 1] === "'" && !/[a-z0-9_$]/i.test(source[index - 1] ?? "")) {
      escapeString = true;
      index += 1;
    }
    if (source[index] === "'") {
      let value = "";
      index += 1;
      while (index < source.length) {
        if (escapeString && source[index] === "\\" && index + 1 < source.length) { value += source[index + 1]; index += 2; }
        else if (source[index] === "'" && source[index + 1] === "'") { value += "'"; index += 2; }
        else if (source[index] === "'") { index += 1; break; }
        else { value += source[index]; index += 1; }
      }
      const normalized = value.toLowerCase();
      output += preservedLiterals.has(normalized) ? ` __literal_${normalized}__ ` : " __literal__ ";
      continue;
    }
    if (source[index] === '"') {
      index += 1;
      while (index < source.length) {
        if (source[index] === '"' && source[index + 1] === '"') index += 2;
        else if (source[index] === '"') { index += 1; break; }
        else index += 1;
      }
      output += " __quoted__ ";
      continue;
    }
    output += source[index];
    index += 1;
  }
  return output.toLowerCase().replace(/\s+/g, " ");
}
