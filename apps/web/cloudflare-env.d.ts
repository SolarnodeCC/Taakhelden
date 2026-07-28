/** Augments OpenNext's CloudflareEnv with TaakHelden web-worker bindings. */
declare global {
  interface CloudflareEnv {
    /** Upstream API Worker base URL, including `/v1` (see wrangler.jsonc vars). */
    API_BASE_URL?: string;
    /**
   * Service binding to `taakhelden-api`. Required on Cloudflare for Worker→Worker
   * calls on the same `*.workers.dev` zone (see wrangler.jsonc `services`).
   */
  API: Fetcher;
  }
}

export {};
