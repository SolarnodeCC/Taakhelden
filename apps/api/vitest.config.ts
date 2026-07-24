import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// vitest-pool-workers >=0.18 (vitest 4): de pool draait nu als Vite-plugin
// (`cloudflareTest`) i.p.v. `defineWorkersConfig` + `test.poolOptions.workers`.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return {
    plugins: [
      cloudflareTest({
        // R2-writes + queue-delivery verdragen de isolated-storage-stack niet
        // (WAL-bestanden bij het poppen); tests gebruiken unieke seeds per test,
        // dus gedeelde storage per run is veilig.
        isolatedStorage: false,
        singleWorker: true,
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            // Secrets die in productie via `wrangler secret` komen:
            JWT_SECRET: "test-secret-not-for-production",
            TURNSTILE_SECRET: "", // leeg = Turnstile-check uit (zie services/turnstile.ts)
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
