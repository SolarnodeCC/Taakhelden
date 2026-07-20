import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ErrorCodes, type ErrorCode } from "@taakhelden/shared";

export class ApiException extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function errorHandler(err: Error, c: Context) {
  if (err instanceof ApiException) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status as 400,
    );
  }
  if (err instanceof HTTPException) {
    return c.json(
      { error: { code: ErrorCodes.VALIDATION_FAILED, message: err.message } },
      err.status,
    );
  }
  console.error("unhandled", err.message); // nooit PII loggen
  return c.json(
    { error: { code: "INTERNAL" as ErrorCode, message: "Er ging iets mis. Probeer het opnieuw." } },
    500,
  );
}
