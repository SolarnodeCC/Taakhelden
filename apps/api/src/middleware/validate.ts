import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { z } from "zod";
import { ErrorCodes } from "@taakhelden/shared";
import { ApiException } from "./error";

/**
 * zValidator met ons uniforme foutmodel: validatiefouten worden een
 * 400 VALIDATION_FAILED in plaats van de kale zValidator-response.
 */
export function validate<T extends z.ZodTypeAny, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Ongeldige invoer.", {
        issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
  });
}
