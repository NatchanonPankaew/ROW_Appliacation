// Sage (322 -> Scholar/323) and Rogue (622 -> Stalker/623) just got their real
// skill kits on the Taiwan dataset (site ROOT, no /sea prefix) while SEA still
// ships them as empty stubs (322/622/623 exist in the SEA index with 0 skills;
// 323 doesn't exist in en-US/th-TH's index at all yet). Mirror Taiwan's job
// files into the local SEA snapshot for all three locales, add the missing
// Scholar (323) index entry to en-US/th-TH (cloned from zh-TW's own SEA index,
// which already has it), and link it as Sage's child. en-US/th-TH job files
// land here still in Chinese; translate-tw-sage-rogue.mjs localizes them next.
// Idempotent; safe to re-run after every sync-data (SEA's index still lacks
// Scholar, so re-adding it every sync is required, same as Druid).
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://roworlddb.com"; // root host = Taiwan superset
const DATA = fileURLToPath(new URL("../public/data/sea/skill-simulator/data/", import.meta.url));
const LOCALES = ["en-US", "th-TH", "zh-TW"];
const IDS = [322, 323, 622, 623];
const NEW_IDS = [323]; // missing from en-US/th-TH's own index entirely
const PARENT_LINKS = { 323: 322 }; // job id -> parent whose children[] must list it

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + " HTTP " + r.status);
  return r.json();
}
async function readJSON(p) { try { return JSON.parse(await readFile(p, "utf8")); } catch { return null; } }
const clone = (o) => JSON.parse(JSON.stringify(o));

export async function mergeTwSageRogue() {
  // Our local zh-TW SEA index already carries all 4 ids (322/323/622/623), so
  // it's the source of truth for the shape of a fresh index entry (icon field
  // names differ from en-US/th-TH's "icon_jsxq_*" convention, patched in below).
  const twSeaIdx = await readJSON(DATA + "skills_index_zh-TW.json");
  const twSeaJobs = (twSeaIdx && (twSeaIdx.jobs || twSeaIdx)) || {};

  const jobFiles = {};
  for (const id of IDS) {
    jobFiles[id] = await fetchJSON(ORIGIN + "/skill-simulator/data/jobs_zh-TW/" + id + ".json");
  }

  for (const loc of LOCALES) {
    for (const id of IDS) {
      await writeFile(DATA + "jobs_" + loc + "/" + id + ".json", JSON.stringify(jobFiles[id]));
    }

    if (loc === "zh-TW") continue; // index already has all 4 ids correctly linked

    const idxPath = DATA + "skills_index_" + loc + ".json";
    const idx = await readJSON(idxPath);
    if (!idx) continue;
    const jm = idx.jobs || idx;

    for (const id of NEW_IDS) {
      if (jm[String(id)]) continue; // already added by a previous run
      const src = twSeaJobs[String(id)];
      if (!src) continue;
      const entry = clone(src);
      entry.job_name = "Scholar"; // 智者 -> matches Wizard/High Wizard naming style
      entry.job_icon = "icon_jsxq_" + id;
      entry.job_icon_big = "icon_jsxq_big_" + id;
      jm[String(id)] = entry;
    }

    for (const [childId, parentId] of Object.entries(PARENT_LINKS)) {
      const parent = jm[String(parentId)];
      const child = Number(childId);
      if (parent && Array.isArray(parent.children) && !parent.children.includes(child)) {
        parent.children.push(child);
      }
    }

    await writeFile(idxPath, JSON.stringify(idx));
  }
  console.log("  merged TW Sage/Rogue lines (322/323/622/623) into skills_index + job files");
}

if (import.meta.url === ("file://" + process.argv[1])) mergeTwSageRogue();
