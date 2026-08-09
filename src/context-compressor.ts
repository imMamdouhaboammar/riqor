export type CompressionMode = "Full" | "Compact" | "Tersest";

export interface CompressionResult {
  originalText: string;
  compressedText: string;
  originalLength: number;
  compressedLength: number;
  compressionRatio: number;
  mode: CompressionMode;
}

const BOILERPLATE_PATTERNS = [
  /Please follow all guidelines carefully\./gi,
  /Make sure you never introduce bugs into the codebase\./gi,
  /Always format your answers nicely using Markdown syntax\./gi,
];

const LOG_PATTERN = /^\[INFO\].*$/gm;

export function compressContext(rawText: string, mode: CompressionMode): CompressionResult {
  const originalLength = rawText.length;

  if (mode === "Full" || originalLength === 0) {
    return {
      originalText: rawText,
      compressedText: rawText,
      originalLength,
      compressedLength: originalLength,
      compressionRatio: 1.0,
      mode,
    };
  }

  let processed = rawText;

  // Preserve critical evidence blocks
  const lines = processed.split("\n");
  const filteredLines: string[] = [];

  for (const line of lines) {
    const isEvidence = isCriticalEvidenceLine(line);

    if (mode === "Compact") {
      if (line.trim().startsWith("[INFO]") && !isEvidence) {
        continue; // skip repetitive logs
      }
      filteredLines.push(line);
    } else if (mode === "Tersest") {
      if ((line.trim().startsWith("[INFO]") || line.trim().startsWith("=== SYSTEM DIRECTIVES ===")) && !isEvidence) {
        continue;
      }
      filteredLines.push(line);
    }
  }

  processed = filteredLines.join("\n");

  if (mode === "Tersest") {
    for (const pattern of BOILERPLATE_PATTERNS) {
      processed = processed.replace(pattern, "");
    }
    processed = processed.replace(/\n{3,}/g, "\n\n").trim();
  }

  const compressedLength = processed.length;
  const compressionRatio = Number((compressedLength / originalLength).toFixed(4));

  return {
    originalText: rawText,
    compressedText: processed,
    originalLength,
    compressedLength,
    compressionRatio,
    mode,
  };
}

function isCriticalEvidenceLine(line: string): boolean {
  const upper = line.toUpperCase();
  return (
    upper.includes("EVIDENCE") ||
    upper.includes("VERIFIED") ||
    upper.includes("MUST") ||
    upper.includes("SECURITY") ||
    upper.includes("CRITICAL")
  );
}
