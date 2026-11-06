import { ERROR_MESSAGES } from "../generationTypes.ts";
import type { GenerationErrorCode } from "../generationTypes.ts";
export class GenerationError extends Error {
  constructor(
    public code: GenerationErrorCode,
    public status = 422,
    public retryable = false,
  ) {
    super(ERROR_MESSAGES[code]);
  }
}
export function providerError(status: number): GenerationError {
  if (status === 401) return new GenerationError("AUTH_INVALID", 401);
  if (status === 402) return new GenerationError("BALANCE_INSUFFICIENT", 402);
  if (status === 429) return new GenerationError("RATE_LIMITED", 429);
  if (status === 400 || status === 422)
    return new GenerationError("PARAMETERS_INVALID", 422);
  return new GenerationError("PROVIDER_UNAVAILABLE", 503, status >= 500);
}
