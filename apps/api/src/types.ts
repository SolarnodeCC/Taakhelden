export interface Env {
  // Bindings (wrangler.toml)
  DB: D1Database;
  PHOTOS: R2Bucket;
  KV: KVNamespace;
  FAMILY_DO: DurableObjectNamespace;
  PHOTO_QUEUE: Queue;
  EXPORT_QUEUE: Queue;

  // Required secret — auth fails closed without it.
  JWT_SECRET: string;
  /**
   * Optional dedicated HMAC key for photo/export signed URLs.
   * Falls back to JWT_SECRET when unset (see services/secrets.ts).
   */
  HMAC_SECRET?: string;

  // Plain vars (wrangler.toml [vars]) — may also be overridden as secrets.
  APP_BASE_URL?: string;
  APNS_ENV?: "sandbox" | "production";
  APPLE_CLIENT_ID?: string;
  APPLE_BUNDLE_ID?: string;

  /** Required secret — registration fails closed without it (services/turnstile.ts). */
  TURNSTILE_SECRET?: string;
  /**
   * Explicit dev/test escape for the Turnstile check ("true" to skip). Never set
   * in wrangler.toml or by the deploy workflow, so production cannot fall into it.
   */
  TURNSTILE_DEV_BYPASS?: string;

  // Optional secrets — features no-op or skip when unset (see services/*).
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
