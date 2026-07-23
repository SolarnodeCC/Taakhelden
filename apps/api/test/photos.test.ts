/**
 * Fotoflow §3.6: upload-intent → signed PUT → confirm → EXIF-strip in de
 * queue-consumer → ready → foto-bonus bij de taak. Plus de privacygrens:
 * een foto wordt nooit zichtbaar mét metadata.
 */
import { describe, it, expect } from "vitest";
import { env, SELF } from "cloudflare:test";
import { seedFamily, seedTask, seedInstance, seedWeekFiller, childToken, parentToken, api, todayAmsterdam } from "./helpers";
import { processPhotos } from "../src/jobs/photoConsumer";

/** Mini-JPEG: SOI · APP1(Exif+nep-GPS) · APP0(JFIF) · SOS · data · EOI. */
function jpegWithExif(): ArrayBuffer {
  return jpegBytes().buffer as ArrayBuffer;
}

function jpegBytes(): Uint8Array {
  const exifPayload = [...new TextEncoder().encode("Exif\0\0GPSDATA-SECRET")];
  const app1 = [0xff, 0xe1, 0x00, exifPayload.length + 2, ...exifPayload];
  const jfifPayload = [...new TextEncoder().encode("JFIF\0"), 1, 2, 0, 0, 1, 0, 1, 0, 0];
  const app0 = [0xff, 0xe0, 0x00, jfifPayload.length + 2, ...jfifPayload];
  const sos = [0xff, 0xda, 0x00, 0x04, 0x01, 0x00, 0x12, 0x34, 0x56];
  return new Uint8Array([0xff, 0xd8, ...app1, ...app0, ...sos, 0xff, 0xd9]);
}

/** Handmatige queue-batch: deterministisch i.p.v. wachten op de runtime-consumer. */
function fakeBatch(photoId: string, familyId: string): MessageBatch {
  return {
    queue: "photo-processing",
    messages: [
      {
        id: "msg1",
        timestamp: new Date(),
        attempts: 1,
        body: { photoId, familyId },
        ack() {},
        retry() {},
      },
    ],
    ackAll() {},
    retryAll() {},
  } as unknown as MessageBatch;
}

async function uploadFlow(token: string, instanceId: string, familyId: string) {
  const intent = await api("/photos/upload-intent", {
    token,
    body: { purpose: "task", instanceId, contentType: "image/jpeg", bytes: 1000 },
  });
  expect(intent.status).toBe(201);
  const { photoId, uploadUrl } = (await intent.json()) as { photoId: string; uploadUrl: string };

  const put = await SELF.fetch(uploadUrl, { method: "PUT", body: jpegWithExif() });
  expect(put.status).toBe(200);

  const confirm = await api(`/photos/${photoId}/confirm`, { method: "POST", token });
  expect(confirm.status).toBe(200);

  await processPhotos(fakeBatch(photoId, familyId), env);
  return photoId;
}

describe("fotoflow: upload → strip → ready", () => {
  it("EXIF/GPS wordt gestript vóór de foto zichtbaar is", async () => {
    const fam = await seedFamily("pho");
    const taskId = await seedTask(fam.familyId, fam.childA, { photoBonusPoints: 5 });
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    await seedWeekFiller(fam.familyId, taskId, fam.childA, todayAmsterdam(), 4);
    const token = await childToken(fam.childA, fam.familyId);

    // Afvinken vóór de foto (approvalRequired=false → direct approved)
    await api(`/instances/${instanceId}/complete`, {
      method: "POST",
      token,
      idempotencyKey: crypto.randomUUID(),
    });

    const photoId = await uploadFlow(token, instanceId, fam.familyId);

    // Consumer heeft de metadata gestript: R2-object bevat geen GPS-data meer
    const photoRow = await env.DB
      .prepare("SELECT r2_key, status FROM photos WHERE family_id = ? AND id = ?")
      .bind(fam.familyId, photoId)
      .first<{ r2_key: string; status: string }>();
    expect(photoRow?.status).toBe("ready");
    const object = await env.PHOTOS.get(photoRow!.r2_key);
    const bytes = new TextDecoder("latin1").decode(await object!.arrayBuffer());
    expect(bytes).not.toContain("GPSDATA-SECRET");
    expect(bytes).toContain("JFIF"); // niet-metadata segmenten blijven staan

    // Koppelen aan de (al goedgekeurde) taak → foto-bonus direct geboekt
    const attach = await api(`/instances/${instanceId}/photo`, {
      method: "POST",
      token,
      body: { photoId },
    });
    expect(attach.status).toBe(200);
    const result = (await attach.json()) as { photoBonusPoints: number; newBalance: number };
    expect(result.photoBonusPoints).toBe(5);
    expect(result.newBalance).toBe(40); // 15 taak + 20 dagbonus + 5 foto-bonus

    // GET /photos/{id} geeft een korte signed URL die de gestripte bytes serveert
    const meta = await api(`/photos/${photoId}`, { token });
    const { url } = (await meta.json()) as { url: string };
    expect(url).toBeTruthy();
    const file = await SELF.fetch(url);
    expect(file.status).toBe(200);
    expect(file.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("foto-bonus bij approvalRequired: bonus volgt pas bij approve", async () => {
    const fam = await seedFamily("phb");
    const taskId = await seedTask(fam.familyId, fam.childA, {
      points: 10,
      approvalRequired: true,
      photoBonusPoints: 5,
    });
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    await seedWeekFiller(fam.familyId, taskId, fam.childA, todayAmsterdam(), 4);
    const token = await childToken(fam.childA, fam.familyId);

    await api(`/instances/${instanceId}/complete`, {
      method: "POST",
      token,
      idempotencyKey: crypto.randomUUID(),
    });
    const photoId = await uploadFlow(token, instanceId, fam.familyId);

    const attach = await api(`/instances/${instanceId}/photo`, {
      method: "POST",
      token,
      body: { photoId },
    });
    // Nog niet goedgekeurd: bonus staat klaar maar is niet geboekt
    expect(((await attach.json()) as { photoBonusPoints: number }).photoBonusPoints).toBe(0);

    const approve = await api(`/instances/${instanceId}/approve`, {
      method: "POST",
      token: await parentToken(fam.parentId, fam.familyId),
    });
    const result = (await approve.json()) as { photoBonusPoints: number; newBalance: number };
    expect(result.photoBonusPoints).toBe(5);
    expect(result.newBalance).toBe(35); // 10 + dagbonus 20 + foto 5
  });

  it("goedkeuringswachtrij: /instances/today toont photoId van een ingediende taak met foto", async () => {
    const fam = await seedFamily("phq");
    const taskId = await seedTask(fam.familyId, fam.childA, {
      approvalRequired: true,
      photoBonusPoints: 5,
    });
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    await seedWeekFiller(fam.familyId, taskId, fam.childA, todayAmsterdam(), 4);
    const childTok = await childToken(fam.childA, fam.familyId);

    await api(`/instances/${instanceId}/complete`, {
      method: "POST",
      token: childTok,
      idempotencyKey: crypto.randomUUID(),
    });
    const photoId = await uploadFlow(childTok, instanceId, fam.familyId);
    await api(`/instances/${instanceId}/photo`, { method: "POST", token: childTok, body: { photoId } });

    // Ouder ziet de ingediende taak mét de photoId, zodat het dashboard de foto
    // via GET /photos/{id} kan tonen in de goedkeuringswachtrij.
    const today = await api("/instances/today", { token: await parentToken(fam.parentId, fam.familyId) });
    const body = (await today.json()) as {
      children: { childId: string; instances: { id: string; status: string; photoId: string | null }[] }[];
    };
    const inst = body.children
      .flatMap((c) => c.instances)
      .find((i) => i.id === instanceId);
    expect(inst?.status).toBe("submitted");
    expect(inst?.photoId).toBe(photoId);
  });

  it("vervalste of verlopen signature op de transfer-URL → 403", async () => {
    const fam = await seedFamily("phs");
    const taskId = await seedTask(fam.familyId, fam.childA);
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    const token = await childToken(fam.childA, fam.familyId);

    const intent = await api("/photos/upload-intent", {
      token,
      body: { purpose: "task", instanceId, contentType: "image/jpeg", bytes: 100 },
    });
    const { uploadUrl } = (await intent.json()) as { uploadUrl: string };

    // Flip the first signature character to a guaranteed-different value so the
    // tamper is deterministic — replacing with a fixed char was a no-op (→ 200)
    // whenever the signature already started with that char, making this flaky.
    const tampered = uploadUrl.replace(/sig=(.)/, (_m, c: string) => `sig=${c === "0" ? "1" : "0"}`);
    const res = await SELF.fetch(tampered, { method: "PUT", body: jpegWithExif() });
    expect(res.status).toBe(403);
  });

  it("ander kind kan geen upload-intent op andermans taak doen (404)", async () => {
    const fam = await seedFamily("phx");
    const taskId = await seedTask(fam.familyId, fam.childA);
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());

    const res = await api("/photos/upload-intent", {
      token: await childToken(fam.childB, fam.familyId),
      body: { purpose: "task", instanceId, contentType: "image/jpeg", bytes: 100 },
    });
    expect(res.status).toBe(404);
  });

  it("onstripbare bytes worden nooit zichtbaar: object verwijderd, status failed", async () => {
    const fam = await seedFamily("phf");
    const taskId = await seedTask(fam.familyId, fam.childA);
    const instanceId = await seedInstance(fam.familyId, taskId, fam.childA, todayAmsterdam());
    const token = await childToken(fam.childA, fam.familyId);

    const intent = await api("/photos/upload-intent", {
      token,
      body: { purpose: "task", instanceId, contentType: "image/jpeg", bytes: 100 },
    });
    const { photoId, uploadUrl } = (await intent.json()) as { photoId: string; uploadUrl: string };
    // Geen geldige JPEG → strippen faalt → foto mag niet gepubliceerd worden
    await SELF.fetch(uploadUrl, { method: "PUT", body: new Uint8Array([1, 2, 3, 4]).buffer as ArrayBuffer });
    await api(`/photos/${photoId}/confirm`, { method: "POST", token });
    await processPhotos(fakeBatch(photoId, fam.familyId), env);

    const row = await env.DB
      .prepare("SELECT status, r2_key FROM photos WHERE family_id = ? AND id = ?")
      .bind(fam.familyId, photoId)
      .first<{ status: string; r2_key: string }>();
    expect(row?.status).toBe("failed");
    expect(await env.PHOTOS.get(row!.r2_key)).toBeNull();
  });

  it("profielfoto: ouder-intent → upload → consumer zet photo_key op het lid", async () => {
    const fam = await seedFamily("php");
    const parentTok = await parentToken(fam.parentId, fam.familyId);

    const intent = await api("/photos/upload-intent", {
      token: parentTok,
      body: { purpose: "profile", memberId: fam.childA, contentType: "image/jpeg", bytes: 100 },
    });
    expect(intent.status).toBe(201);
    const { photoId, uploadUrl } = (await intent.json()) as { photoId: string; uploadUrl: string };
    await SELF.fetch(uploadUrl, { method: "PUT", body: jpegWithExif() });
    await api(`/photos/${photoId}/confirm`, { method: "POST", token: parentTok });
    await processPhotos(fakeBatch(photoId, fam.familyId), env);

    const attach = await api(`/members/${fam.childA}/photo`, {
      token: parentTok,
      body: { photoId },
    });
    expect(attach.status).toBe(200);

    const row = await env.DB
      .prepare("SELECT photo_key FROM users WHERE family_id = ? AND id = ?")
      .bind(fam.familyId, fam.childA)
      .first<{ photo_key: string | null }>();
    expect(row?.photo_key).toContain(`profile/${fam.familyId}/`);
  });
});
