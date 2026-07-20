import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
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
        },
      },
    },
  };
});
