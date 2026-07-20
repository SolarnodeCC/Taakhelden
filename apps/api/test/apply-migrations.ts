import { applyD1Migrations, env } from "cloudflare:test";

// Draait vóór elk testbestand: schema uit apps/api/migrations toepassen.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
