// Translates the Chinese equipment names that arrive from the Taiwan merge
// (guitars/whips/knuckles + event gear) into Thai, using scripts/tw-equip-th.json.
// Names are formulaic, so we decompose each one — strip the "Royal 王·" prefix,
// a trailing Roman-numeral grade, and a slot prefix (头饰·/脸饰·/…) — translate the
// remaining base, then recompose. MBTI headwear ("ENFP头饰") is handled by rule.
// Idempotent: only touches th-TH names that still contain Chinese.
import { readFile, writeFile } from "node:fs/promises";

const LIB = new URL("../public/data/sea/equipment/data/equipment_th-TH.json", import.meta.url).pathname;
const MAP = new URL("./tw-equip-th.json", import.meta.url).pathname;
const cjk = /[一-鿿]/;
const ROYAL = "Royal 王·";           // "Royal 王·"
const ROMAN = /[Ⅰ-Ⅸ]+$/;             // Ⅰ..Ⅸ
const MBTI = /^([EI][NS][TF][JP])头饰$/; // "<MBTI>头饰"

function translateName(name, T) {
  if (!cjk.test(name)) return null;
  if (T.bases[name]) return T.bases[name];       // direct full-name override
  let s = name, royal = "";
  if (s.startsWith(ROYAL)) { royal = "Royal·"; s = s.slice(ROYAL.length); }
  let roman = ""; const m = s.match(ROMAN);
  if (m) { roman = m[0]; s = s.slice(0, s.length - roman.length); }
  let slotTh = "";
  for (const [cn, th] of Object.entries(T.slots)) if (s.startsWith(cn)) { slotTh = th; s = s.slice(cn.length); break; }
  let baseTh;
  const mb = s.match(MBTI);
  if (mb) baseTh = "เครื่องประดับหัว " + mb[1]; // "เครื่องประดับหัว <MBTI>"
  else baseTh = T.bases[s];
  if (baseTh == null) return null;             // unknown base — leave untranslated
  return royal + slotTh + baseTh + roman;
}

const skel = (s) => { let i = 0; return s.replace(/[0-9]+(\.[0-9]+)?/g, () => "{" + (i++) + "}"); };
const nums = (s) => s.match(/[0-9]+(\.[0-9]+)?/g) || [];

export async function applyTwEquipTh() {
  const T = JSON.parse(await readFile(MAP, "utf8"));
  const lib = JSON.parse(await readFile(LIB, "utf8"));

  let n = 0; const unknown = new Set();
  for (const it of (lib.items || [])) {
    if (!it.name || !cjk.test(it.name)) continue;
    const th = translateName(it.name, T);
    if (th) { it.name = th; n++; } else unknown.add(it.name);
  }
  // subtype label fixes (e.g. 7017 whip)
  for (const [code, th] of Object.entries(T.subtypes || {}))
    if (lib.itemSubtypes && lib.itemSubtypes[code]) lib.itemSubtypes[code].name = th;

  // conditional bonus lines: match by number-skeleton, fill the entry's numbers.
  let nc = 0; const unkCond = new Set();
  for (const c of Object.values(lib.conditions || {})) {
    const t = c.text || c.name; if (!t || !cjk.test(t)) continue;
    const tmpl = (T.conditions || {})[skel(t)];
    if (tmpl) { const nn = nums(t); const out = tmpl.replace(/\{(\d+)\}/g, (_, i) => nn[i]); c.text = out; c.name = out; nc++; }
    else unkCond.add(skel(t));
  }
  // suit names
  let ns = 0;
  for (const s of (lib.suits || [])) {
    if (s.name && (T.suits || {})[s.name]) { s.name = T.suits[s.name]; ns++; }
  }

  await writeFile(LIB, JSON.stringify(lib));
  console.log("  equip th: translated " + n + " item names, " + nc + " conditions, " + ns + " suits");
  if (unknown.size) console.log("  equip th: UNTRANSLATED names (" + unknown.size + "):", [...unknown].slice(0, 8));
  if (unkCond.size) console.log("  equip th: UNTRANSLATED conditions (" + unkCond.size + "):", [...unkCond].slice(0, 4));
}

if (import.meta.url === ("file://" + process.argv[1])) applyTwEquipTh();
