import { Hono } from "hono";
import type { AppBindings } from "../types";
import { requireParent } from "../middleware/authz";
import { getFamily, getMembers } from "../repo/families";

const families = new Hono<AppBindings>();

families.get("/me", async (c) => {
  const { familyId, role } = c.get("auth");
  const family = await getFamily(c.env.DB, familyId);
  if (role === "child") {
    // uitgeklede weergave: geen invite_code, geen instellingen
    const { id, name, timezone } = family as any;
    return c.json({ id, name, timezone });
  }
  return c.json(family);
});

families.get("/members", async (c) => {
  const { familyId } = c.get("auth");
  const members = await getMembers(c.env.DB, familyId);
  return c.json(members.results);
});

families.patch("/me", async (c) => {
  requireParent(c, { full: true });
  return c.json({ todo: "settings patch (FamilySettings schema)" }, 501);
});

export default families;
