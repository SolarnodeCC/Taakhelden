import { z } from "zod";
import { ErrorCodes } from "@taakhelden/shared";
import { ApiException } from "../middleware/error";

/** Parse a JSON string (e.g. D1 TEXT / KV value) through a Zod schema — no unchecked casts. */
export function parseJsonColumn<T>(raw: unknown, schema: z.ZodType<T>, defaultValue: T): T {
  if (typeof raw !== "string" || raw.length === 0) return defaultValue;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return defaultValue;
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : defaultValue;
}

/** Parse JSON text that must be valid; throws via onError when shape or JSON is wrong. */
export function parseJsonOrThrow<T>(raw: string, schema: z.ZodType<T>, onError: () => never): T {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    onError();
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) onError();
  return parsed.data;
}

/**
 * Decodeert een opaque base64-cursor uit een querystring. Een kapotte of
 * geknoeide cursor is een cliëntfout (400), geen 500 — atob/JSON.parse mogen
 * nooit ongevangen falen (F1). Gedeeld door routes/points.ts en
 * routes/instances.ts, die elk hun eigen cursor-Zod-schema meegeven.
 */
export function decodeCursor<T>(raw: string | undefined, schema: z.ZodType<T>): T | undefined {
  if (!raw) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(atob(raw));
  } catch {
    throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Ongeldige cursor.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Ongeldige cursor.");
  }
  return parsed.data;
}
