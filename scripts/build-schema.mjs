#!/usr/bin/env node
// Régénère supabase/schema.sql = concaténation FIDÈLE de toutes les migrations.
// schema.sql est le chemin d'installation « copier-coller » recommandé
// (docs/04) ; il doit rester le reflet exact des fichiers de migration.
//
// Historique : une concaténation manuelle (`tail -n +8`) avait tronqué la 1ʳᵉ
// instruction de plusieurs migrations (0019, 0020…), cassant silencieusement
// ce chemin. Ce script reprend le fichier ENTIER de chaque migration — plus
// aucune troncature possible.
//
// Usage : node scripts/build-schema.mjs   (puis vérifier avec le harnais SQL)

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migDir = join(root, "supabase", "migrations");
const bar = "-- " + "═".repeat(75);

const files = readdirSync(migDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const first = files[0].slice(0, 4);
const last = files[files.length - 1].slice(0, 4);

const parts = [
  `-- Zabelie Digi — schéma complet (concaténation ${first}→${last}).`,
  "-- Généré pour un copier-coller unique dans le SQL Editor Supabase.",
  "-- Source de vérité = supabase/migrations/*.sql. Régénéré par",
  "-- scripts/build-schema.mjs (ne pas éditer ce fichier à la main).",
  "-- NE PAS exécuter _bootstrap.sql sur Supabase (réservé au Postgres nu en CI).",
  "",
];

for (const f of files) {
  const body = readFileSync(join(migDir, f), "utf8").replace(/\n+$/, "");
  parts.push(bar, `-- ${f}`, bar, "", body, "");
}

writeFileSync(join(root, "supabase", "schema.sql"), parts.join("\n") + "\n");
console.log(`schema.sql régénéré : ${files.length} migrations (${first}→${last}).`);
