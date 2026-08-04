export function apiCorrelationId(supplied: string | undefined, generate: () => string) {
  return supplied ?? generate();
}
