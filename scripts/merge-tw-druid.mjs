// The Druid job line (901 Druid -> 912 Karnos -> 913 Alitea) is a brand-new base
// class that exists only on the Taiwan dataset (site ROOT, no /sea prefix) and
// only in zh-TW. SEA hasn't shipped it, so sync-data can't reach it the usual
// way. Mirror its skills_index entries + per-job skill files into the local SEA
// snapshot for all three locales (en-US/th-TH are seeded from zh-TW, then
// localized by translate-tw-druid.mjs). Novice (101) adopts 901 as a child so the
// branch renders in the planner. Idempotent; run after sync-data fetches SEA
// (the SEA index has no Druid, so re-adding it every sync is required).
import { readFile, writeFile } from "node:fs/promises";

const ORIGIN = "https://roworlddb.com"; // root host = Taiwan superset
const DATA = new URL("../public/data/sea/skill-simulator/data/", import.meta.url).pathname;
const LOCALES = ["en-US", "th-TH", "zh-TW"];
const DRUID_IDS = [901, 912, 913];

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + " HTTP " + r.status);
  return r.json();
}
async function readJSON(p) { try { return JSON.parse(await readFile(p, "utf8")); } catch { return null; } }
const clone = (o) => JSON.parse(JSON.stringify(o));

export async function mergeTwDruid() {
  // Index entries for the new line only exist in zh-TW on the TW root; reuse them
  // for every locale (translate-tw-druid.mjs localizes the job_name afterward).
  const twIdx = await fetchJSON(ORIGIN + "/skill-simulator/data/skills_index_zh-TW.json");
  const twJobs = twIdx.jobs || twIdx;
  const entries = {};
  for (const id of DRUID_IDS) if (twJobs[String(id)]) entries[id] = twJobs[String(id)];

  // Fetch each per-job skill file once (identical across locales at this stage).
  const jobFiles = {};
  for (const id of DRUID_IDS) {
    jobFiles[id] = await fetchJSON(ORIGIN + "/skill-simulator/data/jobs_zh-TW/" + id + ".json");
  }

  // The Druid icons exist on the media server (skill/<name>.webp, job/<name>.webp)
  // but the upstream icon_paths manifest hasn't been regenerated to include them.
  // Register them ourselves with the deterministic folder=prefix path so the app
  // resolves them and sync-images.mjs mirrors the actual files.
  const iconPath = DATA + "icon_paths.json";
  const icons = await readJSON(iconPath);
  if (icons) {
    const addIcon = (name) => {
      if (!name || icons[name]) return;
      const folder = (name.match(/^icon_([a-z]+)/) || [])[1]; // icon_skill_* -> skill
      if (folder) icons[name] = folder + "/" + name + ".webp";
    };
    for (const id of DRUID_IDS) {
      const job = jobFiles[id].job || jobFiles[id];
      addIcon(job.job_icon);
      for (const s of Object.values(job.skills || {})) addIcon(s.icon);
    }
    await writeFile(iconPath, JSON.stringify(icons));
  }

  for (const loc of LOCALES) {
    const idxPath = DATA + "skills_index_" + loc + ".json";
    const idx = await readJSON(idxPath);
    if (idx) {
      const jm = idx.jobs || idx;
      for (const id of DRUID_IDS) if (entries[id]) jm[String(id)] = clone(entries[id]);
      const nov = jm["101"];
      if (nov && Array.isArray(nov.children) && !nov.children.includes(901)) nov.children.push(901);
      await writeFile(idxPath, JSON.stringify(idx));
    }
    for (const id of DRUID_IDS) {
      await writeFile(DATA + "jobs_" + loc + "/" + id + ".json", JSON.stringify(jobFiles[id]));
    }
  }
  console.log("  merged TW Druid line (901/912/913) into skills_index + job files");
}

if (import.meta.url === ("file://" + process.argv[1])) mergeTwDruid();
