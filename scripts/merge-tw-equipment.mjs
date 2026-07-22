// The SEA equipment dataset is missing whole weapon types — instrument/guitar
// (subtype 7016), whip (7017), and the extra knuckle (7010) — plus assorted
// new-class / event gear. The Taiwan dataset (site ROOT, no /sea) is a superset
// (3291 vs 2666 items). Pull the TW-only items in *surgically*: keep every SEA
// item and library entry untouched (SEA is the live server / already localized),
// and only ADD items + library entries that SEA lacks. New items arrive with
// Taiwan text — apply-tw-equip-th.mjs then localizes their Chinese names to Thai.
// Run after sync-data fetches the SEA equipment file. Idempotent.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://roworlddb.com";
const DATA = fileURLToPath(new URL("../public/data/sea/equipment/data/", import.meta.url));
const LOCALES = ["en-US", "th-TH", "zh-TW"];
// object-keyed libraries the items reference by id
const OBJ_LIBS = ["attributes", "conditions", "stunts", "buffs", "affixes",
  "itemTypes", "itemSubtypes", "assemblyTypes", "jobs", "jobFilters", "refineLibraries"];
// whip (7017) is labelled "Rope" in TW's th-TH/en-US — fix per locale.
const WHIP_LABEL = { "th-TH": "แส้", "en-US": "Whip" };

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + " HTTP " + r.status);
  return r.json();
}

export async function mergeTwEquipment() {
  for (const loc of LOCALES) {
    let sea;
    try { sea = JSON.parse(await readFile(DATA + "equipment_" + loc + ".json", "utf8")); }
    catch { continue; }
    const tw = await fetchJSON(ORIGIN + "/equipment/data/equipment_" + loc + ".json");

    for (const lib of OBJ_LIBS) {
      if (!tw[lib]) continue;
      sea[lib] = sea[lib] || {};
      for (const k of Object.keys(tw[lib])) if (!(k in sea[lib])) sea[lib][k] = tw[lib][k];
    }
    // suits is an array keyed by .id
    if (Array.isArray(tw.suits)) {
      sea.suits = Array.isArray(sea.suits) ? sea.suits : [];
      const have = new Set(sea.suits.map((s) => s.id));
      for (const s of tw.suits) if (!have.has(s.id)) sea.suits.push(s);
    }
    // append TW-only items
    const have = new Set(sea.items.map((i) => i.id));
    let added = 0;
    for (const it of (tw.items || [])) if (!have.has(it.id)) { sea.items.push(it); added++; }

    // fix the whip subtype label (added from TW as "Rope")
    const label = WHIP_LABEL[loc];
    if (label && sea.itemSubtypes && sea.itemSubtypes["7017"]) sea.itemSubtypes["7017"].name = label;

    await writeFile(DATA + "equipment_" + loc + ".json", JSON.stringify(sea));
    console.log("  equipment[" + loc + "]: +" + added + " TW items (" + sea.items.length + " total)");
  }
}

if (import.meta.url === ("file://" + process.argv[1])) mergeTwEquipment();
