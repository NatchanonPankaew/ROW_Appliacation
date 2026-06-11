import React, { useEffect, useMemo, useState, useCallback } from "react";
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
const MAX_LEVEL = 120;
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
  { key: "accessory", labels: { "th-TH": "เครื่องประดับ", "en-US": "Accessory", "zh-TW": "飾品" }, aliases: ["飾品", "เครื่องประดับ", "accessory"] },
];
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
 *  DERIVED COMBAT STATS (Max HP/SP, ATK, MATK, DEF, MDEF, Flee, Hit, Crit, ASPD)
 *  ---------------------------------------------------------------------------
 *  The numbers below are EDITABLE defaults using standard Ragnarok-style
 *  formulas. To make a class match the game exactly, read the values in-game
 *  (strip gear, one target level, add stats one at a time) and replace the
 *  constants here — start with JOB_CURVE / COEF, then add a JOB_OVERRIDE.
 * ========================================================================== */
type Combat = {
  maxHP: number; maxSP: number; atk: number; matk: number;
  def: number; mdef: number; flee: number; hit: number; crit: number; aspd: number;
};

// Max HP/SP at 0 VIT/INT = base + perLevel*(level-1).  (linear placeholder)
const JOB_CURVE = { hpBase: 40, hpPerLevel: 80, spBase: 11, spPerLevel: 6 };
// per-class overrides — fill from in-game readings, match by name keyword
const JOB_OVERRIDES: { match: string[]; hpBase?: number; hpPerLevel?: number; spBase?: number; spPerLevel?: number }[] = [
  // e.g. { match: ["royal guard", "รอยัล"], hpBase: 0, hpPerLevel: 0, spBase: 0, spPerLevel: 0 },
];
// stat -> derived coefficients (editable)
const COEF = {
  vitHpPct: 1,     // each VIT: +1% Max HP
  intSpPct: 1,     // each INT: +1% Max SP
  strAtk: 1,       // each STR: +ATK
  dexAtkPer5: 1,   // each 5 DEX: +ATK
  intMatk: 1,      // each INT: +MATK (plus quadratic below)
  vitDef: 0.5,     // each VIT: +DEF
  intMdef: 0.5,    // each INT: +MDEF
  agiFlee: 1,      // each AGI: +Flee (plus level)
  dexHit: 1,       // each DEX: +Hit (plus level)
  lukCrit: 0.3,    // each LUK: +Crit
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
  { key: "maxHP", kw: ["max hp", "maxhp", "hp สูงสุด", "พลังชีวิตสูงสุด", "生命上限", "體力上限", "hp上限"] },
  { key: "maxSP", kw: ["max sp", "maxsp", "sp สูงสุด", "พลังเวทสูงสุด", "魔法上限", "sp上限"] },
  { key: "atk",   kw: ["atk", "พลังโจมตี", "攻擊", "攻击"] },
  { key: "matk",  kw: ["matk", "magic atk", "พลังเวท", "魔法攻擊", "魔法攻击"] },
  { key: "def",   kw: ["def", "ป้องกัน", "防禦", "防御"] },
  { key: "mdef",  kw: ["mdef", "ป้องกันเวท", "魔法防禦", "魔法防御"] },
  { key: "flee",  kw: ["flee", "หลบ", "回避"] },
  { key: "hit",   kw: ["hit", "แม่นยำ", "命中"] },
  { key: "crit",  kw: ["crit", "คริ", "暴擊", "暴击"] },
  { key: "aspd",  kw: ["aspd", "ความเร็วโจมตี", "攻速"] },
];
function flatCombatFromGear(totals: Record<string, number>): Partial<Combat> {
  const out: Partial<Combat> = {};
  for (const k of Object.keys(totals)) {
    if (BASE_STATS.includes(k.toUpperCase())) continue; // never treat base stats as combat
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

  const baseHP = c.hpBase + c.hpPerLevel * (lvl - 1);
  const baseSP = c.spBase + c.spPerLevel * (lvl - 1);
  const maxHP = Math.floor(baseHP * (1 + (vit * COEF.vitHpPct) / 100)) + (g.maxHP || 0);
  const maxSP = Math.floor(baseSP * (1 + (intl * COEF.intSpPct) / 100)) + (g.maxSP || 0);
  const atk = Math.floor(str * COEF.strAtk + Math.floor(dex / 5) * COEF.dexAtkPer5) + (g.atk || 0);
  const matk = Math.floor(intl * COEF.intMatk + Math.pow(Math.floor(intl / 7), 2)) + (g.matk || 0);
  const def = Math.floor(vit * COEF.vitDef) + (g.def || 0);
  const mdef = Math.floor(intl * COEF.intMdef) + (g.mdef || 0);
  const flee = lvl + Math.floor(agi * COEF.agiFlee) + (g.flee || 0);
  const hit = lvl + Math.floor(dex * COEF.dexHit) + (g.hit || 0);
  const crit = Math.floor(luk * COEF.lukCrit) + 1 + (g.crit || 0);
  const aspd = 150 + (g.aspd || 0); // placeholder — ASPD needs weapon/job table
  return { maxHP, maxSP, atk, matk, def, mdef, flee, hit, crit, aspd };
}

const COMBAT_ROWS: [keyof Combat, string][] = [
  ["maxHP", "Max HP"], ["maxSP", "Max SP"],
  ["atk", "ATK"], ["matk", "MATK"],
  ["def", "DEF"], ["mdef", "MDEF"],
  ["hit", "Hit"], ["flee", "Flee"],
  ["crit", "Crit"], ["aspd", "ASPD"],
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
    statOrder: ["DEX", "AGI", "LUK", "INT", "VIT"],
    targets: { DEX: 120, AGI: 90, LUK: 60 },
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

// Spend all available points following the preset's stat order (respecting cost).
function planAllocate(level: number, preset: Preset): Record<string, number> {
  const stats = freshStats();
  let pts = pointsForLevel(level);
  const spend = (k: string, cap: number) => {
    while (stats[k] < cap) {
      const c = costToRaise(stats[k]);
      if (pts < c) return;
      stats[k] += 1; pts -= c;
    }
  };
  for (const k of preset.statOrder) spend(k, preset.targets?.[k] ?? 120);
  // leftover points: top up in the same order up to 120
  for (const k of preset.statOrder) spend(k, 120);
  return stats;
}

/* ---- sub-builds per class line (e.g. Sniper: ADL / Falcon / Trap) ----
 * Each variant tweaks the stat order AND boosts skills whose name matches
 * skillBoost keywords (Thai + English, best-effort). Editable. */
type Variant = { name: string; statOrder: string[]; targets?: Record<string, number>; skillBoost: string[] };
const VARIANT_SETS: { match: string[]; variants: Variant[] }[] = [
  {
    // Archer / Hunter / Sniper / Ranger line
    match: ["archer", "อาเชอร์", "hunter", "ฮันเตอร์", "sniper", "สไนเปอร์", "ranger", "เรนเจอร์"],
    variants: [
      { name: "ADL (ออโต้)", statOrder: ["DEX", "AGI", "LUK", "VIT", "INT"], targets: { DEX: 120, AGI: 110, LUK: 90 },
        skillBoost: ["strafe", "double", "arrow", "true sight", "concentration", "owl", "vulture", "sharp", "สเตรฟ", "ลูกศร", "แม่นยำ"] },
      { name: "สายนก (Falcon)", statOrder: ["DEX", "LUK", "AGI", "INT", "VIT"], targets: { DEX: 110, LUK: 120, AGI: 80 },
        skillBoost: ["falcon", "blitz", "เหยี่ยว", "นก", "beat", "assault"] },
      { name: "สายกับดัก (Trap)", statOrder: ["DEX", "INT", "VIT", "AGI", "LUK"], targets: { DEX: 110, INT: 90, VIT: 80 },
        skillBoost: ["trap", "กับดัก", "claymore", "blast", "land mine", "sandman", "ankle", "freezing", "flasher", "ทราป"] },
    ],
  },
  {
    // Swordman / Knight / Lord Knight / Rune Knight
    match: ["knight", "ไนท์", "rune", "รูน", "lord knight", "ลอร์ด"],
    variants: [
      { name: "สายหอก (Pierce/Spiral)", statOrder: ["STR", "DEX", "VIT", "AGI"], targets: { STR: 120, DEX: 90, VIT: 90 },
        skillBoost: ["spear", "pierce", "spiral", "หอก", "แทง", "brandish"] },
      { name: "สายดาบ 2 มือ", statOrder: ["STR", "DEX", "AGI", "VIT"], targets: { STR: 120, AGI: 90, DEX: 80 },
        skillBoost: ["bowling", "bash", "two-hand", "sword", "ดาบ", "ฟัน", "magnum"] },
    ],
  },
  {
    // Crusader / Paladin / Royal Guard
    match: ["crusader", "ครูเสด", "paladin", "พาลาดิน", "royal", "รอยัล"],
    variants: [
      { name: "แทงค์ (Shield)", statOrder: ["VIT", "STR", "DEX", "INT"], targets: { VIT: 120, STR: 90 },
        skillBoost: ["shield", "defending", "provoke", "guard", "โล่", "ป้องกัน", "shield chain", "overbrand"] },
      { name: "Grand Cross", statOrder: ["VIT", "INT", "STR", "DEX"], targets: { VIT: 110, INT: 90, STR: 80 },
        skillBoost: ["grand cross", "holy", "cross", "กางเขน", "ศักดิ์สิทธิ์"] },
    ],
  },
  {
    // Mage / Wizard / High Wizard / Warlock
    match: ["mage", "เมจ", "wizard", "วิซ", "warlock", "วอร์ล็อก"],
    variants: [
      { name: "สายไฟ/หิน (Meteor)", statOrder: ["INT", "DEX", "VIT", "LUK"], targets: { INT: 120, DEX: 90 },
        skillBoost: ["meteor", "fire", "earth", "heaven", "ไฟ", "อุกกาบาต"] },
      { name: "สายน้ำแข็ง/สายฟ้า", statOrder: ["INT", "DEX", "VIT", "LUK"], targets: { INT: 120, DEX: 99 },
        skillBoost: ["storm", "jupitel", "frost", "cold", "lightning", "vermilion", "สายฟ้า", "น้ำแข็ง"] },
      { name: "สายบอลต์ (Bolt)", statOrder: ["INT", "DEX", "VIT", "LUK"], targets: { INT: 120, DEX: 80 },
        skillBoost: ["bolt", "soul", "napalm", "โบลต์"] },
    ],
  },
  {
    // Acolyte / Priest / Monk lines
    match: ["priest", "พรีสต์", "bishop", "บิชอป", "acolyte", "อโคไลท์"],
    variants: [
      { name: "ซัพพอร์ต (Full Support)", statOrder: ["INT", "DEX", "VIT", "LUK"], targets: { INT: 120, DEX: 90, VIT: 80 },
        skillBoost: ["heal", "bless", "agi", "sanctuary", "kyrie", "ฮีล", "พร", "อวยพร"] },
      { name: "สายตีอนเดด (Turn Undead)", statOrder: ["INT", "DEX", "VIT", "LUK"], targets: { INT: 120, DEX: 99 },
        skillBoost: ["undead", "magnus", "holy light", "judex", "อนเดด", "ศักดิ์สิทธิ์"] },
    ],
  },
  {
    match: ["monk", "มังค์", "sura", "ซูระ", "champion"],
    variants: [
      { name: "อสุระ (Asura)", statOrder: ["STR", "INT", "DEX", "VIT"], targets: { STR: 110, INT: 90, DEX: 80 },
        skillBoost: ["asura", "spirit", "fury", "อสุระ", "ตะวัน"] },
      { name: "คอมโบ (Combo)", statOrder: ["STR", "AGI", "DEX", "VIT"], targets: { STR: 110, AGI: 90, DEX: 80 },
        skillBoost: ["combo", "fist", "investigate", "chain", "หมัด", "คอมโบ"] },
    ],
  },
  {
    match: ["assassin", "แอสซาซิน", "cross", "guillotine", "กิโยติน"],
    variants: [
      { name: "Sonic Blow (กะตาร์)", statOrder: ["STR", "AGI", "DEX", "LUK"], targets: { STR: 110, AGI: 110, DEX: 80 },
        skillBoost: ["sonic", "katar", "cloak", "grimtooth", "ซอนิค", "กะตาร์"] },
      { name: "สายพิษ/คริ (Crit)", statOrder: ["AGI", "LUK", "STR", "DEX"], targets: { AGI: 120, LUK: 100, STR: 80 },
        skillBoost: ["venom", "poison", "crit", "พิษ", "คริ", "katar"] },
    ],
  },
  {
    match: ["gunslinger", "ปืน", "rebel", "rebellion", "night walker"],
    variants: [
      { name: "Rapid/Desperado", statOrder: ["DEX", "AGI", "LUK", "VIT"], targets: { DEX: 120, AGI: 100 },
        skillBoost: ["rapid", "desperado", "bullet", "gatling", "rain", "กระสุน"] },
      { name: "คริ/Single (Crit)", statOrder: ["DEX", "LUK", "AGI", "VIT"], targets: { DEX: 110, LUK: 110 },
        skillBoost: ["single", "tracking", "crit", "snipe", "คริ"] },
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerFilterRow} keyboardShouldPersistTaps="handled">
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
            </ScrollView>
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
                    <Text style={[styles.pickName, qi && { color: qi.color }]} numberOfLines={1}>{item.title}</Text>
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

/* ---- real skill planner (loads the live skill tree per job) ---- */
function SkillPlanner({ locale, iconPaths, initialJobName, boostKeywords, onClose }: {
  locale: string; iconPaths: IconPaths | null; initialJobName?: string; boostKeywords?: string[]; onClose: () => void;
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
        const n = initialJobName.toLowerCase();
        const hit = Object.values(idx).find((j) => j.name.toLowerCase() === n && jobPathHasSkills(idx, j.id));
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
      // score: damage actives in the latest job first
      type Item = { kindId: string; nat: number; score: number };
      const items: Item[] = [];
      path.forEach((jid, tier) => {
        (jobSkills[jid] || []).forEach((s) => {
          const dmg = !!s.levels && Object.values(s.levels).some((lv: any) => {
            const a = Number(lv?.pve_percent), b = Number(lv?.pve_flat);
            return (Number.isFinite(a) && a !== 0) || (Number.isFinite(b) && b !== 0);
          });
          let score = s.passive ? (dmg ? 50 : 30) : dmg ? 100 : 70;
          score += tier * 6;
          const nm = s.name.toLowerCase();
          if (boostKeywords && boostKeywords.some((k) => nm.includes(k.toLowerCase()))) score += 300;
          items.push({ kindId: s.kindId, nat: s.naturalMax, score });
        });
      });
      items.sort((a, b) => b.score - a.score);
      let progress = true, passes = 0;
      while (progress && passes++ < 25) {
        progress = false;
        for (const it of items) {
          let guard = 0;
          while ((next[it.kindId] || 0) < it.nat && guard++ < 50) {
            if (tryAddOne(it.kindId)) progress = true; else break;
          }
        }
      }
      return next;
    });
    setSel(null);
  };

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
              <Text style={styles.skRecText}>✦ แนะนำสกิลให้ (เน้นดาเมจ)</Text>
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
  const totalKeys = useMemo(() => Object.keys(totals).sort(), [totals]);
  const combat = useMemo(() => computeCombat(build, totals), [build, totals]);
  const preset = useMemo(() => pickPreset(build.job?.title || ""), [build.job]);
  const jobMeta = build.job ? skillMeta[(build.job.title || "").toLowerCase()] : undefined;
  const variants = useMemo(() => pickVariants(build.job?.title || ""), [build.job]);
  const [variantIdx, setVariantIdx] = useState(0);
  useEffect(() => { setVariantIdx(0); }, [build.job]);
  const activeVariant = variants[variantIdx];
  const applyPlan = () => {
    const p = activeVariant
      ? { ...preset, statOrder: activeVariant.statOrder, targets: { ...preset.targets, ...activeVariant.targets } }
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

  // items to show in the slot picker: matching slot, filtered by the selected class
  const pickerSlotItems = (k?: string): NormItem[] => {
    if (!k) return [];
    let m = bySlot[k] || [];
    if (m.length === 0) m = equipment;            // fallback if slot mapping missed
    const jid = build.job ? Number(build.job.id) : null;
    if (jid != null) {
      const hasJobInfo = m.some((it) => it.jobAll || (it.jobLimits && it.jobLimits.length));
      if (hasJobInfo) m = m.filter((it) => it.jobAll || (it.jobLimits || []).includes(jid));
    }
    return m;
  };

  // cards selectable for a slot: only cards whose type matches (weapon card -> weapon, ...)
  const cardsForSlot = (k?: string): NormItem[] => {
    if (!k) return cards;
    const f = cards.filter((c) => c.slotKey === k);
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
              {preset.statOrder.map((k, i) => (
                <View key={k} style={styles.chip}>
                  <Text style={styles.chipText}>{i + 1}. {k}{preset.targets?.[k] ? " " + preset.targets[k] : ""}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.planDivider} />
          {jobMeta && !!jobMeta.path && (
            <>
              <Text style={styles.planKey}>เส้นทางอาชีพ</Text>
              <Text style={styles.planItem}>{jobMeta.path}</Text>
              {jobMeta.points > 0 && <Text style={styles.planItem}>สกิลพอยต์รวม: {jobMeta.points}</Text>}
              <View style={styles.planDivider} />
            </>
          )}
          <Text style={styles.planKey}>สกิล (แนวทาง)</Text>
          {preset.skills.map((t, i) => <Text key={i} style={styles.planItem}>• {t}</Text>)}
          <TouchableOpacity style={styles.skPlanOpen} onPress={() => setPicker({ kind: "skillplan" })}>
            <Text style={styles.skPlanOpenText}>เปิด Skill Planner (สกิลจริง) ▸</Text>
          </TouchableOpacity>
          <View style={styles.planDivider} />
          <Text style={styles.planKey}>ของที่ควรหา</Text>
          {preset.gear.map((t, i) => <Text key={i} style={styles.planItem}>• {t}</Text>)}
          <View style={styles.planDivider} />
          <Text style={styles.planKey}>การ์ด</Text>
          {preset.cards.map((t, i) => <Text key={i} style={styles.planItem}>• {t}</Text>)}
          {!build.job && <Text style={styles.planHint}>เลือกอาชีพด้านบนเพื่อดูแผนของสายนั้นโดยเฉพาะ</Text>}
        </View>

        {/* equipment — fixed 10 slots */}
        <Text style={styles.sectionTitle}>อุปกรณ์</Text>
        {SLOTS.map((s) => {
          const sl = getSlot(s.key);
          const it = sl.item;
          const q = it ? qualityInfo(it.quality) : null;
          const url = it ? resolveIconUrl(it, iconPaths) : null;
          const lockedByTwoH = s.key === "offhand" && weaponTwoHanded;
          if (lockedByTwoH) {
            return (
              <View key={s.key} style={[styles.equipRow, styles.equipLocked]}>
                <Text style={styles.equipSlot}>{slotLabel(s, locale)}</Text>
                <View style={[styles.iconBox, styles.iconFallback]} />
                <Text style={styles.lockedText}>ใช้อาวุธ 2 มือ</Text>
              </View>
            );
          }
          return (
            <View key={s.key} style={styles.equipRow}>
              <Text style={styles.equipSlot}>{slotLabel(s, locale)}</Text>
              <TouchableOpacity style={styles.equipMain} activeOpacity={0.7} onPress={() => setPicker({ kind: "item", slot: s.key })}>
                <View style={[styles.iconBox, q && { borderColor: q.color, borderWidth: 1.5 }]}>
                  {url ? <Image source={{ uri: url }} style={styles.icon28} resizeMode="contain" /> : <View style={[styles.icon28, styles.iconFallback]} />}
                </View>
                <View style={{ flex: 1 }}>
                  {it ? (
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      {!!qRoman(it.quality) && (
                        <View style={[styles.tier, q && { borderColor: q.color }]}><Text style={[styles.tierText, q && { color: q.color }]}>{qRoman(it.quality)}</Text></View>
                      )}
                      <Text style={[styles.equipName, q && { color: q.color }]} numberOfLines={1}>{it.title}</Text>
                      {it.twoHanded && <View style={styles.twoHBadge}><Text style={styles.twoHText}>2มือ</Text></View>}
                    </View>
                  ) : <Text style={styles.equipEmpty}>+ เลือกอุปกรณ์</Text>}
                </View>
              </TouchableOpacity>
              {it ? (
                <View style={styles.refineCtrl}>
                  <TouchableOpacity style={styles.rfBtn} onPress={() => setRefine(s.key, -1)}><Text style={styles.rfBtnText}>−</Text></TouchableOpacity>
                  <Text style={styles.rfText}>+{sl.refine}</Text>
                  <TouchableOpacity style={styles.rfBtn} onPress={() => setRefine(s.key, 1)}><Text style={styles.rfBtnText}>+</Text></TouchableOpacity>
                  <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => clearSlot(s.key)}><Text style={styles.clear}>×</Text></TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })}

        {/* total stats */}
        <Text style={styles.sectionTitle}>ค่าสถานะ</Text>
        <View style={styles.statBox}>
          {totalKeys.length === 0 ? (
            <Text style={[styles.empty, { padding: 14 }]}>ใส่ของ/การ์ด หรือลงสเตตัสเพื่อดูค่ารวม</Text>
          ) : totalKeys.map((k, i) => (
            <View key={k} style={[styles.statRow, i % 2 === 1 && styles.statRowAlt]}>
              <Text style={styles.statLabel}>{k.toUpperCase()}</Text>
              <Text style={styles.statValue}>{totals[k]}</Text>
            </View>
          ))}
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
        <View style={styles.statBox}>
          {BASE_STATS.map((k, i) => {
            const v = build.stats[k];
            const cost = costToRaise(v);
            const canAdd = remaining >= cost;
            return (
              <View key={k} style={[styles.allocRow, i % 2 === 1 && styles.statRowAlt]}>
                <Text style={styles.allocLabel}>{k}</Text>
                <Text style={styles.allocValue}>{v}</Text>
                <Text style={styles.allocCost}>cost {cost}</Text>
                <TouchableOpacity disabled={v <= 1} onPress={() => addStat(k, -1)} style={[styles.stepBtn, v <= 1 && styles.stepDisabled]}><Text style={styles.stepText}>−</Text></TouchableOpacity>
                <TouchableOpacity disabled={!canAdd} onPress={() => addStat(k, 1)} style={[styles.stepBtn, styles.stepAdd, !canAdd && styles.stepDisabled]}><Text style={[styles.stepText, styles.stepAddText]}>＋</Text></TouchableOpacity>
              </View>
            );
          })}
        </View>

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
        <ClassModal jobs={jobs} iconPaths={iconPaths} onPick={(j) => { setBuild((b) => ({ ...b, job: j })); setPicker(null); }} onClose={() => setPicker(null)} />
      )}
      {picker && picker.kind === "skillplan" && (
        <SkillPlanner locale={locale} iconPaths={iconPaths} initialJobName={build.job?.title}
          boostKeywords={activeVariant?.skillBoost} onClose={() => setPicker(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0F12" },
  center: { alignItems: "center", justifyContent: "center" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  screenTitle: { color: "#F2F3F5", fontSize: 20, fontWeight: "800" },
  topBtn: { backgroundColor: "#16181D", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, marginLeft: 6 },
  topBtnOff: { opacity: 0.4 },
  topBtnText: { color: "#C7CBD1", fontSize: 12, fontWeight: "700" },

  levelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#16181D", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12 },
  levelLabel: { color: "#E8B339", fontSize: 14, fontWeight: "800" },
  levelCtrl: { flexDirection: "row", alignItems: "center" },
  lvBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#0E0F12", alignItems: "center", justifyContent: "center" },
  lvBtnText: { color: "#E8B339", fontSize: 20, fontWeight: "800", lineHeight: 22 },
  lvInput: { color: "#F2F3F5", fontSize: 17, fontWeight: "800", textAlign: "center", minWidth: 44, marginHorizontal: 4 },
  lvMax: { color: "#6B7079", fontSize: 13, fontWeight: "700", marginRight: 6 },

  classRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#16181D", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8 },
  classLabel: { color: "#6B7079", fontSize: 12, fontWeight: "700", marginRight: 12 },
  classValue: { color: "#F2F3F5", fontSize: 15, fontWeight: "800", flex: 1 },
  chev: { color: "#8A8F99", fontSize: 14 },

  sectionTitle: { color: "#E8B339", fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pointsLeft: { color: "#E8B339", fontSize: 14, fontWeight: "800" },
  tuneNote: { color: "#6B7079", fontSize: 10, fontWeight: "700" },

  planBtn: { backgroundColor: "#E8B339", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  planBtnText: { color: "#0E0F12", fontSize: 12, fontWeight: "800" },
  planBox: { backgroundColor: "#16181D", borderRadius: 12, padding: 12 },
  planLine: { flexDirection: "row", alignItems: "flex-start" },
  planKey: { color: "#E8B339", fontSize: 12, fontWeight: "800", marginBottom: 4, marginRight: 8 },
  chipWrap: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
  chip: { backgroundColor: "#0E0F12", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginRight: 5, marginBottom: 5 },
  buildChip: { backgroundColor: "#0E0F12", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6, borderWidth: 1, borderColor: "#3A3F48" },
  buildChipOn: { backgroundColor: "#E8B339", borderColor: "#E8B339" },
  buildChipText: { color: "#C7CBD1", fontSize: 12, fontWeight: "800" },
  buildChipTextOn: { color: "#0E0F12" },
  chipText: { color: "#C7CBD1", fontSize: 11, fontWeight: "800" },
  planDivider: { height: 1, backgroundColor: "#23262D", marginVertical: 8 },
  planItem: { color: "#C7CBD1", fontSize: 12, lineHeight: 18, marginBottom: 1 },
  planHint: { color: "#6B7079", fontSize: 11, marginTop: 8, fontStyle: "italic" },
  skPlanOpen: { marginTop: 10, backgroundColor: "#0E0F12", borderRadius: 8, paddingVertical: 9, alignItems: "center", borderWidth: 1, borderColor: "#3A3F48" },
  skPlanOpenText: { color: "#E8B339", fontSize: 13, fontWeight: "800" },

  spBudget: { color: "#E8B339", fontSize: 15, fontWeight: "800" },
  jobSelectBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#0E0F12", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  jobSelectText: { color: "#F2F3F5", fontSize: 15, fontWeight: "800", flex: 1 },
  skRecBtn: { backgroundColor: "#E8B339", borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 8 },
  skRecText: { color: "#0E0F12", fontSize: 13, fontWeight: "800" },
  skJobSection: { marginBottom: 14 },
  skJobHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  skJobName: { color: "#F2F3F5", fontSize: 15, fontWeight: "800" },
  skJobPts: { color: "#8A8F99", fontSize: 13, fontWeight: "800" },
  skLockNote: { color: "#6B7079", fontSize: 11, marginBottom: 6, fontStyle: "italic" },
  skGrid: { flexDirection: "row", flexWrap: "wrap" },
  skNode: { width: "25%", alignItems: "center", paddingVertical: 6, paddingHorizontal: 2 },
  skIconBox: { width: 46, height: 46, borderRadius: 10, backgroundColor: "#0E0F12", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#23262D" },
  skIconActive: { borderColor: "#E8B339" },
  skIcon: { width: 34, height: 34 },
  skLvl: { position: "absolute", bottom: 1, right: 3, color: "#C7CBD1", fontSize: 9, fontWeight: "800" },
  skName: { color: "#C7CBD1", fontSize: 10, fontWeight: "700", textAlign: "center", marginTop: 3, height: 26 },
  skCtrl: { flexDirection: "row", marginTop: 2 },
  skBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#0E0F12", alignItems: "center", justifyContent: "center", marginHorizontal: 1, borderWidth: 1, borderColor: "#23262D" },
  skBtnAdd: { backgroundColor: "#E8B339", borderColor: "#E8B339" },
  skBtnText: { color: "#C7CBD1", fontSize: 12, fontWeight: "800", lineHeight: 14 },
  skDetail: { backgroundColor: "#0E0F12", borderRadius: 10, padding: 12, marginTop: 8 },
  skDetailName: { color: "#E8B339", fontSize: 13, fontWeight: "800", marginBottom: 4 },
  skDetailDes: { color: "#C7CBD1", fontSize: 12, lineHeight: 18 },

  equipRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#16181D", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 7 },
  equipSlot: { color: "#6B7079", fontSize: 11, fontWeight: "700", width: 70 },
  equipMain: { flex: 1, flexDirection: "row", alignItems: "center" },
  iconBox: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#0E0F12", alignItems: "center", justifyContent: "center", marginRight: 8 },
  icon28: { width: 28, height: 28 },
  iconFallback: { backgroundColor: "#23262D", borderRadius: 6 },
  tier: { borderWidth: 1, borderColor: "#3A3F48", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginRight: 6 },
  tierText: { color: "#8A8F99", fontSize: 9, fontWeight: "800" },
  equipName: { color: "#F2F3F5", fontSize: 14, fontWeight: "700", flex: 1 },
  equipEmpty: { color: "#4A4F57", fontSize: 14, fontWeight: "600" },
  equipLocked: { opacity: 0.55 },
  lockedText: { color: "#6B7079", fontSize: 12, fontWeight: "700", flex: 1 },
  twoHBadge: { backgroundColor: "#2A2F38", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6 },
  twoHText: { color: "#9AA0AA", fontSize: 9, fontWeight: "800" },
  refineCtrl: { flexDirection: "row", alignItems: "center" },
  rfBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#0E0F12", alignItems: "center", justifyContent: "center" },
  rfBtnText: { color: "#E8B339", fontSize: 15, fontWeight: "800", lineHeight: 16 },
  rfText: { color: "#E8B339", fontSize: 13, fontWeight: "800", minWidth: 30, textAlign: "center" },
  clear: { color: "#E06C6C", fontSize: 20, fontWeight: "300", lineHeight: 22, marginLeft: 8 },

  statBox: { backgroundColor: "#16181D", borderRadius: 12, overflow: "hidden" },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10 },
  statRowAlt: { backgroundColor: "#121419" },
  statLabel: { color: "#8A8F99", fontSize: 14, fontWeight: "600" },
  statValue: { color: "#F2F3F5", fontSize: 15, fontWeight: "800" },

  allocRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 9 },
  allocLabel: { color: "#C7CBD1", fontSize: 14, fontWeight: "800", width: 46 },
  allocValue: { color: "#F2F3F5", fontSize: 18, fontWeight: "800", width: 44, textAlign: "center" },
  allocCost: { color: "#6B7079", fontSize: 11, fontWeight: "700", flex: 1, marginLeft: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#0E0F12", alignItems: "center", justifyContent: "center", marginLeft: 8 },
  stepAdd: { backgroundColor: "#E8B339" },
  stepDisabled: { opacity: 0.3 },
  stepText: { color: "#C7CBD1", fontSize: 19, fontWeight: "800", lineHeight: 20 },
  stepAddText: { color: "#0E0F12" },

  cardGroup: { backgroundColor: "#16181D", borderRadius: 12, padding: 10, marginBottom: 8 },
  cardGroupHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardGroupName: { color: "#F2F3F5", fontSize: 14, fontWeight: "800", flex: 1, marginRight: 8 },
  addBtn: { borderWidth: 1, borderStyle: "dashed", borderColor: "#3A3F48", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  addBtnFull: { borderStyle: "solid", borderColor: "#23262D", backgroundColor: "#121419" },
  addText: { color: "#C7CBD1", fontSize: 12, fontWeight: "700" },
  cardEmpty: { color: "#4A4F57", fontSize: 12 },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  cardName: { color: "#C7CBD1", fontSize: 13, fontWeight: "700", flex: 1, marginRight: 8 },
  cardEffect: { color: "#8A8F99", fontSize: 11, marginTop: 2, lineHeight: 15 },

  search: { backgroundColor: "#0E0F12", color: "#F2F3F5", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15 },
  pickerFilterRow: { paddingVertical: 8, alignItems: "center" },
  pf: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginRight: 6, borderWidth: 1, borderColor: "#3A3F48", backgroundColor: "#0E0F12" },
  pfOn: { backgroundColor: "#C7CBD1", borderColor: "#C7CBD1" },
  pfText: { color: "#C7CBD1", fontSize: 12, fontWeight: "800" },
  pfTextOn: { color: "#0E0F12" },
  empty: { color: "#6B7079", textAlign: "center", marginVertical: 12 },
  error: { color: "#E06C6C", marginBottom: 12, textAlign: "center" },
  retry: { backgroundColor: "#E8B339", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: "#0E0F12", fontWeight: "800" },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  modalCard: { backgroundColor: "#16181D", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 20, maxHeight: "85%" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#3A3F48", alignSelf: "center", marginTop: 10, marginBottom: 14 },
  modalTitle: { color: "#F2F3F5", fontSize: 18, fontWeight: "800", marginBottom: 12 },
  pickRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9 },
  pickName: { color: "#F2F3F5", fontSize: 15, fontWeight: "700" },
  pickStats: { color: "#8A8F99", fontSize: 12, marginTop: 2 },
  jobCell: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#0E0F12", borderRadius: 10, padding: 10, margin: 4 },
  jobName: { color: "#F2F3F5", fontSize: 13, fontWeight: "700", flex: 1 },
  closeBtn: { backgroundColor: "#E8B339", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 8 },
  closeText: { color: "#0E0F12", fontSize: 16, fontWeight: "800" },
});
