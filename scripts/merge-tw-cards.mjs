// Taiwan's card dataset is ahead of SEA's — it already has the Glast Heim
// patch cards (226 vs 195). Pull the TW-only cards in *surgically*: keep every
// SEA card untouched, only ADD cards SEA lacks. Card `name` fields stay in
// English everywhere (even th-TH) per this dataset's existing convention —
// only `effect`/`effect_extra`/`effect_lines` get localized. None of the new
// monsters have an official English name in monster_album yet either, so
// EN_NAME below is a best-effort name (classic Glast Heim monster where one
// clearly matches, otherwise a plain descriptive name) rather than a verified
// official one. Run after sync-data fetches the SEA card file. Idempotent.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://roworlddb.com";
const DATA = fileURLToPath(new URL("../public/data/sea/card-simulator/data/", import.meta.url));
// th-TH only for now — TH_LINES below is a hand-verified Thai translation,
// but there's no equivalent English pass yet, and shipping the raw zh-TW
// effect text into the en-US file would be worse than leaving it out.
const FILE = { "th-TH": "handbook_cards_th-TH.json" };

const CARD_TYPE_NAME = {
  20: "Headwear", 21: "Facewear", 22: "Mouthwear", 23: "Armor", 24: "Cape",
  25: "Shoes", 27: "Backwear", 28: "Accessory", 29: "Weapon", 30: "Off-Hand",
};

// id -> English card name (see file header re: confidence)
const EN_NAME = {
  12333020: "Enraged Evil Spirit Card",
  12333026: "Evil Spirit Card",
  12533001: "Dark Lord Card",
  12833030: "Wind Elemental Wizard Card",
  12833037: "Owl Baron Card",
  12933052: "Dark Priest Card",
  13033012: "Ogretooth Card",
  13033017: "Dark Acolyte Card",
  13033018: "Raydric Archer Card",
  13033020: "Injustice Card",
  13033021: "Alarm Card",
  13033022: "Ice Elemental Wizard Card",
  13033023: "Fire Elemental Wizard Card",
  13033024: "Khalitz Jester Card",
  13033025: "Tigersaur Card",
  13033026: "Stin Card",
  13033027: "Maid Alice Card",
  13033028: "Rideword Card",
  13033029: "Bat Archer Card",
  13033030: "Owl Duke Card",
  13033031: "Godslayer Card",
  13033032: "Wandering Skeleton Card",
  13033033: "Raydric Card",
  13033034: "Khalitzburg Card",
  13033035: "Escaped Zombie Card",
  13033036: "Sage Worm Card",
  13033037: "Frozen Bat Archer Card",
  13033040: "Zombie Prisoner Card",
  13033041: "Skeleton Prisoner Card",
  13033043: "Dark Illusion Card",
  13033044: "Spider Queen Card",
  13033045: "Asura Berserker Card",
  13033046: "Aesin Witch Card",
  13033047: "Rebio Card",
  13033048: "Revived Abysmal Knight Card",
  // second batch (winter/bell-tower event set) — same confidence caveat
  12833029: "Marin Card",
  12933062: "Abyss Knight Card",
  12933063: "Bloody Knight Card",
  13033049: "Witch Card",
  13033050: "Rotten Demon Card",
  13033051: "Bell Tower Guardian Card",
  13033052: "Bell Card",
  13033053: "Ancient Bell Demon Card",
  13033054: "Jouka Card",
  13033055: "Evil Spirit Warlock Card",
  13033056: "Ede Ladybug Card",
  13033057: "Great Ancient Bell Card",
  13033058: "Big Bell Card",
  13033059: "Evil Spirit Rotten Demon Card",
  13033060: "Evil Spirit Elder Card",
  13033061: "Time Keeper Card",
  13033062: "Enraged Snow Bear Card",
  13033063: "Baby Karrun Card",
  13033064: "Karrun Card",
  13033065: "Enraged Gingerbread Card",
  13033066: "Evil Gift Box Card",
  13033067: "Spirit Doll Card",
  13033068: "Green Cookie Card",
  13033069: "Toy Soldier Card",
  13033070: "Stormy Knight Card",
  13033071: "Nairy Worm Card",
  13033072: "Evil Moai Card",
  13033073: "Enraged Stalactic Golem Card",
  13033074: "Medusa Card",
  13033075: "Pest Card",
  13033076: "Tao Gunka Card",
  13033077: "Revived Chimera Card",
  13033078: "Revived Bloody Knight Card",
};

// id -> Thai effect_lines (translated to match this file's existing
// terminology exactly — see git blame / other th-TH card entries for style).
const TH_LINES = {
  12333020: ["เลี่ยงดาเมจกายภาพระยะไกล % +4.8%~8%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  12333026: ["เพิ่มดาเมจต่อเผ่า Undead % +3%~5%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  12533001: ["เฉพาะตัว: เมื่อได้รับ PHY.DMG มีโอกาส 5% ที่จะร่าย Meteor Storm Lv.5 ใส่ผู้โจมตี (เลเวลการร่ายจะเพิ่มขึ้นตามระดับสกิลที่เรียนรู้) เอฟเฟกต์นี้มีคูลดาวน์ 5s"],
  12833030: ["เมื่อสร้างดาเมจ มีโอกาส 5% ที่จะร่าย Jupitel Thunder Lv.5 ใส่ศัตรู (เลเวลการร่ายจะเพิ่มขึ้นตามระดับสกิลที่เรียนรู้) เอฟเฟกต์นี้มีคูลดาวน์ 10s", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  12833037: ["Matk +80", "เฉพาะตัว: เมื่อ SP มากกว่า 50% ขณะสร้าง M.DMG มีโอกาส 50% ที่จะใช้ SP 5% เพื่อเพิ่ม DMG 50% แต่เมื่อ SP น้อยกว่า 50% ขณะสร้าง M.DMG มีโอกาส 50% ที่จะฟื้นฟู SP 5%"],
  12933052: ["เมื่อสร้าง PHY.DMG มีโอกาส 5% ทำให้เป้าหมาย SP-1% เอฟเฟกต์นี้มีคูลดาวน์ 3s", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033012: ["เลี่ยงดาเมจกายภาพระยะประชิด % +12%~20%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033017: ["เลี่ยงดาเมจเวทมนตร์ระยะไกล % +4.8%~8%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033018: ["เพิ่มดาเมจต่อเผ่า Demon % +3%~5%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033020: ["เพิ่มดาเมจต่อธาตุ Earth % +9%~15%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033021: ["เมื่อได้รับ PHY.DMG มีโอกาส 5% ทำให้ผู้โจมตีติดสถานะกลายเป็นหิน นาน 1s เอฟเฟกต์นี้มีคูลดาวน์ 5s", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033022: ["ต้านทาน Freeze +60~100", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033023: ["M.ATK ระยะไกล% +6%~10%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033024: ["Atk +12~20", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033025: ["เมื่อได้รับ PHY.DMG มีโอกาส 5% ที่จะร่าย Angelus Lv.5 ใส่ตัวเอง (เลเวลการร่ายจะเพิ่มขึ้นตามระดับสกิลที่เรียนรู้) เอฟเฟกต์นี้มีคูลดาวน์ 20s", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033026: ["เลี่ยงดาเมจเวทมนตร์ระยะไกล % +12%~20%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033027: ["รับดาเมจจากมอนสเตอร์ -10%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033028: ["Matk +12~20", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033029: ["เพิ่มดาเมจต่อเผ่า Insect % +3%~5%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033030: ["เมื่อสร้างดาเมจ มีโอกาส 5% ที่จะร่าย Impositio Manus Lv.5 ใส่ตัวเอง เอฟเฟกต์นี้มีคูลดาวน์ 30s", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033031: ["ลดดาเมจต่อธาตุ Fire % +6%~10%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033032: ["เลี่ยงดาเมจกายภาพระยะประชิด % +4.8%~8%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033033: ["ลดดาเมจต่อธาตุ Shadow % +6%~10%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033034: ["ลดดาเมจต่อเผ่า Demon % +18%~30%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033035: ["ต้านทาน Crit +3~5", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033036: ["LUK +6~10", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033037: ["ลดดาเมจต่อขนาดใหญ่ % +12%~20%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033040: ["VIT +6~10", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033041: ["เมื่อได้รับ PHY.DMG มีโอกาส 5% ทำให้ผู้โจมตีหลับ นาน 1s เอฟเฟกต์นี้มีคูลดาวน์ 5s", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033043: ["ร่ายแบบแปรผัน % -6%~-10%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033044: ["ลดดาเมจต่อธาตุ Earth % +6%~10%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033045: ["ดาเมจกายภาพระยะประชิด % +3.6%~6%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033046: ["ดาเมจกายภาพระยะไกล % +3.6%~6%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033047: ["M.ATK ระยะไกล% +3.6%~6%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033048: ["DMG ต่อมอนสเตอร์ BOSS, MVP และ Mini +10%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  // second batch (winter/bell-tower event set)
  12833029: ["เพิ่มดาเมจต่อเผ่า Brute % +3%~5%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  12933062: ["เพิ่มดาเมจต่อเผ่า Plant % +5%", "เมื่อกำจัดมอนสเตอร์เผ่า Plant ฟื้นฟู SP 5"],
  12933063: ["เพิ่มดาเมจต่อเผ่า Plant % +5%", "เมื่อกำจัดมอนสเตอร์เผ่า Plant ฟื้นฟู SP 5"],
  13033049: ["เปลี่ยนธาตุป้องกันเป็น Shadow", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033050: ["เมื่อได้รับ PHY.DMG มีโอกาส 5% ที่จะร่าย Quagmire Lv.1 ใส่ผู้โจมตี (เลเวลการร่ายจะเพิ่มขึ้นตามระดับสกิลที่เรียนรู้) เอฟเฟกต์นี้มีคูลดาวน์ 5s", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033051: ["ร่ายแบบแปรผัน % -3%~-5%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033052: ["เฉพาะตัว: ได้รับสกิล [Fire Hunt]", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033053: ["เพิ่มดาเมจต่อเผ่า Undead % +3%~5%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033054: ["เพิ่มดาเมจต่อธาตุ Fire % +3%~5%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033055: ["ลดดาเมจต่อธาตุ Ghost % +6%~10%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033056: ["เมื่อได้รับ PHY.DMG มีโอกาส 5% ทำให้ผู้โจมตีติดสถานะใบ้ นาน 1s เอฟเฟกต์นี้มีคูลดาวน์ 5s", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033057: ["เพิ่มดาเมจต่อเผ่า Demon % +3%~5%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033058: ["เพิ่มดาเมจต่อเผ่า Formless % +3%~5%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033059: ["ลดดาเมจต่อเผ่า Undead % +18%~30%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033060: ["ลดดาเมจต่อธาตุ Holy % +6%~10%", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033061: ["เฉพาะตัว: หลังใช้สกิลไม้ตายจะรีเซ็ตคูลดาวน์ของสกิลไม้ตายทันที เอฟเฟกต์นี้มีคูลดาวน์ 180s"],
  13033062: ["DEX +3~5", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033063: ["เมื่อสร้าง PHY.DMG มีโอกาส 2% ที่จะร่าย Frost Diver Lv.3 ใส่เป้าหมาย (เลเวลการร่ายจะเพิ่มขึ้นตามระดับสกิลที่เรียนรู้) เอฟเฟกต์นี้มีคูลดาวน์ 5s", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033064: ["เฉพาะตัว: เมื่อได้รับดาเมจ มีโอกาส 50% ทำให้ผู้โจมตีติดสถานะแช่แข็ง ซึ่งไม่สนใจค่าต้านทานการควบคุมและไม่สามารถถูกแก้ไขได้ นาน 2s เอฟเฟกต์นี้มีคูลดาวน์ 4s"],
  13033065: ["INT +7~11", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033066: ["LUK +3~5", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033067: ["เมื่อสร้าง PHY.DMG มีโอกาส 2% ที่จะร่าย Heal Lv.3 ใส่ตัวเอง (เลเวลการร่ายจะเพิ่มขึ้นตามระดับสกิลที่เรียนรู้) เอฟเฟกต์นี้มีคูลดาวน์ 5s", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033068: ["DEX +7~11", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033069: ["Crit Damage% +6%~10%", "Crit+7 เมื่อสร้างดาเมจต่อเผ่า Brute", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033070: ["เฉพาะตัว: เมื่อสร้างดาเมจ มีโอกาส 5% ที่จะร่าย Storm Gust Lv.5 ใส่ศัตรู (เลเวลการร่ายจะเพิ่มขึ้นตามระดับสกิลที่เรียนรู้) เอฟเฟกต์นี้มีคูลดาวน์ 5s"],
  13033071: ["เมื่อกำจัดมอนสเตอร์ มีโอกาส 5% ฟื้นฟู SP 3% ของตัวเอง เอฟเฟกต์นี้มีคูลดาวน์ 3s", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033072: ["STR +7~11", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033073: ["VIT +3~5", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033074: ["ต้านทานกลายเป็นหิน +60~100", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033075: ["เมื่อสร้าง PHY.DMG มีโอกาส 5% ทำให้ศัตรูติดสถานะกลายเป็นหิน นาน 1s (กับผู้เล่น 0.2s) เอฟเฟกต์นี้มีคูลดาวน์ 5s", "มาพร้อมแอฟฟิกซ์สุ่มสูงสุด 2 อย่าง"],
  13033076: ["เฉพาะตัว: เมื่อ HP ต่ำกว่า 50% จะได้รับสถานะแข็งตัว ต้านทานสถานะควบคุมทั้งหมด และลดดาเมจที่ได้รับเพิ่มอีก 50% นาน 4s เอฟเฟกต์นี้มีคูลดาวน์ 75s"],
  13033077: ["เฉพาะตัว: สร้างดาเมจเพิ่ม 15% ต่อเป้าหมายที่ติดสถานะพิษหรือพิษร้ายแรง และรับดาเมจลดลง 8%"],
  13033078: ["เฉพาะตัว: เมื่อได้รับดาเมจ มีโอกาส 20% ปลดสถานะติดลบแบบสุ่ม 2 อย่างจากตัวเอง เอฟเฟกต์นี้มีคูลดาวน์ 5s"],
};

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + " HTTP " + r.status);
  return r.json();
}

function localize(card, loc) {
  const out = { ...card, card_type_name: CARD_TYPE_NAME[card.card_type_id] || card.card_type_name };
  out.name = EN_NAME[card.id] || card.name;
  if (loc === "th-TH" && TH_LINES[card.id]) {
    out.effect_lines = TH_LINES[card.id];
    out.effect = TH_LINES[card.id][0];
    out.effect_extra = TH_LINES[card.id][1] || "";
  }
  return out;
}

export async function mergeTwCards() {
  const tw = await fetchJSON(ORIGIN + "/card-simulator/data/handbook_cards_zh-TW.json");
  const byId = new Map(tw.cards.map((c) => [c.id, c]));
  for (const [loc, filename] of Object.entries(FILE)) {
    let sea;
    try { sea = JSON.parse(await readFile(DATA + filename, "utf8")); }
    catch { continue; }
    const have = new Set(sea.cards.map((c) => c.id));
    let added = 0, skipped = 0;
    // Only add cards with a hand-verified EN_NAME/TH_LINES entry above — TW
    // keeps growing ahead of this list, and silently inserting raw Chinese
    // text for anything untranslated would be worse than just waiting.
    for (const id of Object.keys(EN_NAME).map(Number)) {
      if (have.has(id)) continue;
      const c = byId.get(id);
      if (!c) { skipped++; continue; }
      sea.cards.push(localize(c, loc));
      added++;
    }
    if (added) await writeFile(DATA + filename, JSON.stringify(sea));
    console.log("  cards[" + loc + "]: +" + added + " TW cards (" + sea.cards.length + " total)"
      + (skipped ? ", " + skipped + " listed ids no longer on TW" : ""));
  }
}

if (import.meta.url === ("file://" + process.argv[1])) mergeTwCards();
