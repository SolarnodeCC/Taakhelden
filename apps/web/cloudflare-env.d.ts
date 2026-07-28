/** Augments OpenNext's CloudflareEnv with TaakHelden web-worker bindings. */
declare global {
  interface CloudflareEnv {
    /** Upstream API Worker base URL, including `/v1` (see wrangler.jsonc vars). */
    API_BASE_URL?: string;
  }
}

export {};
