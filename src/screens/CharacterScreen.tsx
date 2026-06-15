import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View, Text, TextInput, FlatList, ActivityIndicator,
  TouchableOpacity, StyleSheet, Image, Modal, ScrollView,
} from "react-native";
import {
  fetchData, fetchIconPaths, resolveIconUrl, qualityInfo, QUALITY,
  NormItem, IconPaths,
  fetchSkillIndex, fetchJobSkills, skillPathTo, jobPathHasSkills, skillUnlockLimit,
  JobNode, SkillNode, SKILL_TIER_POOLS,
} from "../api/roworlddb";

const LOCALES = ["en-US", "th-TH", "zh-TW"];
const MAX_LEVEL = 120;       // server cap ปัจจุบัน — ขยายภายหลังเมื่อเซิร์ฟปลดเลเวลเพิ่ม
const STAT_CAP = 120;         // เพดานต่อ 1 สเตตัส (มาตรฐานสาย Origin/World)
const MAX_REFINE = 20;
const MAX_CARDS = 2;          // each equipment slot holds at most 2 cards
const BASE_STATS = ["STR", "AGI", "VIT", "INT", "DEX", "LUK"];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
const qRoman = (q?: number) => (q && ROMAN[q] ? ROMAN[q] : "");

/* ---- fixed equipment slots (always shown, like the game) ---- */
type SlotDef = { key: string; labels: Record<string, string>; aliases: string[] };
const SLOTS: SlotDef[] = [
  { key: "head",      labels: { "th-TH": "ศีรษะ", "en-US": "Head", "zh-TW": "頭飾" },        aliases: ["頭飾", "ศีรษะ", "head", "headgear"] },
  { key: "face",      labels: { "th-TH": "ใบหน้า", "en-US": "Face", "zh-TW": "臉飾" },       aliases: ["臉飾", "ใบหน้า", "face"] },
  { key: "mouth",     labels: { "th-TH": "ปาก", "en-US": "Mouth", "zh-TW": "嘴飾" },         aliases: ["嘴飾", "ปาก", "mouth"] },
  { key: "weapon",    labels: { "th-TH": "อาวุธ", "en-US": "Weapon", "zh-TW": "武器" },      aliases: ["武器", "อาวุธ", "weapon"] },
  { key: "offhand",   labels: { "th-TH": "มือรอง", "en-US": "Off-hand", "zh-TW": "副手" },   aliases: ["副手", "มือรอง", "off-hand", "offhand", "shield"] },
  { key: "armor",     labels: { "th-TH": "เกราะ", "en-US": "Armor", "zh-TW": "鎧甲" },       aliases: ["鎧甲", "เกราะ", "armor", "armour"] },
  { key: "garment",   labels: { "th-TH": "ผ้าคลุม", "en-US": "Garment", "zh-TW": "披風" },   aliases: ["披風", "ผ้าคลุม", "garment", "cape"] },
  { key: "back",      labels: { "th-TH": "หลัง", "en-US": "Back", "zh-TW": "背飾" },         aliases: ["背飾", "หลัง", "back"] },
  { key: "shoes",     labels: { "th-TH": "รองเท้า", "en-US": "Shoes", "zh-TW": "鞋子" },     aliases: ["鞋子", "รองเท้า", "shoes", "footgear", "boots"] },
  // RO has two accessory slots — both draw from the same accessory item pool.
  { key: "accessory1", labels: { "th-TH": "เครื่องประดับ 1", "en-US": "Accessory 1", "zh-TW": "飾品1" }, aliases: ["飾品", "เครื่องประดับ", "accessory"] },
  { key: "accessory2", labels: { "th-TH": "เครื่องประดับ 2", "en-US": "Accessory 2", "zh-TW": "飾品2" }, aliases: [] },
];
// slot keys that share the accessory item/card pool
const ACCESSORY_KEYS = ["accessory1", "accessory2"];
const poolKeyOf = (k: string) => (ACCESSORY_KEYS.includes(k) ? "accessory" : k);
const ALIAS_TO_KEY: Record<string, string> = {};
SLOTS.forEach((s) => s.aliases.forEach((a) => (ALIAS_TO_KEY[a.toLowerCase()] = s.key)));
const slotLabel = (def: SlotDef, locale: string) => def.labels[locale] || def.labels["en-US"];
function itemSlotKey(it: NormItem): string {
  if (it.slotKey) return it.slotKey;
  const s = (it.slot || (it.tags && it.tags.slot) || "").toLowerCase();
  return ALIAS_TO_KEY[s] || "other";
}

/* ---- build model ---- */
type Slot = { item?: NormItem; refine: number; cards: NormItem[] };
type Build = {
  level: number;
  job: NormItem | null;
  stats: Record<string, number>;       // allocated STR/AGI/... (min 1)
  slots: Record<string, Slot>;          // keyed by slot KEY
};
const freshStats = () => ({ STR: 1, AGI: 1, VIT: 1, INT: 1, DEX: 1, LUK: 1 } as Record<string, number>);
const emptyBuild = (): Build => ({ level: MAX_LEVEL, job: null, stats: freshStats(), slots: {} });

/* ---- stat-point system (verified vs in-game: Lv64 = 615) ---- */
function pointsForLevel(level: number): number {
  let p = 48;
  for (let l = 2; l <= level; l++) p += Math.floor((l - 1) / 5) + 3;
  return p;
}
const costToRaise = (v: number) => Math.floor((v - 1) / 10) + 2;
function spentPoints(stats: Record<string, number>): number {
  let sum = 0;
  for (const k of Object.keys(stats)) for (let v = 1; v < stats[k]; v++) sum += costToRaise(v);
  return sum;
}

function itemStats(it?: NormItem): Record<string, number> {
  if (!it) return {};
  if (it.stats && Object.keys(it.stats).length) return it.stats;
  const out: Record<string, number> = {};
  for (const d of it.details || []) {
    const n = Number(String(d.value).replace(/[^\d.\-]/g, ""));
    if (!Number.isNaN(n) && n !== 0) out[d.label] = n;
  }
  return out;
}

// Total = allocated base + every equipped item (+ refine bonus) + its cards.
function computeStats(b: Build): Record<string, number> {
  const total: Record<string, number> = { ...b.stats };
  const add = (s?: Record<string, number>, mul = 1) => {
    if (!s) return;
    for (const k of Object.keys(s)) total[k] = (total[k] || 0) + s[k] * mul;
  };
  Object.values(b.slots).forEach((sl) => {
    if (sl.item) {
      add(sl.item.stats);                       // base item stats
      add(sl.item.refineStats, sl.refine);      // +N refine bonus
    }
    sl.cards.forEach((c) => add(c.stats));
  });
  for (const k of Object.keys(total)) {
    total[k] = Math.round(total[k] * 100) / 100;
    if (total[k] === 0) delete total[k];
  }
  return total;
}

/* ============================================================================
 *  DERIVED COMBAT STATS — uses the EXACT in-game per-stat conversions:
 *   1 STR = P.ATK(melee)+1, HP+15            1 DEX = P.ATK(ranged)+1, Hit+1
 *   1 VIT = MaxHP+40, MaxHP%+0.1, P.DEF+0.5, M.DEF+0.3
 *   1 INT = MaxSP+10, MaxSP%+0.2, MATK+1, M.DEF+0.5
 *   1 AGI = Flee+1, P.DEF+0.5                 1 LUK = CRIT+0.3, ATK+0.2
 *  Only the flat base HP/SP per job+level is still approximate (linear) since
 *  that table isn't public — edit JOB_CURVE / JOB_OVERRIDES from in-game.
 * ========================================================================== */
type Combat = {
  maxHP: number; maxSP: number; patkM: number; patkR: number; matk: number;
  pdef: number; mdef: number; hit: number; flee: number; crit: number;
};

// Flat base HP/SP at 0 VIT/INT = base + perLevel*(level-1). (approx placeholder)
const JOB_CURVE = { hpBase: 100, hpPerLevel: 70, spBase: 30, spPerLevel: 8 };
const JOB_OVERRIDES: { match: string[]; hpBase?: number; hpPerLevel?: number; spBase?: number; spPerLevel?: number }[] = [
  // e.g. { match: ["royal guard","รอยัล"], hpBase: 0, hpPerLevel: 0 },
];

// exact per-stat conversions from the in-game tooltips
const COEF = {
  strAtk: 1, strHp: 15,            // STR
  dexAtkRanged: 1, dexHit: 1,      // DEX
  vitHp: 40, vitHpPct: 0.1, vitPdef: 0.5, vitMdef: 0.3,   // VIT
  intSp: 10, intSpPct: 0.2, intMatk: 1, intMdef: 0.5,     // INT
  agiFlee: 1, agiPdef: 0.5,        // AGI
  lukCrit: 0.3, lukAtk: 0.2,       // LUK
};

function jobCurve(jobName: string) {
  const n = (jobName || "").toLowerCase();
  const o = JOB_OVERRIDES.find((x) => x.match.some((m) => n.includes(m.toLowerCase())));
  return {
    hpBase: o?.hpBase ?? JOB_CURVE.hpBase,
    hpPerLevel: o?.hpPerLevel ?? JOB_CURVE.hpPerLevel,
    spBase: o?.spBase ?? JOB_CURVE.spBase,
    spPerLevel: o?.spPerLevel ?? JOB_CURVE.spPerLevel,
  };
}

// flat combat bonuses coming from gear/cards (localized attr names). Best-effort
// keyword match; base STR/AGI/.. names are excluded so they never leak in here.
const COMBAT_ALIASES: { key: keyof Combat; kw: string[] }[] = [
  { key: "maxHP", kw: ["max hp", "maxhp", "hp สูงสุด", "พลังชีวิตสูงสุด", "生命上限", "體力上限"] },
  { key: "maxSP", kw: ["max sp", "maxsp", "max mp", "sp สูงสุด", "mp สูงสุด", "พลังเวทสูงสุด", "魔法上限"] },
  { key: "patkM", kw: ["p.atk", "patk", "พลังโจมตี", "攻擊", "攻击", "atk"] },
  { key: "matk",  kw: ["m.atk", "matk", "magic atk", "พลังเวท", "魔法攻擊", "魔法攻击"] },
  { key: "pdef",  kw: ["p.def", "pdef", "ป้องกัน", "防禦", "防御"] },
  { key: "mdef",  kw: ["m.def", "mdef", "ป้องกันเวท", "魔法防禦", "魔法防御"] },
  { key: "flee",  kw: ["flee", "หลบ", "回避"] },
  { key: "hit",   kw: ["hit", "แม่นยำ", "命中"] },
  { key: "crit",  kw: ["crit", "คริ", "暴擊", "暴击"] },
];
function flatCombatFromGear(totals: Record<string, number>): Partial<Combat> {
  const out: Partial<Combat> = {};
  for (const k of Object.keys(totals)) {
    if (BASE_STATS.includes(k.toUpperCase())) continue; // never treat base stats as combat
    if (k.includes("%")) continue;                      // percents handled separately in computeCombat
    const n = k.toLowerCase();
    for (const a of COMBAT_ALIASES) {
      if (a.kw.some((w) => n.includes(w))) { out[a.key] = (out[a.key] || 0) + totals[k]; break; }
    }
  }
  return out;
}

function computeCombat(b: Build, totals: Record<string, number>): Combat {
  const S = (k: string) => totals[k] || b.stats[k] || 1;
  const str = S("STR"), agi = S("AGI"), vit = S("VIT"), intl = S("INT"), dex = S("DEX"), luk = S("LUK");
  const lvl = b.level;
  const c = jobCurve(b.job?.title || "");
  const g = flatCombatFromGear(totals);
  const r1 = (x: number) => Math.round(x * 10) / 10;

  // percentage bonuses from gear/cards (e.g. "HP สูงสุด% +4%", "ATK% +8%")
  const pct = (k: string) => totals[k] || 0;

  const hpFlat = c.hpBase + c.hpPerLevel * (lvl - 1) + str * COEF.strHp + vit * COEF.vitHp + (g.maxHP || 0);
  const maxHP = Math.floor(hpFlat * (1 + (vit * COEF.vitHpPct + pct("HP%")) / 100));
  const spFlat = c.spBase + c.spPerLevel * (lvl - 1) + intl * COEF.intSp + (g.maxSP || 0);
  const maxSP = Math.floor(spFlat * (1 + (intl * COEF.intSpPct + pct("SP%")) / 100));

  const lukAtk = luk * COEF.lukAtk;
  const atkMul = 1 + pct("ATK%") / 100;
  const matkMul = 1 + pct("MATK%") / 100;
  const patkM = Math.round((str * COEF.strAtk + lukAtk + (g.patkM || 0)) * atkMul);        // melee
  const patkR = Math.round((dex * COEF.dexAtkRanged + lukAtk + (g.patkM || 0)) * atkMul);  // ranged
  const matk = Math.round((intl * COEF.intMatk + (g.matk || 0)) * matkMul);
  const pdef = r1(vit * COEF.vitPdef + agi * COEF.agiPdef + (g.pdef || 0));
  const mdef = r1(vit * COEF.vitMdef + intl * COEF.intMdef + (g.mdef || 0));
  const hit = Math.round(lvl + dex * COEF.dexHit + (g.hit || 0));
  const flee = Math.round(lvl + agi * COEF.agiFlee + (g.flee || 0));
  const crit = r1(luk * COEF.lukCrit + (g.crit || 0));
  return { maxHP, maxSP, patkM, patkR, matk, pdef, mdef, hit, flee, crit };
}

const COMBAT_ROWS: [keyof Combat, string][] = [
  ["maxHP", "Max HP"], ["maxSP", "Max SP"],
  ["patkM", "P.ATK ประชิด"], ["patkR", "P.ATK ระยะไกล"],
  ["matk", "MATK"], ["pdef", "P.DEF"], ["mdef", "M.DEF"],
  ["hit", "Hit"], ["flee", "Flee"], ["crit", "CRIT"],
];

/* ============================================================================
 *  "THE BEST SET" — role-based build templates per class
 *  ---------------------------------------------------------------------------
 *  These are ROLE/archetype templates (general Ragnarok meta), matched by job
 *  name. They are starting points, not patch-exact BiS for RO World SEA — the
 *  stat ORDER, skill focus and gear/card priorities are broadly correct, but
 *  exact numbers/items should be tuned per current server meta.
 * ========================================================================== */
type Preset = {
  role: string;
  match: string[];            // job-name keywords (lowercase)
  statOrder: string[];        // priority order to pour points into
  targets?: Record<string, number>; // optional caps per stat
  skills: string[];
  gear: string[];
  cards: string[];
};

const PRESETS: Preset[] = [
  {
    role: "แทงค์ / Tank",
    match: ["royal", "รอยัล", "guard", "paladin", "พาลาดิน", "crusader", "ครูเสด", "lord knight", "ลอร์ด"],
    statOrder: ["VIT", "STR", "DEX", "AGI"],
    targets: { VIT: 120, STR: 100, DEX: 60 },
    skills: [
      "Job 1: อัดสกิลพื้นฐาน + บั๊ฟ HP/ป้องกันก่อน",
      "Job 2: แม็กซ์สกิลดึงอั๊ก (taunt) + สกิลลดดาเมจ/บล็อก",
      "Job 3: แม็กซ์สกิลโจมตีหลัก 1 ตัว",
      "ที่เหลือ: ลงพาสซีฟเพิ่ม HP / ต้านสถานะ",
    ],
    gear: ["เน้น VIT / Max HP / DEF", "ลดดาเมจรับ (% damage reduction)", "เกราะธาตุ/ต้านสถานะ"],
    cards: ["การ์ดเพิ่ม HP% / VIT", "การ์ดลดดาเมจจากเผ่า/ขนาด", "การ์ดต้านสถานะ (สตัน/แช่แข็ง)"],
  },
  {
    role: "DPS กายภาพ / Physical",
    match: ["knight", "ไนท์", "rune", "รูน", "assassin", "ครอส", "cross", "guillotine", "กิโยติน", "champion", "sura", "ซูระ", "monk", "มังค์", "shadow chaser", "rogue"],
    statOrder: ["STR", "DEX", "AGI", "LUK", "VIT"],
    targets: { STR: 120, DEX: 90, AGI: 90 },
    skills: [
      "Job 1: แม็กซ์มาสเตอรี่อาวุธ + เพิ่มพลังโจมตี",
      "Job 2: แม็กซ์สกิลโจมตีหลัก + สกิลเพิ่ม ASPD/Crit",
      "Job 3: แม็กซ์สกิลคอมโบ/สกิลตัวแรง",
      "ที่เหลือ: ลงพาสซีฟ ATK / สกิลเข้าหา-หนีศัตรู",
    ],
    gear: ["เน้น ATK / STR", "Crit หรือเจาะ DEF ตามสายตี", "เพิ่ม ASPD / ดาเมจต่อเผ่า"],
    cards: ["การ์ดเพิ่ม ATK/STR", "การ์ดดาเมจต่อเผ่า/ขนาดของบอส", "การ์ดเจาะ DEF / Crit"],
  },
  {
    role: "ระยะไกล / Ranged",
    match: ["hunter", "ฮันเตอร์", "sniper", "สไนเปอร์", "ranger", "เรนเจอร์", "archer", "อาเชอร์", "minstrel", "wanderer", "gunslinger", "ปืน", "rebellion"],
    statOrder: ["AGI", "DEX", "LUK", "INT", "VIT"],
    targets: { AGI: 120, DEX: 110, LUK: 60 },
    skills: [
      "Job 1: แม็กซ์เพิ่มแม่นยำ + ATK ของธนู/ปืน",
      "Job 2: แม็กซ์สกิลยิงหลัก + กับดัก/ลูกธนูธาตุ",
      "Job 3: แม็กซ์สกิลตัวแรงระยะไกล",
      "ที่เหลือ: ลง ASPD / พาสซีฟดาเมจ",
    ],
    gear: ["เน้น ATK ระยะไกล / DEX", "Crit / ASPD", "ลูกศร/กระสุนธาตุให้ครบ"],
    cards: ["การ์ดเพิ่มดาเมจระยะไกล", "การ์ด DEX / ATK", "การ์ดดาเมจต่อเผ่า/ขนาด"],
  },
  {
    role: "สายเวท / Caster",
    match: ["mage", "เมจ", "wizard", "วิซ", "warlock", "วอร์ล็อก", "sage", "เซจ", "professor", "sorcerer", "ซอเซอเรอร์"],
    statOrder: ["INT", "DEX", "VIT", "LUK", "AGI"],
    targets: { INT: 120, DEX: 90, VIT: 60 },
    skills: [
      "Job 1: แม็กซ์โบลต์/สายธาตุที่จะใช้บ่อย",
      "Job 2: แม็กซ์สกิลเวทหลัก + สกิลลดเวลาร่าย",
      "Job 3: แม็กซ์สกิลตัวแรง (AoE/บอส)",
      "ที่เหลือ: ลงฟื้น SP / สกิลเอาตัวรอด",
    ],
    gear: ["เน้น MATK / INT", "ลดเวลาร่าย (variable cast)", "เพิ่ม SP / ดาเมจตามธาตุ"],
    cards: ["การ์ดเพิ่ม MATK/INT", "การ์ดดาเมจตามธาตุ", "การ์ดลดเวลาร่าย / เพิ่ม SP"],
  },
  {
    role: "ซัพพอร์ต / Support",
    match: ["priest", "พรีสต์", "bishop", "บิชอป", "acolyte", "อโคไลท์", "arch", "high priest"],
    statOrder: ["INT", "DEX", "VIT", "LUK", "AGI"],
    targets: { INT: 120, DEX: 90, VIT: 80 },
    skills: [
      "Job 1: แม็กซ์ฮีล + เพิ่ม SP/ฟื้น SP",
      "Job 2: แม็กซ์บั๊ฟปาร์ตี้ + สกิลป้องกัน",
      "Job 3: แม็กซ์สกิลซัพหลัก (รีเซอร์เร็ค/บั๊ฟใหญ่)",
      "ที่เหลือ: ลงสายโจมตีเบาๆ / เอาตัวรอด",
    ],
    gear: ["เน้น INT / พลังฮีล", "ลดเวลาร่าย / เพิ่ม SP", "VIT/Max HP กันตาย"],
    cards: ["การ์ดเพิ่ม INT / SP", "การ์ดลดเวลาร่าย", "การ์ด VIT / ต้านสถานะ"],
  },
];
const GENERIC_PRESET: Preset = {
  role: "ทั่วไป / Balanced",
  match: [],
  statOrder: ["STR", "DEX", "VIT", "AGI", "INT", "LUK"],
  skills: ["อัดสกิลโจมตีหลักให้เต็มก่อน", "ตามด้วยสกิลเสริม/บั๊ฟ", "ที่เหลือลงสกิลเอาตัวรอด"],
  gear: ["เลือกของที่เพิ่มสเตตัสหลักของสายตัวเอง", "ตีบวกชิ้นที่ให้โบนัสต่อ refine สูง", "เติมธาตุ/ต้านสถานะตามจุดที่ไปบ่อย"],
  cards: ["การ์ดเพิ่มสเตตัสหลัก", "การ์ดดาเมจ/ลดดาเมจตามบทบาท", "การ์ดต้านสถานะ"],
};

function pickPreset(jobName: string): Preset {
  const n = (jobName || "").toLowerCase();
  return PRESETS.find((p) => p.match.some((m) => n.includes(m))) || GENERIC_PRESET;
}

// Spend points focused on the build's CORE stats (the ones with explicit
// targets, e.g. AGI/DEX/LUK for ADL), and do NOT leak points into stats the
// build doesn't want (VIT/INT for ADL).
function planAllocate(level: number, preset: Preset): Record<string, number> {
  const stats = freshStats();
  let pts = pointsForLevel(level);
  const targeted = Object.keys(preset.targets || {});
  const core = targeted.length ? targeted : preset.statOrder.slice(0, 3);
  const order = preset.statOrder.filter((k) => core.includes(k)); // priority order
  const target = (k: string) => preset.targets?.[k] ?? 120;
  // PROPORTIONAL fill: each point goes to the core stat that is, relative to its
  // target, the most behind. This keeps the spread proportional to the targets
  // at EVERY level — at low level you get the same ratios, just smaller numbers
  // (e.g. AGI:DEX:LUK 120:110:60 stays ~120:110:60 at Lv60). Ties break by the
  // priority order, so the higher-priority stat edges ahead.
  let guard = 0;
  while (pts > 0 && guard++ < 100000) {
    let best: string | null = null, bestDeficit = -1;
    for (const k of order) {
      if (stats[k] >= target(k)) continue;
      if (pts < costToRaise(stats[k])) continue;
      const deficit = (target(k) - stats[k]) / target(k);
      if (deficit > bestDeficit) { bestDeficit = deficit; best = k; }
    }
    if (!best) break;
    pts -= costToRaise(stats[best]);
    stats[best] += 1;
  }
  // leftover (high level / low caps): top up in priority order up to the stat
  // cap, still without leaking into off-build stats.
  let advanced = true;
  while (advanced && pts > 0) {
    advanced = false;
    for (const k of order) {
      if (stats[k] >= STAT_CAP) continue;
      const c = costToRaise(stats[k]);
      if (pts < c) continue;
      stats[k] += 1; pts -= c; advanced = true;
    }
  }
  return stats;
}

/* ---- sub-builds per class line (e.g. Sniper: ADL / Falcon / Trap) ----
 * Each variant tweaks the stat order AND boosts skills whose name matches
 * skillBoost keywords (Thai + English, best-effort). Editable. */
type Variant = {
  name: string; statOrder: string[]; targets?: Record<string, number>; skillBoost: string[];
  // per-build guidance (shown instead of the role-level preset when a สาย is picked)
  skills?: string[]; gear?: string[]; cards?: string[];
};
const VARIANT_SETS: { match: string[]; variants: Variant[] }[] = [
  {
    // Archer / Hunter / Sniper / Ranger line
    match: ["archer", "อาเชอร์", "hunter", "ฮันเตอร์", "sniper", "สไนเปอร์", "ranger", "เรนเจอร์"],
    variants: [
      { name: "ADL (ออโต้)", statOrder: ["AGI", "DEX", "LUK", "VIT", "INT"], targets: { AGI: 120, DEX: 110, LUK: 60 },
        skillBoost: ["strafe", "double", "arrow", "true sight", "concentration", "owl", "vulture", "sharp", "สเตรฟ", "ลูกศร", "แม่นยำ"],
        skills: ["แม็กซ์ Double Strafe + ยิงรัว", "True Sight / Owl's Eye / Vulture Eye เพิ่มแม่น+ATK", "ที่เหลือลง ASPD / หลบ"],
        gear: ["ธนู ATK ระยะไกลสูง", "เพิ่ม AGI/ASPD + DEX", "ลูกศรธาตุครบมือ"],
        cards: ["การ์ดเพิ่มดาเมจระยะไกล", "การ์ด AGI/ATK", "การ์ดดาเมจต่อเผ่า/ขนาด"] },
      { name: "สายนก (Falcon)", statOrder: ["DEX", "LUK", "AGI", "INT", "VIT"], targets: { DEX: 110, LUK: 120, AGI: 80, INT: 60 },
        skillBoost: ["falcon", "blitz", "เหยี่ยว", "นก", "beat", "assault", "crow", "steel crow"],
        skills: ["แม็กซ์ Blitz Beat + Falcon Mastery", "Steel Crow เพิ่มดาเมจเหยี่ยว", "Owl's Eye/Vulture Eye เสริม DEX"],
        gear: ["เพิ่ม DEX/LUK/INT (ดาเมจเหยี่ยว)", "ของเสริมดาเมจสัตว์/อสูร", "ASPD"],
        cards: ["การ์ด DEX/LUK", "ดาเมจต่อเผ่า", "เพิ่มดาเมจ Blitz/สัตว์"] },
      { name: "สายกับดัก (Trap)", statOrder: ["DEX", "INT", "VIT", "AGI", "LUK"], targets: { DEX: 110, INT: 90, VIT: 80 },
        skillBoost: ["trap", "กับดัก", "claymore", "blast", "land mine", "sandman", "ankle", "freezing", "flasher", "ทราป"],
        skills: ["แม็กซ์ Claymore Trap / Blast Mine", "Ankle Snare / Sandman คุมศัตรู", "Spring Trap / Remove Trap เสริม"],
        gear: ["เพิ่ม INT/DEX (ดาเมจกับดัก)", "ลดเวลาวางกับดัก", "VIT กันตาย"],
        cards: ["การ์ด INT/DEX", "ดาเมจกับดัก/ตามธาตุ", "VIT/ต้านสถานะ"] },
    ],
  },
  {
    // Swordman / Knight / Lord Knight / Rune Knight
    match: ["knight", "ไนท์", "rune", "รูน", "lord knight", "ลอร์ด"],
    variants: [
      { name: "สายหอก (Pierce/Spiral)", statOrder: ["STR", "DEX", "VIT", "AGI"], targets: { STR: 120, DEX: 90, VIT: 90 },
        skillBoost: ["spear", "pierce", "spiral", "หอก", "แทง", "brandish"],
        skills: ["แม็กซ์ Pierce / Spiral Pierce", "ความชำนาญ Spear + ขี่ม้า (Cavalier)", "Provoke / Charge Attack เสริม"],
        gear: ["หอก ATK สูง / เจาะ DEF", "เพิ่ม STR/DEX", "ดาเมจต่อขนาดใหญ่ (หอกแรงกับ Large)"],
        cards: ["การ์ด STR/ATK", "ดาเมจต่อขนาดใหญ่", "เจาะ DEF"] },
      { name: "สายดาบ 2 มือ", statOrder: ["STR", "AGI", "LUK", "VIT"], targets: { STR: 120, AGI: 90, LUK: 60 },
        skillBoost: ["bowling", "bash", "two-hand", "sword", "ดาบ", "ฟัน", "magnum"],
        skills: ["แม็กซ์ Bowling Bash", "ความชำนาญดาบ + เพิ่มความเร็วโจมตีดาบ", "Bash/Magnum + Auto Counter (คริ)"],
        gear: ["ดาบ 2 มือ ATK สูง", "เพิ่ม STR/AGI + คริ", "ASPD"],
        cards: ["การ์ด STR/ATK", "คริ/ASPD", "ดาเมจต่อเผ่า"] },
      // ไนท์เผา = Rune Knight Dragon Breath: ดาเมจสเกลตาม HP+SP → ไต้หวันดัน VIT+INT
      // แม็กซ์คู่กัน, DEX ดัน命中 (รวม >520), STR เก็บตกจากแต้มที่เหลือ
      { name: "ไนท์เผา (Dragon Breath)", statOrder: ["VIT", "INT", "DEX", "STR"], targets: { VIT: 120, INT: 120, DEX: 60 },
        skillBoost: ["dragon breath", "breath", "dragon", "draconic", "มังกร", "ลมหายใจ", "เผา", "fire", "ไฟ"],
        skills: ["แม็กซ์ Dragon Breath (ไฟ/น้ำ)", "ขี่มังกร (Dragon Training) + เพิ่ม HP/SP", "สกิลลดดาเมจ/เอาตัวรอด"],
        gear: ["เพิ่ม Max HP + Max SP (สเกลดาเมจ)", "ดาเมจระยะไกล/ธาตุไฟ", "VIT/INT"],
        cards: ["การ์ด HP%/SP%", "ดาเมจธาตุไฟ/ระยะไกล", "VIT/INT + ลดดาเมจ"] },
    ],
  },
  {
    // Crusader / Paladin / Royal Guard
    match: ["crusader", "ครูเสด", "paladin", "พาลาดิน", "royal", "รอยัล"],
    variants: [
      { name: "แทงค์ (Shield)", statOrder: ["VIT", "STR", "DEX", "INT"], targets: { VIT: 120, STR: 90, DEX: 60 },
        skillBoost: ["shield", "defending", "provoke", "guard", "โล่", "ป้องกัน", "shield chain", "overbrand"],
        skills: ["แม็กซ์ Shield Chain / Shield Boomerang", "Defending Aura + Auto Guard / Reflect", "Provoke / Devotion เสริม"],
        gear: ["โล่ดี + เพิ่ม VIT/Max HP", "ลดดาเมจรับ (% reduction)", "เกราะธาตุ/ต้านสถานะ"],
        cards: ["การ์ด HP%/VIT", "ลดดาเมจจากเผ่า/ขนาด", "ต้านสถานะ (สตัน/แช่แข็ง)"] },
      { name: "Grand Cross", statOrder: ["VIT", "INT", "STR", "DEX"], targets: { VIT: 110, INT: 90, STR: 80, DEX: 50 },
        skillBoost: ["grand cross", "holy", "cross", "กางเขน", "ศักดิ์สิทธิ์"],
        skills: ["แม็กซ์ Grand Cross", "Holy Cross / Heal เสริม", "Defending / Auto Guard กันตาย"],
        gear: ["เพิ่ม INT/VIT + ดาเมจธาตุ Holy", "ของธาตุศักดิ์สิทธิ์", "Max HP/SP"],
        cards: ["การ์ด INT/VIT", "ดาเมจธาตุ Holy", "ลดดาเมจ/ต้านสถานะ"] },
    ],
  },
  {
    // Mage / Wizard / High Wizard / Warlock
    match: ["mage", "เมจ", "wizard", "วิซ", "warlock", "วอร์ล็อก"],
    variants: [
      { name: "สายไฟ/หิน (Meteor)", statOrder: ["INT", "DEX", "VIT", "LUK"], targets: { INT: 120, DEX: 90, VIT: 50 },
        skillBoost: ["meteor", "fire", "earth", "heaven", "ไฟ", "อุกกาบาต"],
        skills: ["แม็กซ์ Meteor Storm + Fire Bolt/Wall", "Heaven's Drive สาย Earth", "ลดเวลาร่าย + ฟื้น SP"],
        gear: ["MATK/INT + ดาเมจธาตุไฟ-ดิน", "ลดเวลาร่าย (VCT)", "เพิ่ม SP"],
        cards: ["การ์ด MATK/INT", "ดาเมจธาตุไฟ/ดิน", "ลดเวลาร่าย/SP"] },
      { name: "สายน้ำแข็ง/สายฟ้า", statOrder: ["INT", "DEX", "VIT", "LUK"], targets: { INT: 120, DEX: 99, VIT: 50 },
        skillBoost: ["storm", "jupitel", "frost", "cold", "lightning", "vermilion", "สายฟ้า", "น้ำแข็ง"],
        skills: ["แม็กซ์ Storm Gust / Lord of Vermilion", "Frost Diver / Jupitel Thunder", "ลดเวลาร่าย + ฟื้น SP"],
        gear: ["MATK/INT + ดาเมจธาตุน้ำ-ลม", "ลดเวลาร่าย (VCT)", "เพิ่ม SP"],
        cards: ["การ์ด MATK/INT", "ดาเมจธาตุน้ำ/ลม", "ลดเวลาร่าย/SP"] },
      { name: "สายบอลต์ (Bolt)", statOrder: ["INT", "DEX", "VIT", "LUK"], targets: { INT: 120, DEX: 80, VIT: 50 },
        skillBoost: ["bolt", "soul", "napalm", "โบลต์"],
        skills: ["แม็กซ์ Bolt ธาตุที่ใช้ (ไฟ/น้ำ/ฟ้า)", "Soul Strike / Napalm Beat สาย Ghost", "Amplify / ลดเวลาร่าย"],
        gear: ["MATK/INT สูง", "ลดเวลาร่าย", "เพิ่ม SP"],
        cards: ["การ์ด MATK/INT", "ดาเมจตามธาตุ", "ลดเวลาร่าย/SP"] },
    ],
  },
  {
    // Acolyte / Priest / Monk lines
    match: ["priest", "พรีสต์", "bishop", "บิชอป", "acolyte", "อโคไลท์"],
    variants: [
      { name: "ซัพพอร์ต (Full Support)", statOrder: ["INT", "DEX", "VIT", "LUK"], targets: { INT: 120, DEX: 90, VIT: 80 },
        skillBoost: ["heal", "bless", "agi", "sanctuary", "kyrie", "ฮีล", "พร", "อวยพร"],
        skills: ["แม็กซ์ Heal + Blessing / Increase AGI", "Sanctuary / Kyrie Eleison", "Resurrection / Safety Wall"],
        gear: ["เพิ่ม INT + พลังฮีล", "ลดเวลาร่าย / เพิ่ม SP", "VIT/Max HP กันตาย"],
        cards: ["การ์ด INT/SP", "ลดเวลาร่าย", "VIT/ต้านสถานะ"] },
      { name: "สายตีอนเดด (Turn Undead)", statOrder: ["INT", "DEX", "VIT", "LUK"], targets: { INT: 120, DEX: 99, VIT: 60 },
        skillBoost: ["undead", "magnus", "holy light", "judex", "อนเดด", "ศักดิ์สิทธิ์"],
        skills: ["แม็กซ์ Turn Undead + Magnus Exorcismus", "Holy Light / Judex", "Blessing / Sanctuary เสริม"],
        gear: ["MATK/INT + ดาเมจธาตุ Holy", "ลดเวลาร่าย", "เพิ่ม SP"],
        cards: ["การ์ด INT/MATK", "ดาเมจ Holy / ต่อ Undead", "ลดเวลาร่าย/SP"] },
    ],
  },
  {
    match: ["monk", "มังค์", "sura", "ซูระ", "champion"],
    variants: [
      { name: "อสุระ (Asura)", statOrder: ["STR", "INT", "DEX", "VIT"], targets: { STR: 110, INT: 90, DEX: 80 },
        skillBoost: ["asura", "spirit", "fury", "อสุระ", "ตะวัน"],
        skills: ["แม็กซ์ Asura Strike (Guillotine Fist)", "Spirit Spheres + Fury / Critical Explosion", "Blade Stop / Snap เข้าหา"],
        gear: ["เพิ่ม STR/INT + Max SP (สเกล Asura)", "ดาเมจ/เจาะ DEF", "ลดคูลดาวน์"],
        cards: ["การ์ด STR/INT", "ดาเมจต่อเผ่า/บอส", "SP / ลดดาเมจ"] },
      { name: "คอมโบ (Combo)", statOrder: ["STR", "AGI", "DEX", "VIT"], targets: { STR: 110, AGI: 90, DEX: 80 },
        skillBoost: ["combo", "fist", "investigate", "chain", "หมัด", "คอมโบ"],
        skills: ["Triple Attack → Chain Combo → Combo Finish", "Investigate / Occult เจาะ DEF", "Spirit Spheres + Fury"],
        gear: ["เพิ่ม STR/AGI + ASPD", "เจาะ DEF", "ดาเมจหมัด/ต่อเผ่า"],
        cards: ["การ์ด STR/AGI", "ASPD / เจาะ DEF", "ดาเมจต่อเผ่า"] },
    ],
  },
  {
    match: ["assassin", "แอสซาซิน", "cross", "guillotine", "กิโยติน"],
    variants: [
      // เมตาไต้หวัน (十字刺客): กาต้าร์ดับเบิลคริ — 暴擊型 STR/AGI/LUK
      { name: "กาต้าร์ คริ (暴擊)", statOrder: ["AGI", "STR", "LUK", "DEX"], targets: { AGI: 110, STR: 110, LUK: 90 },
        skillBoost: ["katar", "grimtooth", "cloak", "crit", "กะตาร์", "คริ", "拳刃"],
        skills: ["แม็กซ์ Sonic Blow + ความชำนาญกาต้าร์", "Enchant Poison / Grimtooth", "Cloaking / Improve Dodge"],
        gear: ["กาต้าร์ ATK/คริสูง", "เพิ่ม AGI/STR/LUK + คริ", "ASPD"],
        cards: ["การ์ดคริ/ATK", "ดาเมจต่อเผ่า/ขนาด", "ASPD"] },
      // 音投型 (Sonic Throw) — ไต้หวันใช้ STR/VIT/LUK (อึดกว่า, ใช้ซอนิคโยน)
      { name: "กาต้าร์ ซอนิค (音投)", statOrder: ["STR", "VIT", "LUK", "AGI"], targets: { STR: 110, VIT: 90, LUK: 90 },
        skillBoost: ["sonic", "throw", "ซอนิค", "音投", "音速", "投擲"],
        skills: ["แม็กซ์ Sonic Blow / ซอนิคโยน", "ความชำนาญกาต้าร์ + Enchant Poison", "Cloaking + สกิลเอาตัวรอด"],
        gear: ["กาต้าร์ ATK สูง", "เพิ่ม STR/VIT/LUK", "Max HP"],
        cards: ["การ์ด STR/HP%", "ดาเมจต่อเผ่า", "ต้านสถานะ"] },
      // ดาบคู่ = Double Attack เน้น ASPD สูงสุด + STR, DEX พอแม่น
      { name: "ดาบคู่ (Double Attack)", statOrder: ["AGI", "STR", "DEX", "LUK"], targets: { AGI: 120, STR: 110, DEX: 50 },
        skillBoost: ["double", "red cut", "dual", "dagger", "ดาบคู่", "ดับเบิล", "กริช"],
        skills: ["แม็กซ์ Double Attack + ความชำนาญดาบคู่", "Enchant Poison / Sonic Blow เสริม", "Improve Dodge / Cloaking"],
        gear: ["กริช ATK/ASPD คู่", "เพิ่ม AGI/STR", "ดัน ASPD ให้ถึงเพดาน"],
        cards: ["การ์ด AGI/ATK", "ASPD", "ดาเมจต่อเผ่า"] },
    ],
  },
  {
    match: ["gunslinger", "ปืน", "rebel", "rebellion", "night walker"],
    variants: [
      { name: "Rapid/Desperado", statOrder: ["DEX", "AGI", "LUK", "VIT"], targets: { DEX: 120, AGI: 100 },
        skillBoost: ["rapid", "desperado", "bullet", "gatling", "rain", "กระสุน"],
        skills: ["แม็กซ์ Rapid Shower / Desperado", "Gatling Fever + Increase Accuracy", "Madness Canceller"],
        gear: ["ปืน ATK ระยะไกลสูง", "เพิ่ม DEX/AGI + ASPD", "กระสุนธาตุ"],
        cards: ["การ์ด DEX/ATK", "ดาเมจระยะไกล", "ASPD"] },
      { name: "คริ/Single (Crit)", statOrder: ["DEX", "LUK", "AGI", "VIT"], targets: { DEX: 110, LUK: 110 },
        skillBoost: ["single", "tracking", "crit", "snipe", "คริ"],
        skills: ["แม็กซ์ Tracking / Single Action (คริ)", "Snake's Eye / Increase Accuracy", "Gunslinger Mastery"],
        gear: ["ปืนคริสูง", "เพิ่ม DEX/LUK + คริ", "กระสุนธาตุ"],
        cards: ["การ์ดคริ/DEX", "ดาเมจระยะไกล", "เจาะ DEF"] },
    ],
  },
];
function pickVariants(jobName: string): Variant[] {
  const n = (jobName || "").toLowerCase();
  const hit = VARIANT_SETS.find((v) => v.match.some((m) => n.includes(m)));
  return hit ? hit.variants : [];
}

/* ---- generic picker (items & cards) ---- */
function PickerModal({ title, items, iconPaths, onPick, onClose }: {
  title: string; items: NormItem[]; iconPaths: IconPaths | null;
  onPick: (it: NormItem) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [qf, setQf] = useState<number | null>(null);
  const qualities = useMemo(() => {
    const set = new Set<number>();
    items.forEach((i) => { if (i.quality != null) set.add(i.quality); });
    return Array.from(set).sort((a, b) => b - a);
  }, [items]);
  const data = useMemo(() => {
    // search across name + ability/effect text; multi-word (AND) + tone-insensitive
    const norm = (s: string) => s.toLowerCase().replace(/[\u0E47-\u0E4E]/g, "");
    const textOf = (it: NormItem) =>
      norm([
        it.title, it.subtitle, it.slot,
        ...(it.effects || []),
        ...(it.details || []).map((d) => d.label + " " + d.value),
      ].filter(Boolean).join(" "));
    const tokens = norm(q.trim()).split(/\s+/).filter(Boolean);
    return items.filter((i) => {
      if (qf != null && i.quality !== qf) return false;
      if (tokens.length) { const t = textOf(i); if (!tokens.every((tok) => t.includes(tok))) return false; }
      return true;
    });
  }, [q, qf, items]);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title} · {items.length}</Text>
          <TextInput style={styles.search} placeholder="ค้นหาชื่อ/ความสามารถ เช่น กันสตัน ป้องกันไฟ" placeholderTextColor="#6B7079"
            value={q} onChangeText={setQ} autoFocus />
          {qualities.length > 1 && (
            <View style={styles.pickerFilterRow}>
              <TouchableOpacity onPress={() => setQf(null)} style={[styles.pf, qf == null && styles.pfOn]}>
                <Text style={[styles.pfText, qf == null && styles.pfTextOn]}>ทั้งหมด</Text>
              </TouchableOpacity>
              {qualities.map((qq) => {
                const on = qf === qq; const info = QUALITY[qq];
                return (
                  <TouchableOpacity key={qq} onPress={() => setQf(on ? null : qq)}
                    style={[styles.pf, on && info && { backgroundColor: info.color, borderColor: info.color }]}>
                    <Text style={[styles.pfText, on && { color: "#0E0F12" }]}>{info ? info.label : qq}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <FlatList
            data={data} keyExtractor={(it) => String(it.id)} keyboardShouldPersistTaps="handled"
            style={{ marginTop: 8 }} initialNumToRender={20}
            ListEmptyComponent={<Text style={styles.empty}>ไม่พบรายการ</Text>}
            renderItem={({ item }) => {
              const qi = qualityInfo(item.quality);
              const url = resolveIconUrl(item, iconPaths);
              const line = Object.entries(itemStats(item)).map(([k, v]) => k.toUpperCase() + " +" + v).join("  ·  ");
              return (
                <TouchableOpacity style={styles.pickRow} activeOpacity={0.7} onPress={() => onPick(item)}>
                  <View style={styles.iconBox}>
                    {url ? <Image source={{ uri: url }} style={styles.icon28} resizeMode="contain" />
                      : <View style={[styles.icon28, styles.iconFallback]} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={[styles.pickName, qi && { color: qi.color }, { flexShrink: 1 }]} numberOfLines={1}>{item.title}</Text>
                      {item.reqLevel != null && <View style={styles.lvBadge}><Text style={styles.lvBadgeText}>Lv.{item.reqLevel}</Text></View>}
                    </View>
                    {!!line && <Text style={styles.pickStats} numberOfLines={1}>{line}</Text>}
                    {!line && !!(item.effects && item.effects[0]) && <Text style={styles.pickStats} numberOfLines={1}>{item.effects[0]}</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Text style={styles.closeText}>ปิด</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ClassModal({ jobs, iconPaths, onPick, onClose }: {
  jobs: NormItem[]; iconPaths: IconPaths | null; onPick: (j: NormItem) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const data = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? jobs.filter((j) => (j.title || "").toLowerCase().includes(s)) : jobs;
  }, [q, jobs]);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>เลือกอาชีพ · {jobs.length}</Text>
          <TextInput style={styles.search} placeholder="ค้นหาอาชีพ..." placeholderTextColor="#6B7079"
            value={q} onChangeText={setQ} />
          <FlatList
            data={data} keyExtractor={(j) => String(j.id)} numColumns={2}
            style={{ marginTop: 8 }} keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const url = resolveIconUrl(item, iconPaths);
              return (
                <TouchableOpacity style={styles.jobCell} activeOpacity={0.7} onPress={() => onPick(item)}>
                  <View style={styles.iconBox}>
                    {url ? <Image source={{ uri: url }} style={styles.icon28} resizeMode="contain" />
                      : <View style={[styles.icon28, styles.iconFallback]} />}
                  </View>
                  <Text style={styles.jobName} numberOfLines={1}>{item.title}</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>ไม่พบอาชีพ</Text>}
          />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Text style={styles.closeText}>ปิด</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function tierPool(idx: number): number {
  if (idx === 0) return SKILL_TIER_POOLS.novice;
  if (idx === 1) return SKILL_TIER_POOLS.first;
  if (idx === 2) return SKILL_TIER_POOLS.second;
  if (idx === 3) return SKILL_TIER_POOLS.third;
  return 0;
}

/* ---- per-skill damage / DPS estimate ----------------------------------------
 * Uses the game's own skill data: pve_percent (% of ATK/MATK) + pve_flat, and
 * cooldown / gcd / cast (chant_fixed+chant_float) for the reuse cycle.
 *   hit  = base * pve_percent/100 + pve_flat   (base = P.ATK or M.ATK)
 *   DPS  = hit / cycleSeconds                  (cycle = max(cooldown, gcd+cast))
 * Rough estimate — ignores resistances, combos, multi-hit counts, buffs. */
type SkillDmg = { hit: number; dps: number; magic: boolean; cycle: number };
function skillDamage(node: SkillNode, lvl: number, patk: number, matk: number): SkillDmg | null {
  if (!node.levels) return null;
  const use = lvl > 0 ? lvl : node.naturalMax || 1;
  const L = node.levels[use] || node.levels[String(use)] || node.levels[node.naturalMax] ||
    node.levels[1] || node.levels["1"];
  if (!L) return null;
  const pct = Number(L.pve_percent) || 0;
  const flat = Number(L.pve_flat) || 0;
  if (pct === 0 && flat === 0) return null;            // not a damage skill
  const magic = /M\.DMG|M\.ATK|magic/i.test(String(L.des || ""));
  const base = magic ? matk : patk;
  const hit = base * (pct / 100) + flat;
  const cast = (Number(L.chant_fixed) || 0) + (Number(L.chant_float) || 0);
  const cycle = Math.max(Number(L.cooldown) || 0, (Number(L.gcd) || 0) + cast, 1000); // ms
  return { hit: Math.round(hit), dps: Math.round(hit / (cycle / 1000)), magic, cycle };
}

/* ---- real skill planner (loads the live skill tree per job) ---- */
function SkillPlanner({ locale, iconPaths, initialJobName, boostKeywords, avoidKeywords, autoApply, patk, matk, onClose }: {
  locale: string; iconPaths: IconPaths | null; initialJobName?: string;
  boostKeywords?: string[]; avoidKeywords?: string[]; autoApply?: boolean;
  patk?: number; matk?: number; onClose: () => void;
}) {
  const [index, setIndex] = useState<Record<number, JobNode> | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [jobSkills, setJobSkills] = useState<Record<number, SkillNode[]>>({});
  const [pts, setPts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [jobPick, setJobPick] = useState(false);

  useEffect(() => {
    let ok = true;
    fetchSkillIndex(locale).then((idx) => {
      if (!ok) return;
      setIndex(idx);
      let tgt: number | null = null;
      if (initialJobName) {
        const n = initialJobName.trim().toLowerCase();
        const cands = Object.values(idx).filter((j) => jobPathHasSkills(idx, j.id));
        let hit = cands.find((j) => j.name.toLowerCase() === n);
        if (!hit) hit = cands.find((j) => j.name.toLowerCase().includes(n) || n.includes(j.name.toLowerCase()));
        if (hit) tgt = hit.id;
      }
      setTarget(tgt);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { ok = false; };
  }, [locale, initialJobName]);

  const path = useMemo(() => (index && target ? skillPathTo(index, target) : []), [index, target]);

  useEffect(() => {
    if (!path.length) return;
    let ok = true;
    const missing = path.filter((id) => !jobSkills[id]);
    if (!missing.length) return;
    setBusy(true);
    Promise.all(
      missing.map((id) =>
        fetchJobSkills(id, locale)
          .then((r) => [id, r.skills] as [number, SkillNode[]])
          .catch(() => [id, [] as SkillNode[]] as [number, SkillNode[]])
      )
    )
      .then((pairs) => {
        if (!ok) return;
        setJobSkills((prev) => { const next = { ...prev }; pairs.forEach(([id, sk]) => (next[id] = sk)); return next; });
      })
      .finally(() => { if (ok) setBusy(false); });
    return () => { ok = false; };
  }, [path, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const ownerOf = (kindId: string): number | null => {
    for (const id of path) if ((jobSkills[id] || []).some((s) => s.kindId === kindId)) return id;
    return null;
  };
  const nodeOf = (kindId: string): SkillNode | null => {
    for (const id of path) { const f = (jobSkills[id] || []).find((s) => s.kindId === kindId); if (f) return f; }
    return null;
  };
  const bill = (s: SkillNode, lvl: number) => Math.min(Math.max(lvl, 0), s.naturalMax);
  const spentInJob = (jobId: number) => (jobSkills[jobId] || []).reduce((sum, s) => sum + bill(s, pts[s.kindId] || 0), 0);
  const spentByTier = path.map((id) => spentInJob(id));
  const totalBudget = path.reduce((sum, _id, i) => sum + tierPool(i), 0);
  const totalSpent = spentByTier.reduce((a, b) => a + b, 0);
  const preOkWith = (s: SkillNode, table: Record<string, number>) =>
    s.preSkill.every((code) => (table[String(Math.floor(code / 100))] || 0) >= code % 100);
  const tierUnlocked = (idx: number) => idx <= 0 || spentInJob(path[idx - 1]) >= skillUnlockLimit(path[idx - 1]);

  const canAdd = (s: SkillNode, jobId: number) => {
    const lvl = pts[s.kindId] || 0;
    if (lvl >= s.maxLevel) return false;
    if (!preOkWith(s, pts)) return false;
    if (lvl < s.naturalMax) {
      const idx = path.indexOf(jobId);
      if (!tierUnlocked(idx)) return false;
      if (spentByTier[idx] + 1 > tierPool(idx)) return false;
      if (totalSpent + 1 > totalBudget) return false;
    }
    return true;
  };

  const add = (kindId: string) => {
    const s = nodeOf(kindId); const owner = ownerOf(kindId);
    if (!s || owner == null || !canAdd(s, owner)) return;
    setPts((p) => ({ ...p, [kindId]: (p[kindId] || 0) + 1 }));
    setSel(kindId);
  };
  const addMax = (kindId: string) => {
    const s = nodeOf(kindId); const owner = ownerOf(kindId);
    if (!s || owner == null) return;
    setPts((p) => {
      const next = { ...p }; let guard = 0;
      const sIn = (jid: number) => (jobSkills[jid] || []).reduce((sum, x) => sum + Math.min(next[x.kindId] || 0, x.naturalMax), 0);
      const idx = path.indexOf(owner);
      while ((next[kindId] || 0) < s.naturalMax && guard++ < 200) {
        if (!preOkWith(s, next)) break;
        if (!(idx <= 0 || sIn(path[idx - 1]) >= skillUnlockLimit(path[idx - 1]))) break;
        if (sIn(owner) + 1 > tierPool(idx)) break;
        if (path.reduce((a, id) => a + sIn(id), 0) + 1 > totalBudget) break;
        next[kindId] = (next[kindId] || 0) + 1;
      }
      return next;
    });
    setSel(kindId);
  };
  const remove = (kindId: string) => {
    setPts((p) => {
      const cur = p[kindId] || 0; if (cur <= 0) return p;
      const next = { ...p }; next[kindId] = cur - 1; if (next[kindId] <= 0) delete next[kindId];
      let changed = true;
      while (changed) {
        changed = false;
        for (const k of Object.keys(next)) {
          const node = nodeOf(k); if (!node) continue;
          if (!preOkWith(node, next)) { delete next[k]; changed = true; }
        }
      }
      return next;
    });
    setSel(kindId);
  };

  // auto-suggest a damage-focused build from the live skill data
  const autoRecommend = () => {
    setPts(() => {
      const next: Record<string, number> = {};
      if (!path.length) return next;
      const sIn = (jid: number) => (jobSkills[jid] || []).reduce((sum, x) => sum + Math.min(next[x.kindId] || 0, x.naturalMax), 0);
      const total = () => path.reduce((a, id) => a + sIn(id), 0);
      const idxOf = (jid: number) => path.indexOf(jid);
      const unlocked = (tier: number) => tier <= 0 || sIn(path[tier - 1]) >= skillUnlockLimit(path[tier - 1]);
      const findFn = (kindId: string) => {
        for (const id of path) { const f = (jobSkills[id] || []).find((s) => s.kindId === kindId); if (f) return { s: f, owner: id }; }
        return null;
      };
      const tryAddOne = (kindId: string, depth = 0): boolean => {
        if (depth > 30) return false;
        const fn = findFn(kindId); if (!fn) return false;
        const { s, owner } = fn; const tier = idxOf(owner);
        const lvl = next[kindId] || 0;
        if (lvl >= s.maxLevel) return false;
        for (const code of s.preSkill) {
          const pid = String(Math.floor(code / 100)); const need = code % 100;
          let guard = 0;
          while ((next[pid] || 0) < need && guard++ < 50) { if (!tryAddOne(pid, depth + 1)) break; }
          if ((next[pid] || 0) < need) return false;
        }
        if (lvl < s.naturalMax) {
          if (!unlocked(tier)) return false;
          if (sIn(owner) + 1 > tierPool(tier)) return false;
          if (total() + 1 > totalBudget) return false;
        }
        next[kindId] = (next[kindId] || 0) + 1;
        return true;
      };
      // Priority: damage-boosting passives/masteries FIRST (e.g. Double Attack,
      // weapon mastery, Improve Dodge for a dagger Assassin), then other
      // passives, then buffs/utility, then raw damage actives. skill_type can be
      // unreliable so non-damage skills are ranked above damage regardless.
      const DMG_PASSIVE_KW = ["mastery", "มาสเตอรี", "double", "ดับเบิล", "improve", "sharp",
        "atk", "พลังโจมตี", "ดาเมจ", "damage", "crit", "คริ", "blade", "slash", "เพิ่มความแรง"];
      type Item = { kindId: string; nat: number; score: number };
      const items: Item[] = [];
      path.forEach((jid, tier) => {
        (jobSkills[jid] || []).forEach((s) => {
          const dmg = !!s.levels && Object.values(s.levels).some((lv: any) => {
            const a = Number(lv?.pve_percent), b = Number(lv?.pve_flat);
            return (Number.isFinite(a) && a !== 0) || (Number.isFinite(b) && b !== 0);
          });
          const nm = s.name.toLowerCase();
          const boosted = !!(boostKeywords && boostKeywords.some((k) => nm.includes(k.toLowerCase())));
          // skills belonging to a DIFFERENT sub-build (e.g. Falcon/Trap when ADL
          // is chosen) are DE-PRIORITIZED, not skipped — otherwise filtering them
          // out can leave a tier under its 40-pt unlock, stranding the budget and
          // locking later tiers. They still get filled last, with leftover points.
          const avoided = !boosted && !!avoidKeywords && avoidKeywords.some((k) => nm.includes(k.toLowerCase()));
          let score: number;
          if (s.passive) {
            score = 120;
            if (DMG_PASSIVE_KW.some((k) => nm.includes(k))) score += 25; // damage passives first
          } else if (dmg) {
            score = 100;                 // raw damage actives
          } else {
            score = 110;                 // buffs / utility actives (still above damage)
          }
          score += tier * 6;
          if (boosted) score += 250;
          if (avoided) score -= 300;     // last resort: only to unlock tiers / spend leftover
          items.push({ kindId: s.kindId, nat: s.naturalMax, score });
        });
      });
      const byScore = (a: Item, b: Item) => b.score - a.score;
      const wanted = items.filter((i) => i.score >= 0).sort(byScore);   // on-build + shared
      const offbuild = items.filter((i) => i.score < 0).sort(byScore);  // other sub-builds
      const fillWanted = () => {
        let progress = true, passes = 0;
        while (progress && passes++ < 25) {
          progress = false;
          for (const it of wanted) {
            let guard = 0;
            while ((next[it.kindId] || 0) < it.nat && guard++ < 50) {
              if (tryAddOne(it.kindId)) progress = true; else break;
            }
          }
        }
      };
      fillWanted();
      // Off-build skills are used ONLY to unlock a tier that still gates wanted
      // skills (so the budget isn't stranded), never as pure leftover — that's
      // why a 2H-sword build won't pour spare points into spear skills.
      for (let t = 0; t < path.length - 1; t++) {
        const gatesWanted = wanted.some((it) => {
          const fn = findFn(it.kindId);
          return fn && idxOf(fn.owner) > t && (next[it.kindId] || 0) < it.nat;
        });
        if (!gatesWanted) continue;
        const limit = skillUnlockLimit(path[t]);
        let guard = 0;
        while (sIn(path[t]) < limit && guard++ < 200) {
          let added = false;
          for (const it of offbuild) {
            const fn = findFn(it.kindId);
            if (!fn || idxOf(fn.owner) !== t || (next[it.kindId] || 0) >= it.nat) continue;
            if (tryAddOne(it.kindId)) { added = true; break; }
          }
          if (!added) break;
        }
        fillWanted();
      }
      return next;
    });
    setSel(null);
  };

  // When opened from a chosen build line, fill the plan automatically once the
  // whole job path's skills have loaded — no need to pick/recommend inside.
  const appliedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!autoApply || !target || !path.length) return;
    if (path.some((id) => !jobSkills[id])) return;   // wait until all tiers loaded
    if (appliedRef.current === target) return;        // only once per target
    appliedRef.current = target;
    autoRecommend();
  }, [autoApply, target, path, jobSkills]); // eslint-disable-line react-hooks/exhaustive-deps

  const skillIcon = (icon?: string) =>
    resolveIconUrl({ iconName: icon, iconUrl: icon ? "skill/" + icon + ".webp" : undefined } as any, iconPaths);
  const selNode = sel ? nodeOf(sel) : null;
  const selDes = (() => {
    if (!selNode || !selNode.levels) return "";
    const lvl = pts[selNode.kindId] || 1;
    const lv = selNode.levels[lvl] || selNode.levels[String(lvl)] || selNode.levels[1] || selNode.levels["1"];
    const d = lv && (lv.des || lv.skilldes);
    return d ? String(d).replace(/<color=#?[0-9a-fA-F]+>/g, "").replace(/<\/color>/g, "").replace(/\n/g, " ") : "";
  })();

  const targetJobs = useMemo(() => {
    if (!index) return [];
    return Object.values(index).filter((j) => j.id !== 101 && jobPathHasSkills(index, j.id)).sort((a, b) => a.id - b.id);
  }, [index]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalCard, { maxHeight: "92%" }]}>
          <View style={styles.modalHandle} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={styles.modalTitle}>วางแผนสกิล</Text>
            <Text style={styles.spBudget}>{totalSpent} / {totalBudget}</Text>
          </View>

          <TouchableOpacity style={styles.jobSelectBtn} onPress={() => setJobPick(true)}>
            <Text style={styles.jobSelectText}>{target && index ? index[target]?.name : "เลือกอาชีพเป้าหมาย"}</Text>
            <Text style={styles.chev}>▾</Text>
          </TouchableOpacity>

          {!!target && !busy && (
            <TouchableOpacity style={styles.skRecBtn} onPress={autoRecommend}>
              <Text style={styles.skRecText}>✦ จัดสกิลตามสายนี้อีกครั้ง</Text>
            </TouchableOpacity>
          )}

          {loading ? (
            <ActivityIndicator color="#E8B339" style={{ marginTop: 20 }} />
          ) : !target ? (
            <Text style={[styles.empty, { padding: 20 }]}>เลือกอาชีพเป้าหมายเพื่อดู skill tree</Text>
          ) : (
            <ScrollView style={{ marginTop: 8 }} contentContainerStyle={{ paddingBottom: 16 }}>
              {busy && <ActivityIndicator color="#E8B339" style={{ marginVertical: 8 }} />}
              {path.map((jid, idx) => {
                const job = index ? index[jid] : null;
                const list = jobSkills[jid] || [];
                const unlocked = tierUnlocked(idx);
                return (
                  <View key={jid} style={styles.skJobSection}>
                    <View style={styles.skJobHead}>
                      <Text style={styles.skJobName}>{job?.name || ("Job " + jid)}</Text>
                      <Text style={[styles.skJobPts, spentInJob(jid) > tierPool(idx) && { color: "#E06C6C" }]}>{spentInJob(jid)} / {tierPool(idx)}</Text>
                    </View>
                    {!unlocked && <Text style={styles.skLockNote}>ปลดล็อกเมื่อใช้พอยต์อาชีพก่อนหน้าครบ</Text>}
                    <View style={styles.skGrid}>
                      {list.map((s) => {
                        const lvl = pts[s.kindId] || 0;
                        const url = skillIcon(s.icon);
                        const addOk = canAdd(s, jid);
                        const over = lvl > s.naturalMax;
                        return (
                          <View key={s.kindId} style={styles.skNode}>
                            <TouchableOpacity onPress={() => setSel(s.kindId)} style={[styles.skIconBox, lvl > 0 && styles.skIconActive]}>
                              {url ? <Image source={{ uri: url }} style={styles.skIcon} resizeMode="contain" /> : <View style={[styles.skIcon, styles.iconFallback]} />}
                              <Text style={[styles.skLvl, over && { color: "#E8B339" }]}>{lvl}/{s.naturalMax}</Text>
                            </TouchableOpacity>
                            <Text style={styles.skName} numberOfLines={2}>{s.name}</Text>
                            <View style={styles.skCtrl}>
                              <TouchableOpacity disabled={lvl <= 0} onPress={() => remove(s.kindId)} style={[styles.skBtn, lvl <= 0 && styles.stepDisabled]}><Text style={styles.skBtnText}>−</Text></TouchableOpacity>
                              <TouchableOpacity disabled={!addOk} onPress={() => add(s.kindId)} style={[styles.skBtn, styles.skBtnAdd, !addOk && styles.stepDisabled]}><Text style={[styles.skBtnText, { color: "#0E0F12" }]}>＋</Text></TouchableOpacity>
                              <TouchableOpacity disabled={!addOk} onPress={() => addMax(s.kindId)} style={[styles.skBtn, !addOk && styles.stepDisabled]}><Text style={styles.skBtnText}>++</Text></TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                      {list.length === 0 && <Text style={styles.cardEmpty}>—</Text>}
                    </View>
                  </View>
                );
              })}
              {!!selDes && (
                <View style={styles.skDetail}>
                  <Text style={styles.skDetailName}>{selNode?.name}</Text>
                  {(() => {
                    if (!selNode) return null;
                    const dmg = skillDamage(selNode, pts[selNode.kindId] || 0, patk || 0, matk || 0);
                    if (!dmg) return null;
                    return (
                      <View style={styles.skDpsRow}>
                        <Text style={styles.skDpsMain}>≈ {dmg.hit.toLocaleString()} /ครั้ง</Text>
                        <Text style={styles.skDpsSub}>DPS ≈ {dmg.dps.toLocaleString()} · {dmg.magic ? "เวท (MATK)" : "กาย (P.ATK)"} · รอบ {(dmg.cycle / 1000).toFixed(1)}s</Text>
                      </View>
                    );
                  })()}
                  <Text style={styles.skDetailDes}>{selDes}</Text>
                </View>
              )}
            </ScrollView>
          )}

          <View style={{ flexDirection: "row", marginTop: 8 }}>
            <TouchableOpacity style={[styles.closeBtn, { flex: 1, marginRight: 6, backgroundColor: "#16181D", borderWidth: 1, borderColor: "#3A3F48" }]} onPress={() => setPts({})}>
              <Text style={[styles.closeText, { color: "#C7CBD1" }]}>รีเซ็ต</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.closeBtn, { flex: 1, marginLeft: 6 }]} onPress={onClose}><Text style={styles.closeText}>ปิด</Text></TouchableOpacity>
          </View>

          {jobPick && index && (
            <Modal visible transparent animationType="fade" onRequestClose={() => setJobPick(false)}>
              <View style={styles.modalBg}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setJobPick(false)} />
                <View style={[styles.modalCard, { maxHeight: "80%" }]}>
                  <View style={styles.modalHandle} />
                  <Text style={styles.modalTitle}>เลือกอาชีพเป้าหมาย</Text>
                  <FlatList
                    data={targetJobs} keyExtractor={(j) => String(j.id)} numColumns={2}
                    style={{ marginTop: 8 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.jobCell} onPress={() => { setTarget(item.id); setPts({}); setSel(null); setJobPick(false); }}>
                        <Text style={styles.jobName} numberOfLines={1}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                  />
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setJobPick(false)}><Text style={styles.closeText}>ปิด</Text></TouchableOpacity>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function CharacterScreen() {
  const [locale, setLocale] = useState("th-TH");
  const [equipment, setEquipment] = useState<NormItem[]>([]);
  const [cards, setCards] = useState<NormItem[]>([]);
  const [jobs, setJobs] = useState<NormItem[]>([]);
  const [skillMeta, setSkillMeta] = useState<Record<string, { points: number; path: string }>>({});
  const [iconPaths, setIconPaths] = useState<IconPaths | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [build, setBuild] = useState<Build>(emptyBuild);
  const [saved, setSaved] = useState<Build | null>(null);
  const [picker, setPicker] = useState<{ kind: string; slot?: string } | null>(null);

  const load = useCallback(async (loc: string) => {
    setLoading(true); setError(null);
    try {
      const [eq, cd, sk, icons] = await Promise.all([
        fetchData("equipment", loc),
        fetchData("cards", loc),
        fetchData("skills", loc).catch(() => ({ items: [] as NormItem[] })),
        fetchIconPaths().catch(() => null),
      ]);
      setEquipment(eq.items); setCards(cd.items); setIconPaths(icons);
      // prefer the job list from the equipment dataset (ids line up with jobLimits);
      // fall back to skills jobs if it's missing
      const eqJobs = (eq as any).jobs as { id: number; name: string; icon?: string }[] | undefined;
      setJobs(
        eqJobs && eqJobs.length
          ? eqJobs.map((j) => ({ id: j.id, title: j.name, iconName: j.icon } as NormItem))
          : sk.items
      );
      // skill index metadata (evolution path + skill-point budget), keyed by job name
      const meta: Record<string, { points: number; path: string }> = {};
      (sk.items || []).forEach((j: NormItem) => {
        meta[(j.title || "").toLowerCase()] = {
          points: Number(j.tags?.points) || 0,
          path: j.subtitle || "",
        };
      });
      setSkillMeta(meta);
    } catch (e: any) {
      setError(e.message || "load failed");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { setBuild(emptyBuild()); load(locale); }, [locale, load]);

  // equipment grouped by slot key (for the per-slot picker)
  const bySlot = useMemo(() => {
    const m: Record<string, NormItem[]> = {};
    for (const it of equipment) (m[itemSlotKey(it)] = m[itemSlotKey(it)] || []).push(it);
    return m;
  }, [equipment]);

  const totals = useMemo(() => computeStats(build), [build]);
  const combat = useMemo(() => computeCombat(build, totals), [build, totals]);
  const preset = useMemo(() => pickPreset(build.job?.title || ""), [build.job]);
  const jobMeta = build.job ? skillMeta[(build.job.title || "").toLowerCase()] : undefined;
  const variants = useMemo(() => pickVariants(build.job?.title || ""), [build.job]);
  const [variantIdx, setVariantIdx] = useState(0);
  useEffect(() => { setVariantIdx(0); }, [build.job]);
  const activeVariant = variants[variantIdx];
  // skills belonging to the OTHER sub-builds of this class line — used to keep
  // the auto skill plan from spending points off-build (e.g. ADL → avoid
  // Falcon/Trap skills). Shared keywords (used by the active variant too) drop out.
  const avoidKeywords = useMemo(() => {
    if (!activeVariant) return [];
    const set = new Set<string>();
    variants.filter((v) => v !== activeVariant)
      .forEach((v) => v.skillBoost.forEach((k) => set.add(k.toLowerCase())));
    activeVariant.skillBoost.forEach((k) => set.delete(k.toLowerCase()));
    return Array.from(set);
  }, [variants, activeVariant]);
  // recommended stat spread for the CURRENT level + chosen build line — i.e. the
  // stats you should be raising right now (updates as the level changes).
  const recStats = useMemo(() => {
    const p = activeVariant
      ? { ...preset, statOrder: activeVariant.statOrder, targets: activeVariant.targets }
      : preset;
    return planAllocate(build.level, p);
  }, [build.level, preset, activeVariant]);
  const applyPlan = () => {
    const p = activeVariant
      ? { ...preset, statOrder: activeVariant.statOrder, targets: activeVariant.targets }
      : preset;
    setBuild((b) => ({ ...b, stats: planAllocate(b.level, p) }));
  };
  const totalPoints = pointsForLevel(build.level);
  const remaining = useMemo(() => totalPoints - spentPoints(build.stats), [totalPoints, build.stats]);

  const getSlot = (k: string): Slot => build.slots[k] || { refine: 0, cards: [] };
  const setSlotPatch = (k: string, patch: Partial<Slot>) =>
    setBuild((b) => { const cur = b.slots[k] || { refine: 0, cards: [] }; return { ...b, slots: { ...b.slots, [k]: { ...cur, ...patch } } }; });
  const equip = (k: string, it: NormItem) => {
    setBuild((b) => {
      const cur = b.slots[k] || { refine: 0, cards: [] };
      const slots = { ...b.slots, [k]: { ...cur, item: it } };
      // a two-handed weapon frees/blocks the off-hand slot
      if (k === "weapon" && it.twoHanded) delete slots["offhand"];
      return { ...b, slots };
    });
    setPicker(null);
  };
  const clearSlot = (k: string) =>
    setBuild((b) => { const n = { ...b.slots }; delete n[k]; return { ...b, slots: n }; });
  const setRefine = (k: string, d: number) =>
    setBuild((b) => { const cur = b.slots[k]; if (!cur || !cur.item) return b; return { ...b, slots: { ...b.slots, [k]: { ...cur, refine: Math.max(0, Math.min(MAX_REFINE, cur.refine + d)) } } }; });
  const addCard = (k: string, c: NormItem) =>
    setBuild((b) => {
      const cur = b.slots[k] || { refine: 0, cards: [] };
      if (cur.cards.length >= MAX_CARDS) return b;        // max 2 cards per slot
      return { ...b, slots: { ...b.slots, [k]: { ...cur, cards: [...cur.cards, c] } } };
    });
  const removeCard = (k: string, i: number) =>
    setBuild((b) => { const cur = b.slots[k]; if (!cur) return b; return { ...b, slots: { ...b.slots, [k]: { ...cur, cards: cur.cards.filter((_, x) => x !== i) } } }; });
  const setLevel = (lv: number) => setBuild((b) => ({ ...b, level: Math.max(1, Math.min(MAX_LEVEL, lv)) }));
  const addStat = (k: string, dir: number) =>
    setBuild((b) => {
      const v = b.stats[k];
      if (dir > 0) { if (pointsForLevel(b.level) - spentPoints(b.stats) < costToRaise(v)) return b; return { ...b, stats: { ...b.stats, [k]: v + 1 } }; }
      if (v <= 1) return b; return { ...b, stats: { ...b.stats, [k]: v - 1 } };
    });
  // typed-in stat value: raise stat k toward the requested number, but never
  // beyond what the remaining points allow (so the build stays legal).
  const setStatValue = (k: string, raw: number) =>
    setBuild((b) => {
      const want = Math.max(1, Math.min(STAT_CAP, Math.floor(raw) || 1));
      const avail = pointsForLevel(b.level) - spentPoints({ ...b.stats, [k]: 1 });
      let v = 1, used = 0;
      while (v < want) { const c = costToRaise(v); if (used + c > avail) break; used += c; v++; }
      return { ...b, stats: { ...b.stats, [k]: v } };
    });

  // items to show in the slot picker: matching slot, filtered by the selected
  // class (jobLimits) AND the character's level (reqLevel) — only gear this
  // job can actually equip at this class level shows up.
  const pickerSlotItems = (k?: string): NormItem[] => {
    if (!k) return [];
    let m = bySlot[poolKeyOf(k)] || [];
    // Assassin lines can dual-wield: the off-hand may hold a second ONE-handed
    // weapon (dagger), so add one-handed weapons to the off-hand picker.
    const isDualWield = !!build.job && /assassin|แอส|cross|guillotine|กิโยติน/i.test(build.job.title || "");
    if (k === "offhand" && isDualWield) {
      const oneHandWeapons = (bySlot["weapon"] || []).filter((it) => !it.twoHanded);
      m = [...m, ...oneHandWeapons];
    }
    if (m.length === 0) m = equipment;            // fallback if slot mapping missed
    const jid = build.job ? Number(build.job.id) : null;
    if (jid != null) {
      const hasJobInfo = m.some((it) => it.jobAll || (it.jobLimits && it.jobLimits.length));
      if (hasJobInfo) m = m.filter((it) => it.jobAll || (it.jobLimits || []).includes(jid));
    }
    // class-level gate: hide gear whose required level exceeds the build level
    m = m.filter((it) => it.reqLevel == null || it.reqLevel <= build.level);
    return m;
  };

  // cards selectable for a slot: only cards whose type matches (weapon card -> weapon, ...)
  const cardsForSlot = (k?: string): NormItem[] => {
    if (!k) return cards;
    const f = cards.filter((c) => c.slotKey === poolKeyOf(k));
    return f.length ? f : cards;                  // fallback if no typed match
  };

  // a two-handed weapon occupies the off-hand slot too
  const weaponTwoHanded = !!getSlot("weapon").item?.twoHanded;

  const equippedSlots = SLOTS.filter((s) => getSlot(s.key).item);

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color="#E8B339" /></View>;
  if (error) return (
    <View style={[styles.container, styles.center]}>
      <Text style={styles.error}>{error}</Text>
      <TouchableOpacity style={styles.retry} onPress={() => load(locale)}><Text style={styles.retryText}>retry</Text></TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.screenTitle}>ตัวละคร</Text>
        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity style={styles.topBtn} onPress={() => setSaved(build)}><Text style={styles.topBtnText}>บันทึกเซ็ต</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.topBtn, !saved && styles.topBtnOff]} disabled={!saved} onPress={() => saved && setBuild(saved)}>
            <Text style={styles.topBtnText}>โหลดเซ็ต</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={styles.levelRow}>
          <Text style={styles.levelLabel}>Lv.</Text>
          <View style={styles.levelCtrl}>
            <TouchableOpacity style={styles.lvBtn} onPress={() => setLevel(build.level - 1)}><Text style={styles.lvBtnText}>−</Text></TouchableOpacity>
            <TextInput style={styles.lvInput} keyboardType="numeric" value={String(build.level)} onChangeText={(v) => setLevel(Number(v) || 1)} />
            <Text style={styles.lvMax}>/ {MAX_LEVEL}</Text>
            <TouchableOpacity style={styles.lvBtn} onPress={() => setLevel(build.level + 1)}><Text style={styles.lvBtnText}>+</Text></TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.classRow} onPress={() => setPicker({ kind: "class" })}>
          <Text style={styles.classLabel}>คลาส</Text>
          <Text style={styles.classValue}>{build.job ? build.job.title : "เลือกอาชีพ"}</Text>
          <Text style={styles.chev}>▾</Text>
        </TouchableOpacity>

        {/* The Best Set — recommended plan for the selected class */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>The Best Set · {preset.role}</Text>
          <TouchableOpacity style={styles.planBtn} onPress={applyPlan}>
            <Text style={styles.planBtnText}>จัดสเตตัสให้</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.planBox}>
          {variants.length > 0 && (
            <>
              <Text style={styles.planKey}>สาย build</Text>
              <View style={styles.chipWrap}>
                {variants.map((v, i) => (
                  <TouchableOpacity key={v.name} onPress={() => setVariantIdx(i)}
                    style={[styles.buildChip, i === variantIdx && styles.buildChipOn]}>
                    <Text style={[styles.buildChipText, i === variantIdx && styles.buildChipTextOn]}>{v.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.planDivider} />
            </>
          )}
          <View style={styles.planLine}>
            <Text style={styles.planKey}>สเตตัส</Text>
            <View style={styles.chipWrap}>
              {(activeVariant ? activeVariant.statOrder : preset.statOrder).map((k, i) => {
                const rec = recStats[k] || 1;
                const cap = activeVariant?.targets?.[k] ?? preset.targets?.[k];
                return (
                  <View key={k} style={styles.chip}>
                    <Text style={styles.chipText}>
                      {i + 1}. {k} <Text style={{ color: "#E8B339" }}>{rec}</Text>
                      {cap && cap > rec ? <Text style={{ color: "#6B7079" }}> →{cap}</Text> : null}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
          <Text style={styles.planMini}>ตัวเลขทอง = ควรอัพถึงที่ Lv.{build.level} · →เลข = เป้าหมายสุดท้าย</Text>
          <View style={styles.planDivider} />
          {jobMeta && !!jobMeta.path && (
            <>
              <Text style={styles.planKey}>เส้นทางอาชีพ</Text>
              <Text style={styles.planItem}>{jobMeta.path}</Text>
              {jobMeta.points > 0 && <Text style={styles.planItem}>สกิลพอยต์รวม: {jobMeta.points}</Text>}
              <View style={styles.planDivider} />
            </>
          )}
          <Text style={styles.planKey}>สกิล (แนวทาง){activeVariant ? " · " + activeVariant.name : ""}</Text>
          {(activeVariant?.skills ?? preset.skills).map((t, i) => <Text key={i} style={styles.planItem}>• {t}</Text>)}
          <TouchableOpacity style={styles.skPlanOpen} onPress={() => setPicker({ kind: "skillplan" })}>
            <Text style={styles.skPlanOpenText}>เปิด Skill Planner (สกิลจริง) ▸</Text>
          </TouchableOpacity>
          <View style={styles.planDivider} />
          <Text style={styles.planKey}>ของที่ควรหา</Text>
          {(activeVariant?.gear ?? preset.gear).map((t, i) => <Text key={i} style={styles.planItem}>• {t}</Text>)}
          <View style={styles.planDivider} />
          <Text style={styles.planKey}>การ์ด</Text>
          {(activeVariant?.cards ?? preset.cards).map((t, i) => <Text key={i} style={styles.planItem}>• {t}</Text>)}
          {!build.job && <Text style={styles.planHint}>เลือกอาชีพด้านบนเพื่อดูแผนของสายนั้นโดยเฉพาะ</Text>}
        </View>

        {/* equipment — fixed 10 slots */}
        <Text style={styles.sectionTitle}>อุปกรณ์</Text>
        {/* RO-style equipment grid: square slot cells with quality-framed icons */}
        <View style={styles.equipGrid}>
          {SLOTS.map((s) => {
            const sl = getSlot(s.key);
            const it = sl.item;
            const q = it ? qualityInfo(it.quality) : null;
            const url = it ? resolveIconUrl(it, iconPaths) : null;
            const locked = s.key === "offhand" && weaponTwoHanded;
            return (
              <View key={s.key} style={styles.slotCell}>
                <Text style={styles.slotCellLabel} numberOfLines={1}>{slotLabel(s, locale)}</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={locked}
                  onPress={() => setPicker({ kind: "item", slot: s.key })}
                  style={[styles.slotBox, q && { borderColor: q.color }, locked && styles.slotLocked]}
                >
                  {locked ? (
                    <Text style={styles.slotLockedText}>2มือ</Text>
                  ) : url ? (
                    <Image source={{ uri: url }} style={styles.slotIcon} resizeMode="contain" />
                  ) : (
                    <Text style={styles.slotPlus}>＋</Text>
                  )}
                  {!!it && it.reqLevel != null && (
                    <View style={styles.levelBadge}><Text style={styles.levelBadgeText}>{it.reqLevel}</Text></View>
                  )}
                  {!!it && sl.refine > 0 && (
                    <View style={styles.refineBadge}><Text style={styles.refineBadgeText}>+{sl.refine}</Text></View>
                  )}
                  {!!it && (
                    <TouchableOpacity style={styles.slotClear} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      onPress={() => clearSlot(s.key)}><Text style={styles.slotClearText}>×</Text></TouchableOpacity>
                  )}
                </TouchableOpacity>
                {it ? (
                  <>
                    <Text style={[styles.slotName, q && { color: q.color }]} numberOfLines={1}>{it.title}</Text>
                    <View style={styles.refineRow}>
                      <TouchableOpacity style={styles.rfBtnSm} onPress={() => setRefine(s.key, -1)}><Text style={styles.rfBtnText}>−</Text></TouchableOpacity>
                      <Text style={styles.refineRowText}>+{sl.refine}</Text>
                      <TouchableOpacity style={styles.rfBtnSm} onPress={() => setRefine(s.key, 1)}><Text style={styles.rfBtnText}>+</Text></TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <Text style={styles.slotNameEmpty} numberOfLines={1}>{locked ? "ล็อก" : "ว่าง"}</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* total stats */}
        <Text style={styles.sectionTitle}>ค่าสถานะ</Text>
        <View style={styles.statBox}>
          {/* base stats only (STR..LUK) as "base + bonus"; gear combat stats
              like P.DEF/ATK/Max HP belong in the ค่ารบ section, not here */}
          {BASE_STATS.map((k, i) => {
            const base = build.stats[k] || 0;
            const bonus = Math.round(((totals[k] || base) - base) * 100) / 100;
            return (
              <View key={k} style={[styles.statRow, i % 2 === 1 && styles.statRowAlt]}>
                <Text style={styles.statLabel}>{k}</Text>
                <Text style={styles.statValue}>
                  {base}
                  {bonus > 0 && <Text style={styles.statBonus}> + {bonus}</Text>}
                </Text>
              </View>
            );
          })}
        </View>

        {/* derived combat stats */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>ค่ารบ</Text>
          <Text style={styles.tuneNote}>≈ ปรับสูตรให้ตรงเกมได้</Text>
        </View>
        <View style={styles.statBox}>
          {COMBAT_ROWS.map(([k, label], i) => (
            <View key={k} style={[styles.statRow, i % 2 === 1 && styles.statRowAlt]}>
              <Text style={styles.statLabel}>{label}</Text>
              <Text style={styles.statValue}>{combat[k]}</Text>
            </View>
          ))}
        </View>

        {/* stat allocation */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>ลงสเตตัส</Text>
          <Text style={[styles.pointsLeft, remaining < 0 && { color: "#E06C6C" }]}>เหลือ {remaining} / {totalPoints}</Text>
        </View>
        <Text style={styles.recHint}>
          แนะนำสำหรับ {activeVariant ? activeVariant.name : preset.role} ที่ Lv.{build.level} — ตัวเลขทองคือค่าที่ควรอัพถึง
        </Text>
        <View style={styles.statBox}>
          {BASE_STATS.map((k, i) => {
            const v = build.stats[k];
            const cost = costToRaise(v);
            const canAdd = remaining >= cost;
            const rec = recStats[k] || 1;
            const below = v < rec;
            return (
              <View key={k} style={[styles.allocRow, i % 2 === 1 && styles.statRowAlt]}>
                <Text style={styles.allocLabel}>{k}</Text>
                <TextInput
                  key={k + "-" + v}
                  defaultValue={String(v)}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  returnKeyType="done"
                  maxLength={3}
                  style={[styles.allocValue, styles.allocInput, below && { color: "#E8B339" }]}
                  onEndEditing={(e) => setStatValue(k, Number(e.nativeEvent.text))}
                  onSubmitEditing={(e) => setStatValue(k, Number(e.nativeEvent.text))}
                />
                <Text style={styles.allocBonus}>+ {Math.round(((totals[k] || v) - v) * 100) / 100}</Text>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.allocRec}>
                    แนะนำ <Text style={{ color: "#E8B339" }}>{rec}</Text>{below ? "  ▲ ควรอัพ" : v > rec ? "  เกิน" : "  ✓"}
                  </Text>
                  <Text style={styles.allocCost}>cost {cost}</Text>
                </View>
                <TouchableOpacity disabled={v <= 1} onPress={() => addStat(k, -1)} style={[styles.stepBtn, v <= 1 && styles.stepDisabled]}><Text style={styles.stepText}>−</Text></TouchableOpacity>
                <TouchableOpacity disabled={!canAdd} onPress={() => addStat(k, 1)} style={[styles.stepBtn, styles.stepAdd, !canAdd && styles.stepDisabled, below && canAdd && styles.stepAddRec]}><Text style={[styles.stepText, styles.stepAddText]}>＋</Text></TouchableOpacity>
              </View>
            );
          })}
        </View>
        <TouchableOpacity style={styles.fillRecBtn} onPress={applyPlan}>
          <Text style={styles.fillRecText}>เติมสเตตัสตามแนะนำ (Lv.{build.level})</Text>
        </TouchableOpacity>

        {/* cards per equipped item */}
        <Text style={styles.sectionTitle}>การ์ดที่สวมใส่</Text>
        {equippedSlots.length === 0 ? (
          <Text style={styles.empty}>ใส่อุปกรณ์ก่อนถึงจะใส่การ์ดได้</Text>
        ) : equippedSlots.map((s) => {
          const sl = getSlot(s.key);
          return (
            <View key={s.key} style={styles.cardGroup}>
              <View style={styles.cardGroupHead}>
                <Text style={styles.cardGroupName} numberOfLines={1}>{sl.item!.title}</Text>
                {sl.cards.length >= MAX_CARDS ? (
                  <View style={[styles.addBtn, styles.addBtnFull]}><Text style={styles.addText}>เต็ม {sl.cards.length}/{MAX_CARDS}</Text></View>
                ) : (
                  <TouchableOpacity style={styles.addBtn} onPress={() => setPicker({ kind: "card", slot: s.key })}>
                    <Text style={styles.addText}>+ การ์ด ({sl.cards.length}/{MAX_CARDS})</Text>
                  </TouchableOpacity>
                )}
              </View>
              {sl.cards.length === 0 ? <Text style={styles.cardEmpty}>ยังไม่มีการ์ด</Text>
                : sl.cards.map((c, i) => {
                  const qi = qualityInfo(c.quality);
                  return (
                    <View key={String(c.id) + "-" + i} style={styles.cardRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.cardName, qi && { color: qi.color }]} numberOfLines={1}>{c.title}</Text>
                        {!!(c.effects && c.effects.length) && (
                          <Text style={styles.cardEffect} numberOfLines={3}>{c.effects.join(" · ")}</Text>
                        )}
                      </View>
                      <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => removeCard(s.key, i)}><Text style={styles.clear}>×</Text></TouchableOpacity>
                    </View>
                  );
                })}
            </View>
          );
        })}
      </ScrollView>

      {picker && picker.kind === "item" && picker.slot && (
        <PickerModal title="เลือกอุปกรณ์" items={pickerSlotItems(picker.slot)} iconPaths={iconPaths}
          onPick={(it) => equip(picker.slot!, it)} onClose={() => setPicker(null)} />
      )}
      {picker && picker.kind === "card" && picker.slot && (
        <PickerModal title="เลือกการ์ด" items={cardsForSlot(picker.slot)} iconPaths={iconPaths}
          onPick={(c) => { addCard(picker.slot!, c); setPicker(null); }} onClose={() => setPicker(null)} />
      )}
      {picker && picker.kind === "class" && (
        <ClassModal jobs={jobs} iconPaths={iconPaths} onPick={(j) => {
          // picking a class now auto-pours points into that class's recommended
          // spread (uses the line's first sub-build, matching variantIdx=0).
          const p = pickPreset(j.title || "");
          const vs = pickVariants(j.title || "");
          const plan = vs[0] ? { ...p, statOrder: vs[0].statOrder, targets: { ...p.targets, ...vs[0].targets } } : p;
          setBuild((b) => ({ ...b, job: j, stats: planAllocate(b.level, plan) }));
          setPicker(null);
        }} onClose={() => setPicker(null)} />
      )}
      {picker && picker.kind === "skillplan" && (
        <SkillPlanner locale={locale} iconPaths={iconPaths} initialJobName={build.job?.title}
          boostKeywords={activeVariant?.skillBoost} avoidKeywords={avoidKeywords} autoApply
          patk={Math.max(combat.patkM, combat.patkR)} matk={combat.matk} onClose={() => setPicker(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8F2FD" },
  center: { alignItems: "center", justifyContent: "center" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  screenTitle: { color: "#41506B", fontSize: 20, fontWeight: "bold" },
  topBtn: { backgroundColor: "#FFFFFF", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, marginLeft: 6, borderWidth: 1, borderColor: "#DCE6F4" },
  topBtnOff: { opacity: 0.4 },
  topBtnText: { color: "#5566C7", fontSize: 12, fontWeight: "bold" },

  levelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12, borderWidth: 1, borderColor: "#DCE6F4" },
  levelLabel: { color: "#6E83E8", fontSize: 14, fontWeight: "bold" },
  levelCtrl: { flexDirection: "row", alignItems: "center" },
  lvBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#EAF1FB", alignItems: "center", justifyContent: "center" },
  lvBtnText: { color: "#6E83E8", fontSize: 20, fontWeight: "bold", lineHeight: 22 },
  lvInput: { color: "#41506B", fontSize: 17, fontWeight: "bold", textAlign: "center", minWidth: 44, marginHorizontal: 4 },
  lvMax: { color: "#8A97AD", fontSize: 13, fontWeight: "bold", marginRight: 6 },

  classRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8, borderWidth: 1, borderColor: "#DCE6F4" },
  classLabel: { color: "#8A97AD", fontSize: 12, fontWeight: "bold", marginRight: 12 },
  classValue: { color: "#41506B", fontSize: 15, fontWeight: "bold", flex: 1 },
  chev: { color: "#8A97AD", fontSize: 14 },

  sectionTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", marginTop: 18, marginBottom: 8, backgroundColor: "#6E83E8", alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, overflow: "hidden" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pointsLeft: { color: "#5566C7", fontSize: 14, fontWeight: "bold" },
  tuneNote: { color: "#8A97AD", fontSize: 10, fontWeight: "bold" },

  planBtn: { backgroundColor: "#6E83E8", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  planBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "bold" },
  planBox: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#DCE6F4" },
  planLine: { flexDirection: "row", alignItems: "flex-start" },
  planKey: { color: "#5566C7", fontSize: 12, fontWeight: "bold", marginBottom: 4, marginRight: 8 },
  chipWrap: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
  chip: { backgroundColor: "#EEF3FB", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginRight: 5, marginBottom: 5 },
  buildChip: { backgroundColor: "#EEF3FB", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6, borderWidth: 1, borderColor: "#DCE6F4" },
  buildChipOn: { backgroundColor: "#6E83E8", borderColor: "#6E83E8" },
  buildChipText: { color: "#5A6781", fontSize: 12, fontWeight: "bold" },
  buildChipTextOn: { color: "#FFFFFF" },
  chipText: { color: "#5A6781", fontSize: 11, fontWeight: "bold" },
  planDivider: { height: 1, backgroundColor: "#E6EDF7", marginVertical: 8 },
  planItem: { color: "#5A6781", fontSize: 12, lineHeight: 18, marginBottom: 1 },
  planHint: { color: "#8A97AD", fontSize: 11, marginTop: 8, fontStyle: "italic" },
  planMini: { color: "#8A97AD", fontSize: 10, marginTop: 4 },
  skPlanOpen: { marginTop: 10, backgroundColor: "#EEF3FB", borderRadius: 10, paddingVertical: 9, alignItems: "center", borderWidth: 1, borderColor: "#C9D6EE" },
  skPlanOpenText: { color: "#5566C7", fontSize: 13, fontWeight: "bold" },

  spBudget: { color: "#5566C7", fontSize: 15, fontWeight: "bold" },
  jobSelectBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#EAF1FB", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  jobSelectText: { color: "#41506B", fontSize: 15, fontWeight: "bold", flex: 1 },
  skRecBtn: { backgroundColor: "#6E83E8", borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 8 },
  skRecText: { color: "#FFFFFF", fontSize: 13, fontWeight: "bold" },
  skJobSection: { marginBottom: 14 },
  skJobHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  skJobName: { color: "#41506B", fontSize: 15, fontWeight: "bold" },
  skJobPts: { color: "#8A97AD", fontSize: 13, fontWeight: "bold" },
  skLockNote: { color: "#8A97AD", fontSize: 11, marginBottom: 6, fontStyle: "italic" },
  skGrid: { flexDirection: "row", flexWrap: "wrap" },
  skNode: { width: "25%", alignItems: "center", paddingVertical: 6, paddingHorizontal: 2 },
  skIconBox: { width: 46, height: 46, borderRadius: 10, backgroundColor: "#EAF1FB", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#DCE6F4" },
  skIconActive: { borderColor: "#6E83E8", borderWidth: 2 },
  skIcon: { width: 34, height: 34 },
  skLvl: { position: "absolute", bottom: 1, right: 3, color: "#5566C7", fontSize: 9, fontWeight: "bold" },
  skName: { color: "#5A6781", fontSize: 10, fontWeight: "bold", textAlign: "center", marginTop: 3, height: 26 },
  skCtrl: { flexDirection: "row", marginTop: 2 },
  skBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#EAF1FB", alignItems: "center", justifyContent: "center", marginHorizontal: 1, borderWidth: 1, borderColor: "#DCE6F4" },
  skBtnAdd: { backgroundColor: "#6E83E8", borderColor: "#6E83E8" },
  skBtnText: { color: "#5A6781", fontSize: 12, fontWeight: "bold", lineHeight: 14 },
  skDetail: { backgroundColor: "#F1F6FC", borderRadius: 10, padding: 12, marginTop: 8 },
  skDpsRow: { backgroundColor: "#EAF0FF", borderRadius: 8, padding: 8, marginVertical: 6 },
  skDpsMain: { color: "#5566C7", fontSize: 15, fontWeight: "800" },
  skDpsSub: { color: "#8A97AD", fontSize: 11, fontWeight: "600", marginTop: 2 },
  skDetailName: { color: "#5566C7", fontSize: 13, fontWeight: "bold", marginBottom: 4 },
  skDetailDes: { color: "#5A6781", fontSize: 12, lineHeight: 18 },

  equipRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#16181D", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 7 },
  equipSlot: { color: "#6B7079", fontSize: 11, fontWeight: "bold", width: 70 },
  equipMain: { flex: 1, flexDirection: "row", alignItems: "center" },
  iconBox: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#EAF1FB", alignItems: "center", justifyContent: "center", marginRight: 8 },
  icon28: { width: 28, height: 28 },
  iconFallback: { backgroundColor: "#E3EAF5", borderRadius: 6 },
  tier: { borderWidth: 1, borderColor: "#3A3F48", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginRight: 6 },
  tierText: { color: "#8A8F99", fontSize: 9, fontWeight: "bold" },
  equipName: { color: "#F2F3F5", fontSize: 14, fontWeight: "bold", flex: 1 },
  equipEmpty: { color: "#4A4F57", fontSize: 14, fontWeight: "bold" },
  equipLocked: { opacity: 0.55 },
  lockedText: { color: "#6B7079", fontSize: 12, fontWeight: "bold", flex: 1 },
  twoHBadge: { backgroundColor: "#2A2F38", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6 },
  twoHText: { color: "#9AA0AA", fontSize: 9, fontWeight: "bold" },
  refineCtrl: { flexDirection: "row", alignItems: "center" },
  rfBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#EAF1FB", alignItems: "center", justifyContent: "center" },
  rfBtnText: { color: "#5566C7", fontSize: 15, fontWeight: "bold", lineHeight: 16 },
  rfText: { color: "#5566C7", fontSize: 13, fontWeight: "bold", minWidth: 30, textAlign: "center" },
  clear: { color: "#E0564E", fontSize: 20, fontWeight: "normal", lineHeight: 22, marginLeft: 8 },

  // RO-style equipment grid
  equipGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 2 },
  slotCell: { width: "31.5%", alignItems: "center", marginBottom: 14 },
  slotCellLabel: { color: "#8A8F99", fontSize: 10, fontWeight: "bold", marginBottom: 3 },
  slotBox: {
    width: "100%", aspectRatio: 1, borderRadius: 14, borderWidth: 2, borderColor: "#C9D6EE",
    backgroundColor: "#FBFDFF", alignItems: "center", justifyContent: "center",
    shadowColor: "#9DB4E0", shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  slotIcon: { width: "78%", height: "78%" },
  slotPlus: { color: "#B7C6E2", fontSize: 28, fontWeight: "bold" },
  slotLocked: { opacity: 0.6, borderStyle: "dashed" },
  slotLockedText: { color: "#8A97AD", fontSize: 11, fontWeight: "bold" },
  // level badge top-right (like the game), refine badge bottom-left (red)
  levelBadge: { position: "absolute", top: 3, right: 3, backgroundColor: "#FFFFFF", borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 0, borderWidth: 1, borderColor: "#C9D6EE" },
  levelBadgeText: { color: "#5566C7", fontSize: 11, fontWeight: "800" },
  refineBadge: { position: "absolute", bottom: 3, left: 3, backgroundColor: "#E0564E", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 0 },
  refineBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  slotClear: { position: "absolute", top: 1, left: 4 },
  slotClearText: { color: "#E0564E", fontSize: 15, fontWeight: "bold" },
  slotName: { color: "#41506B", fontSize: 11, fontWeight: "bold", marginTop: 4, maxWidth: "100%" },
  slotNameEmpty: { color: "#A6B2C7", fontSize: 11, marginTop: 4 },
  refineRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  rfBtnSm: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#EAF1FB", alignItems: "center", justifyContent: "center" },
  refineRowText: { color: "#5566C7", fontSize: 11, fontWeight: "bold", minWidth: 26, textAlign: "center" },

  statBox: { backgroundColor: "#FFFFFF", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#DCE6F4" },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10 },
  statRowAlt: { backgroundColor: "#F1F6FC" },
  statLabel: { color: "#5A6781", fontSize: 14, fontWeight: "bold" },
  statValue: { color: "#5566C7", fontSize: 15, fontWeight: "bold" },
  statBonus: { color: "#2FAE73", fontSize: 15, fontWeight: "bold" },

  allocRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 9 },
  allocRec: { color: "#8A97AD", fontSize: 11, fontWeight: "bold" },
  recHint: { color: "#8A97AD", fontSize: 11, marginBottom: 8, fontStyle: "italic" },
  stepAddRec: { shadowColor: "#6E83E8", shadowOpacity: 0.9, shadowRadius: 6, elevation: 4 },
  fillRecBtn: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#6E83E8", borderRadius: 10, paddingVertical: 11, alignItems: "center", marginTop: 8 },
  fillRecText: { color: "#5566C7", fontSize: 13, fontWeight: "bold" },
  allocLabel: { color: "#41506B", fontSize: 14, fontWeight: "bold", width: 46 },
  allocValue: { color: "#41506B", fontSize: 18, fontWeight: "bold", width: 44, textAlign: "center" },
  allocInput: { backgroundColor: "#F1F6FC", borderRadius: 8, borderWidth: 1, borderColor: "#DCE6F4", paddingVertical: 4 },
  allocBonus: { color: "#2FAE73", fontSize: 14, fontWeight: "bold", marginLeft: 6, minWidth: 34 },
  allocCost: { color: "#8A97AD", fontSize: 11, fontWeight: "bold", flex: 1, marginLeft: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#EAF1FB", alignItems: "center", justifyContent: "center", marginLeft: 8 },
  stepAdd: { backgroundColor: "#6E83E8" },
  stepDisabled: { opacity: 0.3 },
  stepText: { color: "#5A6781", fontSize: 19, fontWeight: "bold", lineHeight: 20 },
  stepAddText: { color: "#FFFFFF" },

  cardGroup: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#DCE6F4" },
  cardGroupHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardGroupName: { color: "#41506B", fontSize: 14, fontWeight: "bold", flex: 1, marginRight: 8 },
  addBtn: { borderWidth: 1, borderStyle: "dashed", borderColor: "#9DB4E0", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  addBtnFull: { borderStyle: "solid", borderColor: "#DCE6F4", backgroundColor: "#F1F6FC" },
  addText: { color: "#5566C7", fontSize: 12, fontWeight: "bold" },
  cardEmpty: { color: "#A6B2C7", fontSize: 12 },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  cardName: { color: "#5A6781", fontSize: 13, fontWeight: "bold", flex: 1, marginRight: 8 },
  cardEffect: { color: "#8A97AD", fontSize: 11, marginTop: 2, lineHeight: 15 },

  search: { backgroundColor: "#F1F6FC", color: "#41506B", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, borderWidth: 1, borderColor: "#DCE6F4" },
  pickerFilterRow: { flexDirection: "row", flexWrap: "wrap", paddingVertical: 8 },
  pf: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginRight: 6, marginBottom: 6, borderWidth: 1, borderColor: "#C9D6EE", backgroundColor: "#F1F6FC" },
  pfOn: { backgroundColor: "#6E83E8", borderColor: "#6E83E8" },
  pfText: { color: "#5A6781", fontSize: 12, fontWeight: "bold", lineHeight: 17 },
  pfTextOn: { color: "#FFFFFF" },
  empty: { color: "#8A97AD", textAlign: "center", marginVertical: 12 },
  error: { color: "#E0564E", marginBottom: 12, textAlign: "center" },
  retry: { backgroundColor: "#6E83E8", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: "#FFFFFF", fontWeight: "bold" },

  modalBg: { flex: 1, backgroundColor: "rgba(40,60,100,0.45)" },
  modalCard: { backgroundColor: "#F4F8FE", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 20, maxHeight: "85%" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#C9D6EE", alignSelf: "center", marginTop: 10, marginBottom: 14 },
  modalTitle: { color: "#41506B", fontSize: 18, fontWeight: "bold", marginBottom: 12 },
  pickRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9 },
  pickName: { color: "#41506B", fontSize: 15, fontWeight: "bold" },
  pickStats: { color: "#8A97AD", fontSize: 12, marginTop: 2 },
  lvBadge: { backgroundColor: "#EAF1FB", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 6, borderWidth: 1, borderColor: "#DCE6F4" },
  lvBadgeText: { color: "#5566C7", fontSize: 10, fontWeight: "bold" },
  jobCell: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, padding: 10, margin: 4, borderWidth: 1, borderColor: "#DCE6F4" },
  jobName: { color: "#41506B", fontSize: 13, fontWeight: "bold", flex: 1 },
  closeBtn: { backgroundColor: "#6E83E8", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 8 },
  closeText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
});
