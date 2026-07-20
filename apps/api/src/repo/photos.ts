import type { PhotoStatus } from "@taakhelden/shared";

export interface PhotoRow {
  id: string;
  family_id: string;
  owner_id: string;
  purpose: "task" | "profile";
  ref_id: string | null;
  r2_key: string;
  content_type: string;
  bytes: number;
  status: PhotoStatus;
  created_at: string;
}

export async function insertPhoto(
  db: D1Database,
  familyId: string,
  input: {
    id: string;
    ownerId: string;
    purpose: "task" | "profile";
    refId: string;
    r2Key: string;
    contentType: string;
    bytes: number;
  },
) {
  await db
    .prepare(
      `INSERT INTO photos (id, family_id, owner_id, purpose, ref_id, r2_key, content_type, bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(input.id, familyId, input.ownerId, input.purpose, input.refId, input.r2Key, input.contentType, input.bytes)
    .run();
}

export async function getPhoto(db: D1Database, familyId: string, photoId: string) {
  return db
    .prepare("SELECT * FROM photos WHERE family_id = ? AND id = ?")
    .bind(familyId, photoId)
    .first<PhotoRow>();
}

export async function setPhotoStatus(db: D1Database, familyId: string, photoId: string, status: PhotoStatus) {
  await db
    .prepare("UPDATE photos SET status = ? WHERE family_id = ? AND id = ?")
    .bind(status, familyId, photoId)
    .run();
}

/** Na de EXIF-strip: gekoppelde taak-instances op 'ready' zetten. */
export async function markInstancePhotoReady(db: D1Database, familyId: string, r2Key: string) {
  await db
    .prepare("UPDATE task_instances SET photo_status = 'ready' WHERE family_id = ? AND photo_key = ?")
    .bind(familyId, r2Key)
    .run();
}

/** Profielfoto koppelen aan een gezinslid. */
export async function setMemberPhotoKey(db: D1Database, familyId: string, memberId: string, r2Key: string) {
  await db
    .prepare("UPDATE users SET photo_key = ? WHERE family_id = ? AND id = ? AND deleted_at IS NULL")
    .bind(r2Key, familyId, memberId)
    .run();
}
