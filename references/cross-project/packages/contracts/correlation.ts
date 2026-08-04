export function isCorrelationId(input: string) {
  return /^[0-9a-f]{16,32}$/.test(input);
}

export function requireCorrelationId(input: string) {
  if (!isCorrelationId(input)) throw new Error("invalid correlation ID");
  return input;
}
