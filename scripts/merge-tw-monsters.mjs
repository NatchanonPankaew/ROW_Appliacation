// The Glast Heim content drop (see merge-tw-maps.mjs) also left en-US/th-TH's
// monster_album without any of its 54 monsters — 30 normals, 12 elites, the
// 10 mini-bosses (Abyss Knight, Godslayer, Spider Queen, ...) and 2 MVPs
// (Dark Lord, Owl Baron). zh-TW's album has all of them with full stats and
// drop tables, so pull those entries in and localize the text fields:
//
//   - monster name: elites/minis/MVPs reuse merge-tw-maps.mjs's names so the
//     Monsters tab and the map markers agree; normals use the name from their
//     guaranteed card (merge-tw-cards.mjs) — same best-effort caveat as there.
//     Kept in English for th-TH too, matching the map markers.
//   - race/element/body: zh-TW ships placeholder labels for these ("種族 1",
//     ""), so take each id's label from the locale's own existing monsters.
//   - drop item names: looked up by item_id from the locale's own album,
//     equipment and card data (th-TH's card file for cards, since the Glast
//     Heim cards are only merged into th-TH — their names are English anyway);
//     the new Glast Heim dolls and one material are hand-named below.
//
// Numbers (stats, drop rates) come straight from zh-TW and are locale-
// independent. Reads the local zh-TW file sync-data.mjs already fetched;
// idempotent — only adds ids the locale doesn't have yet.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { MONSTER_NAME_EN } from "./merge-tw-maps.mjs";

const DATA = fileURLToPath(new URL("../public/data/sea/", import.meta.url));
const LOCALES = ["en-US", "th-TH"];

const NORMAL_NAME_EN = {
  40153: "Evil Spirit",
  40154: "Wind Elemental Wizard",
  40204: "Bat Archer",
  40205: "Dark Acolyte",
  40206: "Rideword",
  40207: "Alarm",
  40208: "Khalitz Jester",
  40209: "Maid Alice",
  40210: "Sage Worm",
  40211: "Khalitzburg",
  40212: "Raydric",
  40213: "Wandering Skeleton",
  40214: "Raydric Archer",
  40215: "Zombie Prisoner",
  40216: "Rebio",
  40217: "Injustice",
  40218: "Skeleton Prisoner",
  40219: "Aesin Witch",
  40220: "Asura Berserker",
  40221: "Stin",
  40222: "Tigersaur",
  40223: "Berserk Minos",
  40226: "Frozen Bat Archer",
  40228: "Escaped Zombie",
  40229: "Ice Elemental Wizard",
  40230: "Fire Elemental Wizard",
  40232: "Dark Priest",
  40233: "Giant Whisper",
  40234: "Enraged Evil Spirit",
};

// Glast Heim monster dolls — no locale has these yet; named after the monster
// in the existing "X Doll" / "ตุ๊กตา X" convention (see 10833001 Poring Doll).
const DOLL_MONSTER = {
  10833025: "Bat Archer",
  10833026: "Dark Acolyte",
  10833027: "Alarm",
  10833028: "Maid Alice",
  10833029: "Khalitzburg",
  10833030: "Raydric",
  10833031: "Wandering Skeleton",
  10833032: "Rebio",
  10833033: "Skeleton Prisoner",
  10833034: "Aesin Witch",
  10833035: "Elemental Wizard",
  10833036: "Tigersaur",
  10833037: "Injustice",
  10833038: "Stin",
};
const EXTRA_ITEM_NAME = {
  "en-US": { 90431103: "Pink Mud" },
  "th-TH": { 90431103: "โคลนสีชมพู" },
};
const dollName = (loc, m) => (loc === "th-TH" ? "ตุ๊กตา " + m : m + " Doll");

async function readLocal(rel) {
  try { return JSON.parse(await readFile(DATA + rel, "utf8")); }
  catch { return null; }
}

// Every {item_id, name} anywhere in a monster entry (drops, rate tables,
// activity_sources, ...) — the MVP mount drops only appear in the latter.
function collectItemNames(node, into) {
  if (Array.isArray(node)) return node.forEach((n) => collectItemNames(n, into));
  if (!node || typeof node !== "object") return;
  if (node.item_id != null && node.name) into.set(node.item_id, node.name);
  for (const v of Object.values(node)) collectItemNames(v, into);
}

export async function mergeTwMonsters() {
  const zh = await readLocal("monster-album/data/monster_album_zh-TW.json");
  const thCards = await readLocal("card-simulator/data/handbook_cards_th-TH.json");
  if (!zh) return console.log("  monsters: no zh-TW album, skipped");

  for (const loc of LOCALES) {
    const rel = `monster-album/data/monster_album_${loc}.json`;
    const album = await readLocal(rel);
    if (!album) continue;
    const have = new Set(album.monsters.map((m) => m.id));

    const race = new Map(), element = new Map(), body = new Map();
    const itemName = new Map();
    for (const m of album.monsters) {
      if (m.race?.name) race.set(m.race.id, m.race);
      if (m.element?.name) element.set(m.element.id, m.element);
      if (m.body?.name) body.set(m.body.id, m.body);
      collectItemNames(m, itemName);
    }
    const equip = await readLocal(`equipment/data/equipment_${loc}.json`);
    for (const e of equip?.items || equip?.equipments || []) if (!itemName.has(e.id)) itemName.set(e.id, e.name);
    for (const c of [...((await readLocal(`card-simulator/data/handbook_cards_${loc}.json`))?.cards || []), ...(thCards?.cards || [])])
      if (!itemName.has(c.id)) itemName.set(c.id, c.name);
    for (const [id, m] of Object.entries(DOLL_MONSTER)) if (!itemName.has(+id)) itemName.set(+id, dollName(loc, m));
    for (const [id, n] of Object.entries(EXTRA_ITEM_NAME[loc])) if (!itemName.has(+id)) itemName.set(+id, n);

    const unnamed = new Set();
    const localizeDrop = (d) => {
      const name = itemName.get(d.item_id);
      if (!name) unnamed.add(d.item_id);
      return { ...d, name: name || d.name };
    };

    let added = 0;
    for (const m of zh.monsters) {
      if (have.has(m.id)) continue;
      const name = MONSTER_NAME_EN[m.id] || NORMAL_NAME_EN[m.id];
      if (!name) continue;
      const out = {
        ...m,
        name,
        race: race.get(m.race?.id) || m.race,
        element: element.get(m.element?.id) || m.element,
        body: body.get(m.body?.id) || m.body,
      };
      for (const k of ["drops", "drop_rate_entries", "mvp_drop_rate_entries"])
        if (Array.isArray(m[k])) out[k] = m[k].map(localizeDrop);
      if (m.guaranteed_card) out.guaranteed_card = localizeDrop(m.guaranteed_card);
      album.monsters.push(out);
      added++;
    }
    album.monsters.sort((a, b) => a.id - b.id);
    if (added) await writeFile(DATA + rel, JSON.stringify(album));
    console.log("  monsters[" + loc + "]: +" + added + " Glast Heim monsters" +
      (unnamed.size ? " (untranslated item ids: " + [...unnamed].join(", ") + ")" : ""));
  }
}

if (import.meta.url === ("file://" + process.argv[1])) mergeTwMonsters();
