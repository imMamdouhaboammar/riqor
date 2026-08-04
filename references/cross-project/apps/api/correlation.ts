import { requireCorrelationId } from "../../packages/contracts/correlation";

export function apiCorrelationId(supplied: string | undefined, generate: () => string) {
  return requireCorrelationId(supplied ?? generate());
}
