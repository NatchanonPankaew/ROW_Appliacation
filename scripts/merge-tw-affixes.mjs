// The SEA affix dataset is missing whole weapon types (instrument 7016, whip
// 7017, knuckle 7010) and the new classes (Bard/Dancer/Alchemist + T2, Paladin…).
// The Taiwan dataset (site ROOT, no /sea) is a superset (1215 vs 885 families,
// same stunt ids). Merge it in: take Taiwan's index + library, but keep SEA's
// already-localized name/desc for every shared stunt id so we don't lose the
// Thai/EN text. New (Taiwan-only) affixes come in with Taiwan text.
// Run after sync-data fetches the SEA affix files. Idempotent.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://roworlddb.com";
const DATA = fileURLToPath(new URL("../public/data/sea/affix-simulator/data/", import.meta.url));
const LOCALES = ["en-US", "th-TH", "zh-TW"];

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + " HTTP " + r.status);
  return r.json();
}
function idMap(lib) {
  const m = {};
  for (const p of Object.values((lib && lib.packages) || {}))
    for (const e of (p.entries || [])) { const s = e.stunt || e; m[s.id] = s; }
  return m;
}

export async function mergeTwAffixes() {
  for (const loc of LOCALES) {
    let seaLib = { packages: {} };
    try { seaLib = JSON.parse(await readFile(DATA + "stunt_skill_library_" + loc + ".json", "utf8")); } catch {}
    const seaMap = idMap(seaLib); // id -> already-localized stunt (name/desc)

    const twIdx = await fetchJSON(ORIGIN + "/affix-simulator/data/stunt_package_index_" + loc + ".json");
    const twLib = await fetchJSON(ORIGIN + "/affix-simulator/data/stunt_skill_library_" + loc + ".json");

    let kept = 0;
    for (const p of Object.values(twLib.packages || {}))
      for (const e of (p.entries || [])) {
        const s = e.stunt || e;
        const sea = seaMap[s.id];
        if (sea && (sea.name || sea.desc)) { s.name = sea.name; s.desc = sea.desc; kept++; }
      }

    await writeFile(DATA + "stunt_package_index_" + loc + ".json", JSON.stringify(twIdx));
    await writeFile(DATA + "stunt_skill_library_" + loc + ".json", JSON.stringify(twLib));
    console.log("  affixes[" + loc + "]: Taiwan superset + " + kept + " SEA-localized entries kept");
  }
}

if (import.meta.url === ("file://" + process.argv[1])) mergeTwAffixes();
