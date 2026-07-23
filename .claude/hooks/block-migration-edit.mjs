#!/usr/bin/env node
/**
 * PreToolUse-hook: blokkeert wijzigingen aan BESTAANDE D1-migraties.
 * Regel (CLAUDE.md): migraties zijn genummerd en onveranderlijk — voeg een nieuw
 * genummerd bestand toe in plaats van een bestaande te wijzigen.
 *
 * Exit 2 => geblokkeerd (Claude ziet de stderr en corrigeert).
 * Een nieuw migratiebestand aanmaken (Write op een nog niet bestaand pad) is toegestaan.
 */
import { readFileSync, existsSync } from "node:fs";

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
  process.exit(0); // geen bruikbare input => niets te blokkeren
}

const tool = data.tool_name ?? "";
const filePath = data.tool_input?.file_path ?? "";

const isNumberedMigration = /apps\/api\/migrations\/\d+[^/]*\.sql$/.test(filePath);

if (isNumberedMigration) {
  const modifiesExisting =
    tool === "Edit" ||
    tool === "MultiEdit" ||
    tool === "NotebookEdit" ||
    (tool === "Write" && existsSync(filePath));

  if (modifiesExisting) {
    console.error(
      "❌ Bestaande migraties mogen nooit gewijzigd worden (CLAUDE.md).\n" +
        `   Bestand: ${filePath}\n` +
        "   Maak in plaats daarvan een nieuw genummerd migratiebestand aan " +
        "(bijv. via /new-migration of de migration-writer agent).",
    );
    process.exit(2);
  }
}

process.exit(0);
