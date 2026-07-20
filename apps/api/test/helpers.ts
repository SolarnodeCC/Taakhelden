import { env, SELF } from "cloudflare:test";
import { signJwt } from "../src/services/jwt";

let counter = 0;

/** Seed een gezin met één ouder en twee kinderen, rechtstreeks in D1. */
export async function seedFamily(prefix: string) {
  counter++;
  const familyId = `fam_${prefix}${counter}`;
  const parentId = `usr_${prefix}${counter}`;
  const childA = `ch_${prefix}${counter}a`;
  const childB = `ch_${prefix}${counter}b`;

  await env.DB.batch([
    env.DB
      .prepare("INSERT INTO families (id, name, invite_code) VALUES (?, ?, ?)")
      .bind(familyId, `Gezin ${prefix}`, `${prefix.toUpperCase().padEnd(4, "X")}${String(counter).padStart(2, "0")}`),
    env.DB
      .prepare(
        `INSERT INTO users (id, family_id, role, permissions, display_name, email)
         VALUES (?, ?, 'parent', 'full', 'Ouder', ?)`,
      )
      .bind(parentId, familyId, `${prefix}${counter}@test.local`),
    env.DB
      .prepare(
        "INSERT INTO users (id, family_id, role, display_name, birth_year, age_mode) VALUES (?, ?, 'child', 'Noor', 2017, 'mid')",
      )
      .bind(childA, familyId),
    env.DB
      .prepare(
        "INSERT INTO users (id, family_id, role, display_name, birth_year, age_mode) VALUES (?, ?, 'child', 'Sam', 2015, 'mid')",
      )
      .bind(childB, familyId),
  ]);

  return { familyId, parentId, childA, childB };
}

export async function seedTask(
  familyId: string,
  childId: string,
  opts: { points?: number; approvalRequired?: boolean; photoBonusPoints?: number } = {},
) {
  counter++;
  const taskId = `tsk_test${counter}`;
  await env.DB
    .prepare(
      `INSERT INTO tasks (id, family_id, title, points, approval_required, photo_bonus_points, assignees)
       VALUES (?, ?, 'Testtaak', ?, ?, ?, ?)`,
    )
    .bind(
      taskId,
      familyId,
      opts.points ?? 15,
      opts.approvalRequired ? 1 : 0,
      opts.photoBonusPoints ?? 0,
      JSON.stringify([childId]),
    )
    .run();
  return taskId;
}

export async function seedInstance(familyId: string, taskId: string, childId: string, date: string) {
  counter++;
  const instanceId = `ti_test${counter}`;
  await env.DB
    .prepare(
      "INSERT INTO task_instances (id, task_id, family_id, child_id, date) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(instanceId, taskId, familyId, childId, date)
    .run();
  return instanceId;
}

export function parentToken(userId: string, familyId: string, opts: { perm?: "full" | "approve_only"; ttl?: number } = {}) {
  return signJwt(
    { sub: userId, fam: familyId, role: "parent", perm: opts.perm ?? "full" },
    env.JWT_SECRET,
    opts.ttl ?? 3600,
  );
}

export function childToken(userId: string, familyId: string, opts: { ttl?: number } = {}) {
  return signJwt({ sub: userId, fam: familyId, role: "child" }, env.JWT_SECRET, opts.ttl ?? 3600);
}

export function api(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; idempotencyKey?: string } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  return SELF.fetch(`https://api.test/v1${path}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

/** Datum van vandaag in Europe/Amsterdam — consistent met de API-defaults. */
export function todayAmsterdam(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
