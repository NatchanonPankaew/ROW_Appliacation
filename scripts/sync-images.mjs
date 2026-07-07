// Mirror only the images that the downloaded dataset actually references, so the
// app is fully self-hosted (no requests to roworlddb.com at runtime).
//
//   node scripts/sync-data.mjs      # run this first
//   node scripts/sync-images.mjs    # then this
//
// It replays the app's resolveIconUrl() rules over every local data file, builds
// the set of upstream image URLs, and downloads each one under public/ keeping
// the same /media/images/... path the app requests. 404s are skipped (some icons
// are missing upstream too).

import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readdir } from "node:fs/promises";

const ORIGIN = "https://roworlddb.com";
const BASE_IMG = ORIGIN + "/media/images/";
const DATA = new URL("../public/data/sea/", import.meta.url).pathname;
const PUBLIC = new URL("../public/", import.meta.url).pathname;
const LOCALES = ["en-US", "th-TH", "zh-TW"];

// Rune element -> elemental-stone icon (mirrors ELEMENT_ICON in roworlddb.ts).
const ELEMENT_ICON = {
  1: "icon_elementstone_wind_01",
  2: "icon_elementstone_land_01",
  3: "icon_elementstone_water_01",
  4: "icon_elementstone_fire_01",
};

let iconPaths = {};

// Returns the upstream image URL for an (iconName, iconUrl) pair, or null.
// Mirrors resolveIconUrl() in src/api/roworlddb.ts exactly.
function resolve(iconName, iconUrl) {
  if (iconName && iconPaths[iconName]) return BASE_IMG + iconPaths[iconName];
  if (iconUrl) {
    if (iconUrl.startsWith("http")) return iconUrl;
    if (iconUrl.startsWith("/")) return ORIGIN + iconUrl;
    return BASE_IMG + iconUrl;
  }
  return null;
}

const urls = new Set();
const add = (iconName, iconUrl) => {
  const u = resolve(iconName, iconUrl);
  if (u && u.startsWith(ORIGIN)) urls.add(u);
};

async function readJSON(rel) {
  try {
    return JSON.parse(await readFile(join(DATA, rel), "utf8"));
  } catch {
    return null;
  }
}

async function collect() {
  iconPaths = (await readJSON("skill-simulator/data/icon_paths.json")) || {};

  for (const loc of LOCALES) {
    const cards = await readJSON(`card-simulator/data/handbook_cards_${loc}.json`);
    (cards?.cards || []).forEach((c) => add(c.item_icon));

    const equip = await readJSON(`equipment/data/equipment_${loc}.json`);
    (equip?.items || []).forEach((it) =>
      add(it.icon, it.icon ? "item/" + it.icon + ".webp" : undefined)
    );

    const pets = await readJSON(`pet/data/pet_library_${loc}.json`);
    (pets?.pets || []).forEach((p) => add(p.icon, p.iconUrl));

    const mon = await readJSON(`monster-album/data/monster_album_${loc}.json`);
    (mon?.monsters || []).forEach((m) => add(m.image));

    const shop = await readJSON(`shop/data/shop_${loc}.json`);
    (shop?.items || []).forEach((it) => add(it.iconName));

    const runes = await readJSON(`skill-simulator/data/engine_runes_${loc}.json`);
    Object.values(runes?.baseItems || {}).forEach((r) =>
      add(r.icon || ELEMENT_ICON[r.element])
    );

    const idx = await readJSON(`skill-simulator/data/skills_index_${loc}.json`);
    const jobs = idx?.jobs || idx || {};
    Object.values(jobs).forEach((j) => add(j?.job_icon));

    // Equipment affixes (stunts): the stunt icons live in icon_paths, plus the
    // weapon-type / equip-slot icons the affix browser & planner show.
    const affixIdx = await readJSON(`affix-simulator/data/stunt_package_index_${loc}.json`);
    Object.values(affixIdx?.weapon_types || {}).forEach((t) => add(t?.icon));
    Object.values(affixIdx?.assembly_types || {}).forEach((t) => add(t?.icon));
    const affixLib = await readJSON(`affix-simulator/data/stunt_skill_library_${loc}.json`);
    Object.values(affixLib?.packages || {}).forEach((p) =>
      (p?.entries || []).forEach((e) => {
        const ic = (e?.stunt || e)?.icon;
        add(ic, ic ? "item/" + ic + ".webp" : undefined); // Taiwan stunt icons aren't in icon_paths
      })
    );

    // per-job skill icons
    try {
      const dir = join(DATA, `skill-simulator/data/jobs_${loc}`);
      for (const f of await readdir(dir)) {
        const d = JSON.parse(await readFile(join(dir, f), "utf8"));
        const job = d.job || d;
        // pass the skill/<icon>.webp fallback too: Taiwan-sourced skills (Bard/
        // Dancer/Alchemist) aren't in icon_paths, so resolve() would miss them.
        Object.values(job.skills || {}).forEach((s) =>
          add(s?.icon, s?.icon ? "skill/" + s.icon + ".webp" : undefined)
        );
      }
    } catch {
      /* no jobs dir for this locale */
    }
  }
}

let okCount = 0;
let skipCount = 0;
let failCount = 0;

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function download(url) {
  const rel = url.slice(ORIGIN.length).replace(/^\/+/, ""); // media/images/...
  const dest = join(PUBLIC, rel);
  if (await exists(dest)) {
    skipCount++;
    return;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    okCount++;
  } catch {
    failCount++;
  }
}

async function pool(items, size, fn) {
  const queue = [...items];
  let done = 0;
  const total = queue.length;
  const tick = () => {
    done++;
    if (done % 200 === 0 || done === total)
      process.stdout.write(`\r  ${done}/${total}  (ok ${okCount}, cached ${skipCount}, fail ${failCount})`);
  };
  const workers = Array.from({ length: size }, async () => {
    while (queue.length) {
      await fn(queue.shift());
      tick();
    }
  });
  await Promise.all(workers);
  process.stdout.write("\n");
}

async function main() {
  console.log("Collecting referenced image URLs from local dataset...");
  await collect();
  console.log("Unique images referenced: " + urls.size + "\n");
  console.log("Downloading -> public/media/images (skips 404 + already-cached)");
  await pool([...urls], 16, download);
  console.log(`\nDone. ${okCount} downloaded, ${skipCount} cached, ${failCount} failed/missing.`);
}

main();
