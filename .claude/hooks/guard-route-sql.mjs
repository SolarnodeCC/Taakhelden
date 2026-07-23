#!/usr/bin/env node
/**
 * PostToolUse-hook: waarschuwt wanneer een route-bestand ruwe SQL bevat.
 * Regel 1 (CLAUDE.md): routes praten nooit rechtstreeks met D1 — alle SQL leeft in
 * apps/api/src/repo/. Routes roepen alleen repo-functies aan.
 *
 * Advisory: exit 2 met een melding op stderr zodat Claude het oppakt, maar dit blokkeert
 * geen al uitgevoerde edit (PostToolUse draait ná de wijziging).
 */
import { readFileSync } from "node:fs";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

let data = {};
try {
  data = JSON.parse(readStdin() || "{}");
} catch {
  process.exit(0);
}

const filePath = data.tool_input?.file_path ?? "";

if (!/apps\/api\/src\/routes\/.+\.ts$/.test(filePath)) {
  process.exit(0);
}

let contents = "";
try {
  contents = readFileSync(filePath, "utf8");
} catch {
  process.exit(0);
}

// Ruwe SQL-signalen: D1-prepared statements of los SQL-keyword in een string.
const sqlSignals = [
  /\.prepare\s*\(/,
  /\.batch\s*\(/,
  /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i,
];

const hit = sqlSignals.find((re) => re.test(contents));

if (hit) {
  console.error(
    "⚠️  Route bevat mogelijk ruwe SQL: " +
      `${filePath}\n` +
      "   Regel 1 (CLAUDE.md): routes praten nooit rechtstreeks met D1. " +
      "Verplaats de query naar apps/api/src/repo/ en roep die repo-functie aan " +
      "(familyId als eerste argument).",
  );
  process.exit(2);
}

process.exit(0);
