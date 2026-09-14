// roworlddb's en-US/th-TH map-simulator dropped the entire Glast Heim dungeon
// complex (the outdoor ruins + all 8 interior floors) — zh-TW's map_index and
// map_monster_spawns still have it in full, confirming this is missing data
// upstream, not removed content. Pull it in: map_configs (name/background/
// coords) for all 9 scenes, plus their mvp/elite/mini monster spawn markers.
// (Their chest/kafra/observation points don't need merging — en-US/th-TH's
// OWN interactive_placing files already carry those for every scene that has
// any; adding the map_configs entry is what lets them render at all.)
//
// None of these 24 monster ids exist in en-US/th-TH's monster_album yet
// either (only zh-TW has them), so map markers use a hand-translated name
// below rather than a lookup — best-effort naming (several already match an
// existing card name from the same content drop, e.g. Dark Lord/Owl Baron/
// Godslayer/Spider Queen/Abyss Knight — see merge-tw-cards.mjs), not a
// verified official English name. Portraits are backfilled from zh-TW's
// monster_album `image` field (locale-independent filename) since the raw
// spawn data itself carries no image field at all, even on zh-TW.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://roworlddb.com";
const DATA = fileURLToPath(new URL("../public/data/sea/", import.meta.url));
const LOCALES = ["en-US", "th-TH"];

const MAP_NAME_EN = {
  108: "Glast Heim",
  10801: "Glast Heim Castle 1F",
  10802: "Glast Heim Castle 2F",
  10803: "Glast Heim Chivalry 1F",
  10804: "Glast Heim Chivalry 2F",
  10805: "Glast Heim Abbey",
  10806: "Glast Heim Underground Cemetery",
  10807: "Glast Heim Prison",
  10808: "Glast Heim Culvert",
};

// monster_id -> best-effort English name (see file header)
const MONSTER_NAME_EN = {
  55025: "Contaminated Ghost Archer",
  55026: "Fangtooth Beast",
  55027: "Owl Chief",
  55028: "Contaminated Ghost Swordsman",
  55029: "Abyss Knight",
  55030: "Contaminated Sting",
  55031: "Godslayer",
  55032: "Illusion King",
  55033: "Contaminated Evil Ronin",
  55034: "Contaminated Spider Queen",
  50086: "Mighty Wind Wizard",
  50087: "Enraged Evil Envoy",
  50088: "Elite Dark Priest",
  50089: "Sly Khalitz Jester",
  50090: "Elite Bat Archer",
  50091: "Enraged Tigersaur",
  50092: "Sly Sting",
  50093: "Enraged Evil Ronin",
  50094: "Swift Ghost Swordsman",
  50095: "Enraged Berserk Minos",
  50096: "Enraged Dark Priest",
  50097: "Elite Zombie Prisoner",
  80018: "Dark Lord",
  80020: "Owl Baron",
};

const SCENES = Object.keys(MAP_NAME_EN).map(Number);

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + " HTTP " + r.status);
  return r.json();
}

async function readLocal(rel) {
  try { return JSON.parse(await readFile(DATA + rel, "utf8")); }
  catch { return null; }
}
async function writeLocal(rel, obj) {
  await writeFile(DATA + rel, JSON.stringify(obj));
}

export async function mergeTwMaps() {
  const [zhIndex, zhSpawns, zhAlbum] = await Promise.all([
    fetchJSON(ORIGIN + "/sea/map-simulator/data/map_index_zh-TW.json"),
    fetchJSON(ORIGIN + "/sea/map-simulator/data/map_monster_spawns_zh-TW.json"),
    fetchJSON(ORIGIN + "/sea/monster-album/data/monster_album_zh-TW.json"),
  ]);
  const portraitById = new Map(zhAlbum.monsters.map((m) => [m.id, m.image]));

  for (const loc of LOCALES) {
    // --- map_configs: add the 9 scenes, translated, if missing ---
    const idxRel = `map-simulator/data/map_index_${loc}.json`;
    const idx = await readLocal(idxRel);
    let addedCfg = 0;
    if (idx) {
      for (const id of SCENES) {
        if (idx.map_configs[id]) continue;
        const cfg = zhIndex.map_configs[String(id)];
        if (!cfg) continue;
        idx.map_configs[id] = { ...cfg, name: MAP_NAME_EN[id] };
        addedCfg++;
      }
      if (addedCfg) await writeLocal(idxRel, idx);
    }

    // --- map_monster_spawns: add the 9 views, translated, if missing ---
    const spawnsRel = `map-simulator/data/map_monster_spawns_${loc}.json`;
    const spawns = await readLocal(spawnsRel);
    let addedViews = 0, addedGroups = 0;
    if (spawns) {
      for (const id of SCENES) {
        if (spawns.views[id]) continue;
        const view = zhSpawns.views[String(id)];
        if (!view) continue;
        spawns.views[id] = {
          map_id: view.map_id,
          monsters: (view.monsters || []).map((g) => ({
            ...g,
            name: MONSTER_NAME_EN[g.monster_id] || g.name,
            image: portraitById.get(g.monster_id) || g.image,
          })),
        };
        addedViews++;
        addedGroups += (view.monsters || []).length;
      }
      if (addedViews) await writeLocal(spawnsRel, spawns);
    }

    console.log(
      "  maps[" + loc + "]: +" + addedCfg + " Glast Heim configs, +" + addedViews +
      " monster-spawn views (" + addedGroups + " groups)"
    );
  }
}

if (import.meta.url === ("file://" + process.argv[1])) mergeTwMaps();
