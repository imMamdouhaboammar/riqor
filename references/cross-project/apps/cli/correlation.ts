import { requireCorrelationId } from "../../packages/contracts/correlation";

export function cliCorrelationId(input: string) {
  return requireCorrelationId(input);
}
