// Taiwan's pet library is ahead of SEA's — it already has 3 pets SEA lacks
// (32 vs 29): Fels (14336104), Aegir (14336201), Flora (14336302). None of
// them have an official EN/TH name anywhere upstream yet (even TW's own root
// en-US/th-TH pet files show raw Chinese for these 3 ids), so the names below
// are a best-effort transliteration/theme match, not verified official ones —
// same caveat as EN_NAME in merge-tw-cards.mjs. Aegir is the Norse sea god
// (fits the water-shield pet); Flora fits the flower/withering-themed kit;
// Fels is a plain phonetic read of 菲爾斯.
//
// Only th-TH for now (see merge-tw-cards.mjs re: no verified EN pass yet).
// Numeric fields (attrs, battleStats, cooldowns, level thresholds) are pulled
// live from TW and are locale-independent, so they auto-refresh on re-run;
// only text (names/descriptions/labels) is hand-translated here. Run after
// sync-data fetches the SEA pet file. Idempotent.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://roworlddb.com";
const DATA = fileURLToPath(new URL("../public/data/sea/pet/data/", import.meta.url));
const FILE = { "th-TH": "pet_library_th-TH.json" };

const PET_IDS = [14336104, 14336201, 14336302];

const PET_NAME_TH = {
  14336104: "Fels",
  14336201: "Aegir",
  14336302: "Flora",
};

// Owner-bonus buff skill name (levels[].skill.name), constant per pet.
const OWNER_SKILL_NAME_TH = {
  14336104: "อรุณมังกร", // 龍族破曉
  14336201: "พรของเอจีร์", // 埃吉爾加護
  14336302: "พรของฟลอรา", // 芙蘿加護
};

// attrs[].id -> Thai display name, matching the site's existing convention
// (verified against every other pet already in pet_library_th-TH.json).
const ATTR_NAME_TH = {
  21: "HP",
  23: "HP สูงสุด%",
  28: "Atk",
  31: "M.ATK",
  151: "เพิ่มดาเมจต่อทุกธาตุ %",
  322: "เพิ่มดาเมจ PVP%",
  323: "ลดดาเมจ PVP%",
  370: "สัตว์เลี้ยงออกรบ%",
};

// Favorability level titles (level 0-20) — identical across every pet in
// this dataset, copied verbatim from the existing th-TH entries.
const TITLES_TH = [
  "สายใยแรกพบⅠ", "สายใยแรกพบⅡ", "สายใยแรกพบⅢ",
  "คนรู้จักⅠ", "คนรู้จักⅡ", "คนรู้จักⅢ",
  "เริ่มรู้สึกดีⅠ", "เริ่มรู้สึกดีⅡ", "เริ่มรู้สึกดีⅢ",
  "ใจหวั่นไหวⅠ", "ใจหวั่นไหวⅡ", "ใจหวั่นไหวⅢ",
  "ความไว้วางใจⅠ", "ความไว้วางใจⅡ", "ความไว้วางใจⅢ",
  "ผูกพันลึกซึ้งⅠ", "ผูกพันลึกซึ้งⅡ", "ผูกพันลึกซึ้งⅢ",
  "สื่อใจถึงกันⅠ", "สื่อใจถึงกันⅡ", "สื่อใจถึงกันⅢ",
];

const QUALITY_TH = {
  quality: 6, name: "ตำนาน", tag: "SSR",
  icon: "icon_pet_quality_new_6",
  iconUrl: "/media/images/pet/icon_pet_quality_new_6.webp",
};

const TYPE_LABEL_TH = { "普攻": "โจมตีปกติ", "主動": "สกิลใช้งาน", "被動": "สกิลติดตัว" };
const ELEMENT_TH = { "風屬性": "ธาตุ Wind", "水屬性": "ธาตุ Water", "無屬性": "ธาตุ Neutral", "": "" };
const DESNAME_TH = { "傷害": "ดาเมจ", "輔助": "ซัพพอร์ต" };

// Hand-translated combat-skill name/description, keyed by kindId then level.
// Numbers are baked into the Thai text (matching TW's current values) since
// the source description is prose, not a template — same tradeoff merge-tw-
// cards.mjs makes for card effect text.
const COMBAT_TEXT = {
  // --- Fels (wind) ---
  9610401: { 1: { name: "โจมตีปกติ", desc: "สร้างดาเมจเวทธาตุ Wind แก่เป้าหมายเดี่ยว<color=#C6810D>100%</color>" } },
  9610402: {
    1: { name: "พายุสายฟ้า", desc: "รวมพลังพายุเป็นเวลา 3 วิ โจมตีด้วยสายฟ้าใส่ศัตรูในระยะ 8 เมตรรอบตัวทุกวินาที สร้างดาเมจเวทธาตุ Wind <color=#C6810D>700%</color> พร้อมมีโอกาส <color=#C6810D>30%</color> ทำให้เป้าหมายมึนงง 0.5 วิ" },
    2: { name: "พายุสายฟ้า", desc: "รวมพลังพายุเป็นเวลา 5 วิ โจมตีด้วยสายฟ้าใส่ศัตรูในระยะ 8 เมตรรอบตัวทุกวินาที สร้างดาเมจเวทธาตุ Wind <color=#C6810D>750%</color> พร้อมมีโอกาส <color=#C6810D>30%</color> ทำให้เป้าหมายมึนงง 0.5 วิ ระหว่างพายุยังคงอยู่ ASPD ของ Fels เพิ่มขึ้น <color=#C6810D>50%</color>" },
    3: { name: "พายุสายฟ้า", desc: "รวมพลังพายุเป็นเวลา 5 วิ โจมตีด้วยสายฟ้าใส่ศัตรูในระยะ 8 เมตรรอบตัวทุกวินาที สร้างดาเมจเวทธาตุ Wind <color=#C6810D>800%</color> พร้อมมีโอกาส <color=#C6810D>30%</color> ทำให้เป้าหมายมึนงง 0.5 วิ ระหว่างพายุยังคงอยู่ ASPD ของ Fels เพิ่มขึ้น <color=#C6810D>50%</color> ดาเมจที่ Fels และเจ้านายสร้างเพิ่มขึ้น <color=#C6810D>20%</color>" },
  },
  9610403: {
    1: { name: "สายฟ้าลูกโซ่", desc: "การโจมตีจะมาพร้อมสายฟ้าลูกโซ่ สร้างดาเมจเวทธาตุ Wind <color=#C6810D>50%</color> กระเด้งไปยังศัตรูตัวอื่นได้สูงสุด <color=#C6810D>4</color> ครั้ง" },
    2: { name: "สายฟ้าลูกโซ่", desc: "การโจมตีจะมาพร้อมสายฟ้าลูกโซ่ สร้างดาเมจเวทธาตุ Wind <color=#C6810D>65%</color> กระเด้งไปยังศัตรูตัวอื่นได้สูงสุด <color=#C6810D>5</color> ครั้ง เมื่อสายฟ้าสร้างดาเมจมีโอกาส <color=#C6810D>30%</color> ทำให้เป้าหมายรับดาเมจเพิ่มขึ้น (Vulnerable) เป็นเวลา 4 วิ" },
    3: { name: "สายฟ้าลูกโซ่", desc: "การโจมตีจะมาพร้อมสายฟ้าลูกโซ่ สร้างดาเมจเวทธาตุ Wind <color=#C6810D>80%</color> กระเด้งไปยังศัตรูได้สูงสุด <color=#C6810D>6</color> ครั้ง และสามารถกระเด้งซ้ำเป้าหมายเดิมได้ เมื่อสายฟ้าสร้างดาเมจมีโอกาส <color=#C6810D>30%</color> ทำให้เป้าหมายรับดาเมจเพิ่มขึ้น (Vulnerable) เป็นเวลา 4 วิ" },
  },
  // --- Aegir (water) ---
  9620101: { 1: { name: "โจมตีปกติ", desc: "สร้างดาเมจกายภาพระยะประชิดธาตุ Water <color=#C6810D>100%</color> แก่เป้าหมาย" } },
  9620102: {
    1: { name: "พิทักษ์สมุทรลึก", desc: "เอจีร์มอบโล่ให้เจ้านายเทียบเท่า HP ของตนเอง <color=#C6810D>100%</color> + HP ของเจ้านาย <color=#C6810D>10%</color> เป็นเวลา 8 วิ เมื่อโล่แตก เจ้านายจะได้รับดาเมจลดลง <color=#C6810D>40%</color> เป็นเวลา 3 วิ" },
    2: { name: "พิทักษ์สมุทรลึก", desc: "เอจีร์มอบโล่ให้เจ้านายเทียบเท่า HP ของตนเอง <color=#C6810D>150%</color> + HP ของเจ้านาย <color=#C6810D>15%</color> เป็นเวลา 8 วิ เมื่อโล่แตก เจ้านายจะได้รับดาเมจลดลง <color=#C6810D>50%</color> เป็นเวลา 3 วิ\nเอจีร์ยังมอบโล่ให้ตัวเองเทียบเท่า HP ของตนเอง <color=#C6810D>50%</color> และได้รับผลโล่แตกแบบเดียวกัน" },
    3: { name: "พิทักษ์สมุทรลึก", desc: "เอจีร์มอบโล่ให้เจ้านายเทียบเท่า HP ของตนเอง <color=#C6810D>200%</color> + HP ของเจ้านาย <color=#C6810D>20%</color> เป็นเวลา 10 วิ เมื่อโล่แตก เจ้านายจะได้รับดาเมจลดลง <color=#C6810D>65%</color> เป็นเวลา 3 วิ พร้อมผลักศัตรูในระยะ 4 เมตรรอบตัวออกไป สร้างดาเมจ <color=#C6810D>200%</color> ของพลังโจมตีตนเอง และลดความเร็วเคลื่อนที่ของเป้าหมาย <color=#C6810D>15%</color> เป็นเวลา 3 วิ\nเอจีร์ยังมอบโล่ให้ตัวเองเทียบเท่า HP ของตนเอง <color=#C6810D>100%</color> และได้รับผลโล่แตกแบบเดียวกัน" },
  },
  9620103: {
    1: { name: "กระแสกัดกร่อน", desc: "เมื่อเอจีร์ได้รับดาเมจ มีโอกาส <color=#C6810D>60%</color> ที่จะติดสถานะ【กระแสกัดกร่อน】ให้ผู้โจมตี 1 ชั้น ลดโบนัสดาเมจของเป้าหมายลง <color=#C6810D>3%</color> เป็นเวลา 6 วิ ซ้อนทับได้สูงสุด 4 ชั้น" },
    2: { name: "กระแสกัดกร่อน", desc: "เมื่อเอจีร์ได้รับดาเมจ มีโอกาส <color=#C6810D>80%</color> ที่จะติดสถานะ【กระแสกัดกร่อน】ให้ผู้โจมตี 1 ชั้น ลดโบนัสดาเมจของเป้าหมายลง <color=#C6810D>4%</color> เป็นเวลา 6 วิ ซ้อนทับได้สูงสุด 4 ชั้น เมื่อ【กระแสกัดกร่อน】ซ้อนครบ 4 ชั้น เอจีร์จะพุ่งกัดเป้าหมาย ลดความเร็วโจมตีของเป้าหมาย <color=#C6810D>25%</color> เป็นเวลา 5 วิ คูลดาวน์ 15 วิ" },
    3: { name: "กระแสกัดกร่อน", desc: "เมื่อเอจีร์ได้รับดาเมจ มีโอกาส <color=#C6810D>100%</color> ที่จะติดสถานะ【กระแสกัดกร่อน】ให้ผู้โจมตี 1 ชั้น ลดโบนัสดาเมจของเป้าหมายลง <color=#C6810D>5%</color> เป็นเวลา 6 วิ ซ้อนทับได้สูงสุด 4 ชั้น เมื่อ【กระแสกัดกร่อน】ซ้อนครบ 4 ชั้น เอจีร์จะพุ่งกัดเป้าหมาย ลดความเร็วโจมตี <color=#C6810D>40%</color> และเพิ่มดาเมจต่อทุกธาตุที่ได้รับ <color=#C6810D>25%</color> ของเป้าหมาย เป็นเวลา 5 วิ คูลดาวน์ 15 วิ" },
  },
  // --- Flora (neutral) ---
  9630201: { 1: { name: "โจมตีปกติ", desc: "สร้าง M.DMG ระยะไกลธาตุ Neutral <color=#C6810D>100%</color> แก่เป้าหมาย" } },
  9630202: {
    1: { name: "เงามายาดอกไม้", desc: "ฟลอราเข้าสิงเจ้านายเป็นเวลา 6 วิ ระหว่างเข้าสิง จะมอบโล่ที่ไม่สามารถถูกขจัดได้เทียบเท่า <color=#C6810D>600%*M.ATK</color> ให้เจ้านาย และเพิ่มพลังโจมตีกายภาพและเวทของเจ้านาย <color=#C6810D>16%</color>\nระหว่างเข้าสิง ฟลอราจะไม่ได้รับดาเมจ และยังสามารถโจมตีปกติได้" },
    2: { name: "เงามายาดอกไม้", desc: "ฟลอราเข้าสิงเจ้านายเป็นเวลา 6 วิ ระหว่างเข้าสิง จะมอบโล่ที่ไม่สามารถถูกขจัดได้เทียบเท่า <color=#C6810D>900%*M.ATK</color> ให้เจ้านาย และเพิ่มพลังโจมตีกายภาพและเวทของเจ้านาย <color=#C6810D>20%</color> เมื่อเข้าสิงจะล้างสถานะผิดปกติทั้งหมดของเจ้านายทันที และเพิ่มความเร็วเคลื่อนที่ <color=#C6810D>20%</color> เป็นเวลา 3 วิ\nระหว่างเข้าสิง ฟลอราจะไม่ได้รับดาเมจ และยังสามารถโจมตีปกติได้" },
    3: { name: "เงามายาดอกไม้", desc: "ฟลอราเข้าสิงเจ้านายเป็นเวลา 8 วิ ระหว่างเข้าสิง จะมอบโล่ที่ไม่สามารถถูกขจัดได้เทียบเท่า <color=#C6810D>1200%*M.ATK</color> ให้เจ้านาย และเพิ่มพลังโจมตีกายภาพและเวทของเจ้านาย <color=#C6810D>24%</color> เมื่อเข้าสิงจะล้างสถานะผิดปกติทั้งหมดของเจ้านายทันที และเพิ่มความเร็วเคลื่อนที่ <color=#C6810D>20%</color> เป็นเวลา 3 วิ เมื่อสิ้นสุดการเข้าสิง จะฟื้นฟู <color=#C6810D>25%</color> ของ Max HP ให้เจ้านาย\nระหว่างเข้าสิง ฟลอราจะไม่ได้รับดาเมจ และยังสามารถโจมตีปกติได้" },
  },
  9630203: {
    1: { name: "เหี่ยวเฉา", desc: "การโจมตีปกติของฟลอรามีโอกาส <color=#C6810D>40%</color> ที่จะติดสถานะ【เหี่ยวเฉา】ให้เป้าหมาย สร้างดาเมจธาตุ Neutral <color=#C6810D>400%</color> และลดค่าป้องกันของเป้าหมายลง <color=#C6810D>12%</color> เป็นเวลา 3 วิ" },
    2: { name: "เหี่ยวเฉา", desc: "การโจมตีปกติของฟลอรามีโอกาส <color=#C6810D>40%</color> ที่จะติดสถานะ【เหี่ยวเฉา】ให้เป้าหมาย สร้างดาเมจธาตุ Neutral <color=#C6810D>400%</color> และลดค่าป้องกันของเป้าหมายลง <color=#C6810D>12%</color> เป็นเวลา 3 วิ 【เหี่ยวเฉา】ยังลดความเร็วเคลื่อนที่และความเร็วโจมตีของเป้าหมายเพิ่มอีก <color=#C6810D>15%</color>" },
    3: { name: "เหี่ยวเฉา", desc: "การโจมตีปกติของฟลอรามีโอกาส <color=#C6810D>40%</color> ที่จะติดสถานะ【เหี่ยวเฉา】ให้เป้าหมายและหน่วยโดยรอบ สร้างดาเมจธาตุ Neutral <color=#C6810D>400%</color> และลดค่าป้องกันของเป้าหมายลง <color=#C6810D>15%</color> เป็นเวลา 3 วิ 【เหี่ยวเฉา】ยังลดความเร็วเคลื่อนที่และความเร็วโจมตีของเป้าหมายเพิ่มอีก <color=#C6810D>15%</color>" },
  },
};

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + " HTTP " + r.status);
  return r.json();
}

function describeAttrs(attrs) {
  return attrs
    .map((a) => a.name + " " + (a.value >= 0 ? "+" : "") + a.value + (a.isPercentage ? "%" : ""))
    .join(" ");
}

function localizePet(pet) {
  const name = PET_NAME_TH[pet.id];
  const ownerSkillName = OWNER_SKILL_NAME_TH[pet.id];

  const levels = pet.levels.map((lvl) => {
    const attrs = (lvl.skill.attrs || []).map((a) => ({ ...a, name: ATTR_NAME_TH[a.id] || a.name }));
    return {
      ...lvl,
      title: TITLES_TH[lvl.level],
      skill: {
        name: lvl.level === 0 ? "" : ownerSkillName,
        description: lvl.level === 0 ? "" : describeAttrs(attrs),
        attrs,
      },
    };
  });

  const combatSkills = pet.combatSkills.map((cs) => ({
    ...cs,
    typeLabel: TYPE_LABEL_TH[cs.typeLabel] || cs.typeLabel,
    unlocks: cs.unlocks.map((u) => {
      const text = COMBAT_TEXT[cs.kindId]?.[u.level];
      return {
        ...u,
        skill: {
          ...u.skill,
          name: text?.name ?? u.skill.name,
          description: text?.desc ?? u.skill.description,
          elementName: ELEMENT_TH[u.skill.elementName] ?? u.skill.elementName,
          skillTypeDesName: DESNAME_TH[u.skill.skillTypeDesName] || u.skill.skillTypeDesName,
        },
      };
    }),
  }));

  return { ...pet, name, quality: QUALITY_TH, levels, combatSkills };
}

export async function mergeTwPets() {
  const tw = await fetchJSON(ORIGIN + "/pet/data/pet_library_zh-TW.json");
  const byId = new Map(tw.pets.map((p) => [p.id, p]));
  for (const [loc, filename] of Object.entries(FILE)) {
    let sea;
    try { sea = JSON.parse(await readFile(DATA + filename, "utf8")); }
    catch { continue; }
    const have = new Set(sea.pets.map((p) => p.id));
    let added = 0, skipped = 0;
    for (const id of PET_IDS) {
      if (have.has(id)) continue;
      const p = byId.get(id);
      if (!p) { skipped++; continue; }
      sea.pets.push(localizePet(p));
      added++;
    }
    if (added) {
      sea.petCount = sea.pets.length;
      await writeFile(DATA + filename, JSON.stringify(sea));
    }
    console.log("  pets[" + loc + "]: +" + added + " TW pets (" + sea.pets.length + " total)"
      + (skipped ? ", " + skipped + " listed ids no longer on TW" : ""));
  }
}

if (import.meta.url === ("file://" + process.argv[1])) mergeTwPets();
