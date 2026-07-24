// Koppelt de test-runtime `env` (uit `cloudflare:test`) aan de echte binding-
// typen van de Worker. In @cloudflare/vitest-pool-workers >=0.18 is `env`
// getypeerd als `Cloudflare.Env` (niet meer de oude `ProvidedEnv`), dus we
// augmenteren die namespace. TEST_MIGRATIONS wordt door vitest.config.ts
// geïnjecteerd en bestaat alleen in tests.
import type { Env as WorkerEnv } from "../src/types";

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
