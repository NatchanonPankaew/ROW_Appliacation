// Replaces the leftover Chinese in the Thai affix library with Thai, using the
// map in tw-affix-th.json. Names are looked up directly; descriptions match by
// skeleton (#E69A15 -> #, numbers -> {i}) and are filled with each entry's own
// numbers in order. Idempotent: only touches entries that still contain Chinese.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const LIB = fileURLToPath(new URL("../public/data/sea/affix-simulator/data/stunt_skill_library_th-TH.json", import.meta.url));
const MAP = fileURLToPath(new URL("./tw-affix-th.json", import.meta.url));
const cjk = /[一-鿿]/;
const skel = (s) => { let i = 0; return s.replace(/#E69A15/g, "#").replace(/[0-9]+(\.[0-9]+)?/g, () => "{" + (i++) + "}"); };
const nums = (s) => s.replace(/#E69A15/g, "#").match(/[0-9]+(\.[0-9]+)?/g) || [];

export async function applyTwAffixTh() {
  const { names, templates } = JSON.parse(await readFile(MAP, "utf8"));
  const lib = JSON.parse(await readFile(LIB, "utf8"));

  let nName = 0, nDesc = 0, unNamed = new Set(), unDesc = new Set();
  for (const p of Object.values(lib.packages || {}))
    for (const e of (p.entries || [])) {
      const s = e.stunt || e;
      if (s.name && cjk.test(s.name)) {
        if (names[s.name]) { s.name = names[s.name]; nName++; } else unNamed.add(s.name);
      }
      if (s.desc && cjk.test(s.desc)) {
        const t = templates[skel(s.desc)];
        if (t) { const n = nums(s.desc); s.desc = t.replace(/\{(\d+)\}/g, (_, i) => n[i]); nDesc++; }
        else unDesc.add(skel(s.desc));
      }
    }

  await writeFile(LIB, JSON.stringify(lib));
  console.log(`  affix th: translated ${nName} names, ${nDesc} descriptions`);
  if (unNamed.size) console.log("  affix th: UNMAPPED names:", [...unNamed]);
  if (unDesc.size) console.log("  affix th: UNMAPPED desc skeletons:", unDesc.size, [...unDesc].slice(0, 3));
}

if (import.meta.url === ("file://" + process.argv[1])) applyTwAffixTh();
