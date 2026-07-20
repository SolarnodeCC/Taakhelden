import { Hono } from "hono";
import type { AppBindings } from "../types";
import { idempotency } from "../middleware/idempotency";

const instances = new Hono<AppBindings>();

instances.get("/today", async (c) => c.json({ todo: "taken van vandaag per rol" }, 501));

// Afvinken loopt via de FamilyRoom-DO voor ledger-serialisatie
instances.post("/:id/complete", idempotency, async (c) => {
  const { familyId } = c.get("auth");
  const stub = c.env.FAMILY_DO.get(c.env.FAMILY_DO.idFromName(familyId));
  // TODO: stub.fetch met complete-payload → CompleteResult teruggeven
  return c.json({ todo: "complete via DO" }, 501);
});

instances.post("/:id/approve", async (c) => c.json({ todo: "approve" }, 501));
instances.post("/:id/redo", async (c) => c.json({ todo: "redo met note, GEEN puntenaftrek" }, 501));

export default instances;
