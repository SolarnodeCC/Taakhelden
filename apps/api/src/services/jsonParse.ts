import { z } from "zod";

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
