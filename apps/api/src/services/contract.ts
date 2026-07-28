import type { Context } from "hono";
import type { AppBindings } from "../types";

export function isContractV2(c: Context<AppBindings>): boolean {
  return c.req.header("X-Contract-Version") === "2";
}
