/** Augments OpenNext's CloudflareEnv with TaakHelden web-worker bindings. */
declare global {
  interface CloudflareEnv {
    /** Upstream API Worker base URL, including `/v1` (see wrangler.jsonc vars). */
    API_BASE_URL?: string;
    /**
     * Service binding to `taakhelden-api`. Required for Worker→Worker calls on
     * the same `*.workers.dev` zone (global fetch between them fails).
     */
    API?: Fetcher;
  }
}

export {};
