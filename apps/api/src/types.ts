export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  KV: KVNamespace;
  FAMILY_DO: DurableObjectNamespace;
  PHOTO_QUEUE: Queue;
  EXPORT_QUEUE: Queue;
  JWT_SECRET: string;
  TURNSTILE_SECRET: string;
  APNS_KEY: string;
  APNS_KEY_ID: string;
  APNS_TEAM_ID: string;
  APPLE_CLIENT_ID: string;
  // E-mail (co-ouder-uitnodiging). Zonder deze secrets is verzenden een no-op.
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_BASE_URL?: string;
}

export interface AuthContext {
  userId: string;
  familyId: string;
  role: "parent" | "child";
  permissions: "full" | "approve_only";
}

export type AppBindings = { Bindings: Env; Variables: { auth: AuthContext } };
