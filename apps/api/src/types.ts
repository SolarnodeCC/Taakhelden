export interface Env {
  // Bindings (wrangler.toml)
  DB: D1Database;
  PHOTOS: R2Bucket;
  KV: KVNamespace;
  FAMILY_DO: DurableObjectNamespace;
  PHOTO_QUEUE: Queue;
  EXPORT_QUEUE: Queue;

  // Required secret — auth / signed URLs fail closed without it.
  JWT_SECRET: string;

  // Plain vars (wrangler.toml [vars]) — may also be overridden as secrets.
  APP_BASE_URL?: string;
  APNS_ENV?: "sandbox" | "production";
  APPLE_CLIENT_ID?: string;
  APPLE_BUNDLE_ID?: string;

  // Optional secrets — features no-op or skip when unset (see services/*).
  TURNSTILE_SECRET?: string;
  APNS_KEY?: string;
  APNS_KEY_ID?: string;
  APNS_TEAM_ID?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
}

export interface AuthContext {
  userId: string;
  familyId: string;
  role: "parent" | "child";
  permissions: "full" | "approve_only";
}

export type AppBindings = { Bindings: Env; Variables: { auth: AuthContext } };
