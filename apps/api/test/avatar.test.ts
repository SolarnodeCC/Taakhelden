import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { api, childToken, parentToken, seedFamily } from "./helpers";

describe("phase3-avatar-authz", () => {
  it("kind ziet catalogus en eigen avatar-state", async () => {
    const fam = await seedFamily("av");
    const token = await childToken(fam.childA, fam.familyId);

    const catalog = await api("/avatar/catalog", { token });
    expect(catalog.status).toBe(200);
    const catalogBody = await catalog.json<{ items: Array<{ id: string }> }>();
    expect(catalogBody.items.length).toBeGreaterThan(0);

    const state = await api(`/members/${fam.childA}/avatar`, { token });
    expect(state.status).toBe(200);
    const body = await state.json<{ unlocked: string[]; level: number }>();
    expect(body.level).toBe(1);
    expect(body.unlocked).toContain("hat_starter");
  });

  it("kind mag sibling-avatar niet lezen of equippen", async () => {
    const fam = await seedFamily("avs");
    const token = await childToken(fam.childA, fam.familyId);

    const get = await api(`/members/${fam.childB}/avatar`, { token });
    expect(get.status).toBe(403);

    const patch = await api(`/members/${fam.childB}/avatar`, {
      method: "PATCH",
      token,
      idempotencyKey: "av-sibling",
      body: { hat: "hat_starter" },
    });
    expect(patch.status).toBe(403);
  });

  it("kind kan geen locked item equippen; wel starter-hat", async () => {
    const fam = await seedFamily("ave");
    const token = await childToken(fam.childA, fam.familyId);

    const locked = await api(`/members/${fam.childA}/avatar`, {
      method: "PATCH",
      token,
      idempotencyKey: "av-locked",
      body: { hat: "hat_level5" },
    });
    expect(locked.status).toBe(403);

    const ok = await api(`/members/${fam.childA}/avatar`, {
      method: "PATCH",
      token,
      idempotencyKey: "av-ok",
      body: { hat: "hat_starter" },
    });
    expect(ok.status).toBe(200);
    const body = await ok.json<{ equipped: { hat: string | null } }>();
    expect(body.equipped.hat).toBe("hat_starter");
  });

  it("ouder uit gezin A ziet avatar van gezin B niet", async () => {
    const famA = await seedFamily("ava");
    const famB = await seedFamily("avb");
    const tokenA = await parentToken(famA.parentId, famA.familyId);

    const res = await api(`/members/${famB.childA}/avatar`, { token: tokenA });
    expect(res.status).toBe(404);
  });

  it("level-unlock volgt lifetimeEarned", async () => {
    const fam = await seedFamily("avl");
    await env.DB.prepare(
      `INSERT INTO points_ledger (id, family_id, child_id, type, amount)
       VALUES ('pl_av1', ?, ?, 'task', 300)`,
    )
      .bind(fam.familyId, fam.childA)
      .run();

    const token = await childToken(fam.childA, fam.familyId);
    const state = await api(`/members/${fam.childA}/avatar`, { token });
    const body = await state.json<{ level: number; unlocked: string[] }>();
    expect(body.level).toBe(3);
    expect(body.unlocked).toContain("hat_level3");
  });
});
