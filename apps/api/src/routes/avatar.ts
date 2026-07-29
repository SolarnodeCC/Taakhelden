import { Hono } from "hono";
import { AvatarCatalogResponse } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { listAvatarCatalog } from "../repo/avatar";

/** GET /avatar/catalog — static cosmetic progression catalogue (no IAP). */
const avatar = new Hono<AppBindings>();

avatar.get("/catalog", async (c) => {
  c.get("auth");
  const items = await listAvatarCatalog(c.env.DB);
  const body: AvatarCatalogResponse = { items };
  return c.json(body);
});

export default avatar;
