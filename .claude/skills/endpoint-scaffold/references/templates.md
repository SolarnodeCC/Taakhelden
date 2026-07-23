# Endpoint-templates (TaakHelden)

Copy-pasteerbare startpunten voor een nieuw endpoint. Vervang `Widget`/`widget`/`wgt`
door je resource. Deze templates volgen de bestaande conventies in `routes/tasks.ts`,
`repo/tasks.ts` en `test/authz.test.ts` — kopieer geen afwijkende stijl.

## 1. Zod-schema — `packages/shared/src/schemas/widget.ts`
```ts
import { z } from "zod";

export const WidgetBody = z.object({
  title: z.string().min(1).max(80),
  points: z.number().int().min(1).max(500),
  // ...velden; gebruik .default()/.nullable() zoals in schemas/task.ts
});
export type WidgetBody = z.infer<typeof WidgetBody>;

export const WidgetPatchBody = WidgetBody.partial();
export type WidgetPatchBody = z.infer<typeof WidgetPatchBody>;
```
Voeg daarna de export toe aan `packages/shared/src/index.ts`:
```ts
export * from "./schemas/widget";
```
Nieuwe foutcode nodig? Voeg toe aan `ErrorCodes` in `packages/shared/src/errors.ts`.

## 2. Repo-functie — `apps/api/src/repo/widget.ts`
`familyId` is het VERPLICHTE eerste argument ná de DB-handle. Elke query filtert op
`family_id = ?` (de security-grens — D1 heeft geen row-level security).
```ts
import type { WidgetBody } from "@taakhelden/shared";
import { newId } from "../services/ids";

export async function listWidgets(db: D1Database, familyId: string) {
  return db
    .prepare("SELECT * FROM widgets WHERE family_id = ? AND archived_at IS NULL ORDER BY created_at")
    .bind(familyId)
    .all();
}

export async function getWidget(db: D1Database, familyId: string, widgetId: string) {
  return db
    .prepare("SELECT * FROM widgets WHERE family_id = ? AND id = ?")
    .bind(familyId, widgetId)
    .first();
}

export async function createWidget(db: D1Database, familyId: string, body: WidgetBody) {
  const id = newId("wgt");
  await db
    .prepare("INSERT INTO widgets (id, family_id, title, points) VALUES (?, ?, ?, ?)")
    .bind(id, familyId, body.title, body.points)
    .run();
  return id;
}
```

## 3. Route — `apps/api/src/routes/widget.ts`
Route bevat NOOIT `.prepare(`/`.batch(` — alleen repo-aanroepen. Mutaties lopen via de
`Idempotency-Key`-header; punt-rakende mutaties via de FamilyRoom DO.
```ts
import { Hono } from "hono";
import { WidgetBody } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { listWidgets, createWidget } from "../repo/widget";

const widgets = new Hono<AppBindings>();

widgets.get("/", async (c) => {
  const { familyId } = requireParent(c);
  const rows = await listWidgets(c.env.DB, familyId);
  return c.json(rows.results);
});

widgets.post("/", validate("json", WidgetBody), async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const body = c.req.valid("json");
  const id = await createWidget(c.env.DB, familyId, body);
  return c.json({ id }, 201);
});

export default widgets;
```
Registreer in `apps/api/src/index.ts` (zoek waar de andere routers gemount worden):
```ts
app.route("/widgets", widgets);
```

## 4. Authz-test — `apps/api/test/widget.test.ts` (CI-verplicht)
Minimaal: cross-family weigeren (403/404) en rol-overschrijding weigeren.
```ts
import { describe, it, expect } from "vitest";
import { seedFamily, parentToken, childToken, api } from "./helpers";

describe("widget-authz", () => {
  it("kind kan geen widget aanmaken (403)", async () => {
    const fam = await seedFamily("wgt");
    const res = await api("/widgets", {
      method: "POST",
      token: await childToken(fam.childA, fam.familyId),
      body: { title: "Test", points: 10 },
    });
    expect(res.status).toBe(403);
  });

  it("ouder uit gezin A ziet niets van gezin B", async () => {
    const famA = await seedFamily("wga");
    const famB = await seedFamily("wgb");
    // ...maak een widget in famB, probeer die te lezen met famA's token → 404/403
  });
});
```

## Schema-migratie
Een nieuwe tabel? Voeg een nieuw genummerd migratiebestand toe (nooit een bestaande
wijzigen) — gebruik `/new-migration` of de `migration-writer` agent. De tabel krijgt een
`family_id`-kolom + index.
