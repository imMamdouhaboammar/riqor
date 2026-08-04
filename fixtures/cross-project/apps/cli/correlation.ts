export function cliCorrelationId(input: string) {
  if (!input) throw new Error("missing correlation ID");
  return input;
}
