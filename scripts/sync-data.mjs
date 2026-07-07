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
import { translateTwSkills } from "./translate-tw-skills.mjs";
import { mergeTwAffixes } from "./merge-tw-affixes.mjs";
import { applyTwAffixTh } from "./apply-tw-affix-th.mjs";
import { mergeTwEquipment } from "./merge-tw-equipment.mjs";
import { applyTwEquipTh } from "./apply-tw-equip-th.mjs";

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
  "affix-simulator/data/stunt_package_index_{loc}.json",
  "affix-simulator/data/stunt_skill_library_{loc}.json",
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
    // Some advancement classes (e.g. Paladin/223, Champion/523) are referenced as
    // a parent but missing from the index; their skill files still exist upstream,
    // so mirror them too — the app heals the tree from these (see fetchSkillIndex).
    const present = new Set(ids.map(Number));
    const missingParents = Object.values(jobs)
      .map((j) => j && Number(j.parent))
      .filter((p) => p && !present.has(p));
    const allIds = [...new Set([...ids, ...missingParents])];
    console.log("  jobs: fetching " + allIds.length + " skill files...");
    await pool(allIds, 8, (id) =>
      grab("skill-simulator/data/jobs_" + loc + "/" + id + ".json", { quiet: true })
    );

    // Classes the SEA server hasn't shipped skills for yet (Alchemist/Bard/Dancer)
    // already have full skill data on the Taiwan dataset (served from the site
    // ROOT, no /sea prefix). Overwrite the empty SEA job files with Taiwan's so
    // they show real skills. Drop an id here once SEA ships its own data.
    const TW_SKILL_JOBS = [422, 432, 722, 423, 433, 723];
    for (const id of TW_SKILL_JOBS) {
      const rel = "skill-simulator/data/jobs_" + loc + "/" + id + ".json";
      try {
        const res = await fetch(ORIGIN + "/" + rel); // root host = Taiwan
        if (!res.ok) continue;
        const text = await res.text();
        const job = JSON.parse(text).job || JSON.parse(text);
        if (job && job.skills && Object.keys(job.skills).length) {
          await writeFile(await outPath(rel), text);
          okCount++;
          console.log("  ok   " + rel + "  (Taiwan, " + Object.keys(job.skills).length + " skills)");
        }
      } catch (e) {
        failCount++;
      }
    }
  }

  // Localize the Taiwan-sourced skill files (Bard/Dancer/Alchemist) to EN/TH.
  await translateTwSkills();
  // Pull Taiwan's fuller affix set (instrument/whip/knuckle + new classes) in,
  // keeping SEA's existing localized affix text.
  await mergeTwAffixes();
  // Translate the Taiwan-only affixes (new classes) that arrive with Chinese
  // name/desc into Thai using the map in tw-affix-th.json.
  await applyTwAffixTh();
  // Pull Taiwan's fuller equipment set (instrument/whip/knuckle + event gear) in,
  // then translate the Taiwan-only item names to Thai.
  await mergeTwEquipment();
  await applyTwEquipTh();

  console.log("\nDone. " + okCount + " ok, " + failCount + " failed.");
}

main();
