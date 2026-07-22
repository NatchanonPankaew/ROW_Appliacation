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
import { fileURLToPath } from "node:url";

const ORIGIN = "https://roworlddb.com";
const BASE_IMG = ORIGIN + "/media/images/";
const DATA = fileURLToPath(new URL("../public/data/sea/", import.meta.url));
const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));
const LOCALES = ["en-US", "th-TH", "zh-TW"];

// Rune element -> elemental-stone icon (mirrors ELEMENT_ICON in roworlddb.ts).
const ELEMENT_ICON = {
  1: "icon_elementstone_wind_01",
  2: "icon_elementstone_land_01",
  3: "icon_elementstone_water_01",
  4: "icon_elementstone_fire_01",
};

// Gem (enchant stone) icons used by the Gems tab — mirrors GEM_DEFS in
// roworlddb.ts. These live under /media/images/item/ but only appear inside
// shop boxPreview blobs, so the generic collectors above never reach them.
const GEM_ICONS = [
  ...[1, 4, 5, 10, 11, 12, 13, 14, 15, 16, 22, 24, 25, 26].map(
    (n) => "icon_item_enchantstone_" + String(n).padStart(2, "0")
  ),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 26, 27, 28, 29, 30, 31, 33, 34, 35].map(
    (n) => "icon_item_stone_" + String(n).padStart(2, "0")
  ),
];

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

// Equipment icons whose name isn't in icon_paths: the app requests a deterministic
// path (folder = icon prefix, e.g. icon_weapon_* -> weapon/), but upstream is
// inconsistent — a few legacy icons (icon_weapon_Dagger_*) actually live under
// item/. So mirror by PROBING candidate folders upstream and saving to the exact
// local path the app will ask for. localRel -> [candidate upstream URLs].
const equipTasks = new Map();
const EQUIP_FOLDERS = ["item", "weapon", "equip", "shadowequip", "helmet"];
const addEquip = (icon) => {
  if (!icon) return;
  if (iconPaths[icon]) { add(icon); return; }         // resolves via icon_paths
  const m = icon.match(/^icon_([a-z]+)/);
  const local = (m ? m[1] : "item") + "/" + icon + ".webp";
  const rel = "media/images/" + local;
  if (equipTasks.has(rel)) return;
  const folders = [...new Set([(m ? m[1] : "item"), ...EQUIP_FOLDERS])];
  equipTasks.set(rel, folders.map((f) => BASE_IMG + f + "/" + icon + ".webp"));
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

  for (const g of GEM_ICONS) add(undefined, "item/" + g + ".webp");

  for (const loc of LOCALES) {
    const cards = await readJSON(`card-simulator/data/handbook_cards_${loc}.json`);
    (cards?.cards || []).forEach((c) => add(c.item_icon));

    const equip = await readJSON(`equipment/data/equipment_${loc}.json`);
    (equip?.items || []).forEach((it) => addEquip(it.icon));

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
    // rune-type (ember) icons: /media/images/ember/<icon>_<color>.webp — mirror
    // all 5 color variants since the Runes tab lets you recolor them (1-5).
    Object.values(runes?.effectGroups || {}).forEach((g) => {
      if (g?.icon) for (let c = 1; c <= 5; c++) add(undefined, `ember/${g.icon}_${c}.webp`);
      else add(ELEMENT_ICON[g?.elementId]);
    });

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

    // map viewer: background art, spawn/quest marker icons, monster head
    // portraits, and card-reward item icons (given as absolute iconPath).
    const mapIdx = await readJSON(`map-simulator/data/map_index_${loc}.json`);
    Object.values(mapIdx?.map_configs || {}).forEach((c) => c?.pic_res && add(undefined, `map/${c.pic_res}.webp`));
    (mapIdx?.world_maps || []).forEach((m) => m?.pic_res && add(undefined, `map/${m.pic_res}.webp`));

    const spawns = await readJSON(`map-simulator/data/map_monster_spawns_${loc}.json`);
    Object.values(spawns?.views || {}).forEach((v) => (v?.monsters || []).forEach((m) => {
      if (m?.icon) add(undefined, `map_mark/${m.icon}.webp`);
      if (m?.image) add(undefined, `monster/${m.image}.webp`);
    }));

    const placingIdx = await readJSON(`map-simulator/data/interactive_placing_${loc}/_index.json`);
    (placingIdx || []).forEach((e) => e?.typeIcon && add(undefined, `map_mark/${e.typeIcon}.webp`));

    const cardPoints = await readJSON(`map-simulator/data/interactive_placing_${loc}/monster_cards.json`);
    if (cardPoints?.meta?.typeIcon) add(undefined, `map_mark/${cardPoints.meta.typeIcon}.webp`);
    Object.values(cardPoints?.data || {}).forEach((arr) => (arr || []).forEach((e) => {
      if (e?.markIcon) add(undefined, `map_mark/${e.markIcon}.webp`);
      (e?.rewardItems || []).forEach((r) => r?.iconPath && add(undefined, r.iconPath));
    }));

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

// Try each candidate upstream URL; save the first that exists to the fixed local
// path (rel). Lets the app use one deterministic path despite upstream drift.
async function downloadEquip(rel) {
  const dest = join(PUBLIC, rel);
  if (await exists(dest)) { skipCount++; return; }
  for (const url of equipTasks.get(rel)) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      okCount++;
      return;
    } catch { /* try next candidate */ }
  }
  failCount++;
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
  console.log(`Equipment icons (probe candidate folders): ${equipTasks.size}`);
  await pool([...equipTasks.keys()], 16, downloadEquip);
  console.log(`\nDone. ${okCount} downloaded, ${skipCount} cached, ${failCount} failed/missing.`);
}

main();
