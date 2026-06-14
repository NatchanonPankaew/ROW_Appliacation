// Mirror the roworlddb.com SEA dataset into ./public/data so the app can serve
// its own copy (no CORS proxy, no dependency on the upstream site staying up).
//
//   node scripts/sync-data.mjs
//
// Re-run any time you want to refresh the snapshot. Files keep the exact same
// path layout under public/data/sea/... so the app only needs BASE_DATA pointed
// at our own host instead of roworlddb.com.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ORIGIN = "https://roworlddb.com";
const BASE = ORIGIN + "/sea";
const OUT = new URL("../public/data/sea/", import.meta.url); // -> public/data/sea
const LOCALES = ["en-US", "th-TH", "zh-TW"];

// Per-locale endpoints (relative to /sea). {loc} is substituted with the locale.
const PER_LOCALE = [
  "card-simulator/data/handbook_cards_{loc}.json",
  "equipment/data/equipment_{loc}.json",
  "pet/data/pet_library_{loc}.json",
  "monster-album/data/monster_album_{loc}.json",
  "skill-simulator/data/skills_index_{loc}.json",
  "shop/data/shop_{loc}.json",
  "map-simulator/data/map_index_{loc}.json",
  "apocalypse-simulator/data/apocalypse_planner_{loc}.json",
  "skill-simulator/data/engine_runes_{loc}.json",
];

// Locale-independent files.
const SHARED = ["skill-simulator/data/icon_paths.json"];

let okCount = 0;
let failCount = 0;

async function outPath(rel) {
  const p = join(new URL(OUT).pathname, rel);
  await mkdir(dirname(p), { recursive: true });
  return p;
}

// Fetch a /sea-relative path and save it under public/data/sea/<rel>.
// Returns the parsed JSON (or null on failure) so callers can read it.
async function grab(rel, { quiet = false } = {}) {
  const url = BASE + "/" + rel;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    await writeFile(await outPath(rel), text);
    okCount++;
    if (!quiet) console.log("  ok   " + rel + "  (" + text.length + "b)");
    return JSON.parse(text);
  } catch (e) {
    failCount++;
    if (!quiet) console.warn("  FAIL " + rel + "  " + e.message);
    return null;
  }
}

// Limited-concurrency map so we don't open hundreds of sockets at once.
async function pool(items, size, fn) {
  const queue = [...items];
  const workers = Array.from({ length: size }, async () => {
    while (queue.length) await fn(queue.shift());
  });
  await Promise.all(workers);
}

async function main() {
  console.log("Syncing roworlddb dataset -> public/data/sea\n");

  for (const rel of SHARED) await grab(rel);

  for (const loc of LOCALES) {
    console.log("\n[" + loc + "]");
    for (const tmpl of PER_LOCALE) await grab(tmpl.replace("{loc}", loc));

    // Per-job skill files: jobs_<loc>/<job_id>.json, ids come from skills_index.
    const idx = await grab("skill-simulator/data/skills_index_" + loc + ".json", { quiet: true });
    const jobs = idx ? (idx.jobs || idx) : {};
    const ids = Object.values(jobs)
      .map((j) => j && j.job_id)
      .filter((v) => v != null);
    console.log("  jobs: fetching " + ids.length + " skill files...");
    await pool(ids, 8, (id) =>
      grab("skill-simulator/data/jobs_" + loc + "/" + id + ".json", { quiet: true })
    );
  }

  console.log("\nDone. " + okCount + " ok, " + failCount + " failed.");
}

main();
