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
   * Required secret — dedicated key for photo/export signed URLs, deliberately
   * separate from JWT_SECRET (see services/secrets.ts). Signing fails closed
   * without it.
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
  /**
   * FCM HTTP v1 service account (Android push). Same fail-quiet contract as APNs:
   * without all three, `fcmSend` is a silent no-op, so dev/test never needs them.
   */
  FCM_PROJECT_ID?: string;
  FCM_CLIENT_EMAIL?: string;
  FCM_PRIVATE_KEY?: string;
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
