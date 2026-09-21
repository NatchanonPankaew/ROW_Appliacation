// AUTO-GENERATED data + applier. Localizes the Taiwan-sourced Sage/Scholar
// (322/323) and Rogue/Stalker (622/623) skill files into EN/TH after
// merge-tw-sage-rogue.mjs lands them (still in Chinese at that point). zh-TW
// is left as the original Traditional Chinese. § placeholders mark where each
// level's numbers go; the numbers are always read from the zh-TW file so the
// fill stays correct + idempotent. Mirrors translate-tw-skills.mjs's approach
// (kept separate since it's an independent set of jobs/skill ids).
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const DATA = fileURLToPath(new URL("../public/data/sea/skill-simulator/data/", import.meta.url));
const JOBS = [322, 323, 622, 623];
const NUM = /\d+(?:\.\d+)?/g;
const clean = (s) => String(s || "").replace(/<[^>]+>/g, "").trim();

const TRANS = {
  // --- 322 Sage ---
  "132203": {
    en: "Advanced Elemental Bolt",
    den: "Fires § elemental bolts in a row at the target, each dealing §%+§ Wind magic damage; each hit reduces Diamond Dust's cooldown by §s.",
    dth: "ยิงลูกธนูธาตุใส่เป้าหมายต่อเนื่อง §ครั้ง แต่ละครั้งสร้างดาเมจเวทธาตุลม §%+§; ทุกครั้งที่สร้างดาเมจ ลดคูลดาวน์ของเพชรพราวดาวตก §วินาที",
  },
  "132204": {
    en: "Diamond Dust",
    den: "Unleashes Diamond Dust toward the target in a rectangular area, striking § times, hitting up to § enemies each time for §%+§ Wind magic damage; each hit has a §% chance to Freeze the target for §s. Stores up to § charges.",
    dth: "ปล่อยเพชรพราวดาวตกเป็นพื้นที่สี่เหลี่ยมไปทางเป้าหมาย โจมตี §ครั้ง แต่ละครั้งโดนศัตรูในพื้นที่สูงสุด §ตัว สร้างดาเมจเวทธาตุลม §%+§; แต่ละครั้งมีโอกาส §% ทำให้ติดสถานะแช่แข็ง นาน §วินาที เก็บชาร์จได้สูงสุด §ครั้ง",
  },
  "132205": {
    en: "Water Elemental Field",
    den: "Creates a Water Elemental Field in the target area, lasting §s; within §m, up to § allies gain Water damage taken -§%, physical and magic attack +§%, and deal +§% damage to Thief and Acolyte classes. Cooldown §s.",
    dth: "สร้างสนามธาตุน้ำในพื้นที่เป้าหมาย นาน §วินาที; ในระยะ §เมตร ผู้เล่นฝ่ายเดียวกันสูงสุด §คน ได้รับการลดดาเมจธาตุน้ำ +§%, โจมตีกายภาพและเวท +§%, และสร้างดาเมจเพิ่ม +§% ใส่อาชีพจำพวกโจร (Thief) และผู้รับใช้ (Acolyte) คูลดาวน์ §วินาที",
  },
  "132206": {
    en: "Fire Elemental Field",
    den: "Creates a Fire Elemental Field in the target area, lasting §s; within §m, up to § allies gain Fire damage taken -§%, physical and magic attack +§%, and deal +§% damage to Swordsman, Merchant, and Gunslinger classes. Only § Elemental Field can exist at a time. Cooldown §s.",
    dth: "สร้างสนามธาตุไฟในพื้นที่เป้าหมาย นาน §วินาที; ในระยะ §เมตร ผู้เล่นฝ่ายเดียวกันสูงสุด §คน ได้รับการลดดาเมจธาตุไฟ +§%, โจมตีกายภาพและเวท +§%, และสร้างดาเมจเพิ่ม +§% ใส่อาชีพจำพวกนักดาบ (Swordsman), พ่อค้า (Merchant) และนักปืน (Gunslinger) มีสนามธาตุพร้อมกันได้สูงสุด §จุด คูลดาวน์ §วินาที",
  },
  "132207": {
    en: "Wind Elemental Field",
    den: "Creates a Wind Elemental Field in the target area, lasting §s; within §m, up to § allies gain Wind damage taken -§%, physical and magic attack +§%, and deal +§% damage to Mage, Druid, and Archer classes. Only § Elemental Field can exist at a time. Cooldown §s.",
    dth: "สร้างสนามธาตุลมในพื้นที่เป้าหมาย นาน §วินาที; ในระยะ §เมตร ผู้เล่นฝ่ายเดียวกันสูงสุด §คน ได้รับการลดดาเมจธาตุลม +§%, โจมตีกายภาพและเวท +§%, และสร้างดาเมจเพิ่ม +§% ใส่อาชีพจำพวกนักเวท (Mage), ดรูอิด (Druid) และนักธนู (Archer) มีสนามธาตุพร้อมกันได้สูงสุด §จุด คูลดาวน์ §วินาที",
  },
  "132208": {
    en: "Dragon Lore",
    den: "Damage dealt to Dragon-race enemies +§%, INT +§, SP recovery rate +§%.",
    dth: "เพิ่มดาเมจใส่มอนสเตอร์เผ่ามังกร +§%, เพิ่ม INT +§, เพิ่มอัตราฟื้นฟู SP +§%",
  },
  "132209": {
    en: "Magic Fist",
    den: "Replaces normal attacks with Magic Fist, splashing the target and enemies within §m (up to §) for §%+§ Wind magic damage; own ASPD +§%. After learning this skill, Advanced Elemental Bolt's hit count -§.",
    dth: "เปลี่ยนโจมตีธรรมดาเป็นหมัดเวท สาดใส่เป้าหมายและศัตรูในระยะ §เมตร สูงสุด §ตัว สร้างดาเมจเวทธาตุลม §%+§; เพิ่มความเร็วโจมตีของตัวเอง +§% เมื่อเรียนสกิลนี้ จำนวน Hit ของลูกธนูธาตุขั้นสูงจะลดลง §",
  },
  "132210": {
    en: "Elemental Aura",
    den: "Gain § stack of Elemental Energy on a normal-attack hit, or § stacks when taking attack/skill damage, stacking up to §. At max stacks, consumes all Elemental Energy to raise physical and magic damage reduction by §% for §s; during this, every §s, enemies within §m take §%+§ Wind magic damage and are Slowed §% for §s. Trigger cooldown §s.",
    dth: "เมื่อโจมตีธรรมดาโดนเป้าหมายได้รับพลังธาตุ §ชั้น หรือเมื่อโดนโจมตีหรือโดนสกิลได้รับ §ชั้น สะสมได้สูงสุด §ชั้น เมื่อครบชั้นจะใช้พลังธาตุทั้งหมดเพื่อเพิ่มการลดดาเมจกายภาพและเวท §% นาน §วินาที; ระหว่างนี้ทุก §วินาที ศัตรูในระยะ §เมตร จะได้รับดาเมจเวทธาตุลม §%+§ และเคลื่อนที่ช้าลง §% นาน §วินาที คูลดาวน์การกระตุ้น §วินาที",
  },
  "132211": {
    en: "Flammable Web",
    den: "Binds the target with a web, dealing §%+§ Wind magic damage and inflicting Immobilize for §s; also lowers the target's Fire resistance by §.",
    dth: "ใช้ใยแมงมุมพันเป้าหมาย สร้างดาเมจเวทธาตุลม §%+§ และทำให้ติดสถานะดึงติด นาน §วินาที; ลดความต้านทานธาตุไฟของเป้าหมาย §",
  },
  "132212": {
    en: "Free Cast",
    den: "Advanced Elemental Bolt can be cast while moving and attacking; variable cast time -§%.",
    dth: "ลูกธนูธาตุขั้นสูงสามารถร่ายได้ระหว่างเคลื่อนที่และโจมตี; ลดเวลาร่ายแปรผัน -§%",
  },
  "132213": {
    en: "Elemental Conversion",
    den: "When attacking with Wind-element skills, treats the target's defense element as Water; but the elemental advantage multiplier is reduced by §% against monsters and §% against players.",
    dth: "เมื่อใช้สกิลธาตุลมโจมตี จะมองธาตุป้องกันของเป้าหมายเป็นธาตุน้ำ แต่ตัวคูณความได้เปรียบธาตุลดลง §% ต่อมอนสเตอร์ และ §% ต่อผู้เล่น",
  },
  "132214": {
    en: "Lightning Step",
    den: "Dashes §m in the chosen direction at lightning speed, dealing §%+§ Wind magic damage to enemies in the path and slowing their movement speed by §% for §s; also removes your own Immobilize and Slow effects.",
    dth: "เคลื่อนที่ด้วยความเร็วสายฟ้า §เมตร ไปทางที่กำหนด สร้างดาเมจเวทธาตุลม §%+§ ให้ศัตรูตามเส้นทาง และลดความเร็วเคลื่อนที่ §% นาน §วินาที; ปลดสถานะดึงติดและเคลื่อนที่ช้าของตัวเองด้วย",
  },
  "132215": {
    en: "Storm Warp",
    den: "Teleports above the target and slams down, dealing §%+§ Wind magic damage with a §% chance to Stun the target for §s. This skill can store up to § charges, recharging every §s.",
    dth: "วาร์ปไปยังเหนือเป้าหมายแล้วทุบลงมา สร้างดาเมจเวทธาตุลม §%+§ และมีโอกาส §% ทำให้เป้าหมายมึนงง นาน §วินาที เก็บชาร์จได้สูงสุด §ครั้ง ใช้เวลาเติมชาร์จ §วินาที",
  },
  "132216": {
    en: "Double Cast",
    den: "When casting Advanced Elemental Bolt, §% chance to cast it § additional time; the extra bolt cannot trigger this effect again.",
    dth: "เมื่อร่ายลูกธนูธาตุขั้นสูง มีโอกาส §% ร่ายซ้ำเพิ่มอีก §ครั้ง; ลูกธนูธาตุที่เกิดจากการกระตุ้นนี้จะไม่กระตุ้นเอฟเฟกต์นี้ซ้ำอีก",
  },

  // --- 323 Scholar ---
  "132301": {
    en: "Magic Fist Mastery",
    den: "Magic Fist-type skill damage +§%; Elemental Aura's radius +§m.",
    dth: "เพิ่มดาเมจสกิลตระกูลหมัดเวท +§%; เพิ่มรัศมีของธาตุคลุมกาย +§เมตร",
  },
  "132302": {
    en: "Sorcerous Web",
    den: "Uses sorcerous power to evolve Flammable Web into Sorcerous Web: the number of targets increases to §, and it also lowers the targets' resistance to all elements.",
    dth: "ใช้พลังเวทมนตร์เปลี่ยนใยแมงมุมไวไฟให้เป็นใยแมงมุมมนตรา เพิ่มจำนวนเป้าหมายเป็น §ตัว และลดความต้านทานธาตุทั้งหมดของเป้าหมายด้วย",
  },
  "132303": {
    en: "Elemental Mastery",
    den: "Within §m of yourself, for every § ally present, your Wind damage dealt +§% (counting up to § allies); also removes the elemental-advantage decay from Elemental Conversion.",
    dth: "ในระยะ §เมตรรอบตัว ทุก §คนของพันธมิตรที่อยู่ จะเพิ่มดาเมจธาตุลมของตัวเอง +§% (นับสูงสุด §คน); และยกเลิกผลลดทอนตัวคูณธาตุของธาตุแปรสภาพด้วย",
  },
  "132304": {
    en: "Speed Reading",
    den: "When casting a skill, §% chance to reduce the fixed cast time of the next § cast skills by §%. This effect has a §s cooldown.",
    dth: "เมื่อร่ายสกิลมีโอกาส §% ลดเวลาร่ายคงที่ของสกิลถัดไป §ครั้ง ลง §% เอฟเฟกต์นี้มีคูลดาวน์ §วินาที",
  },
  "132305": {
    en: "Elemental Affinity",
    den: "All-element damage +§%; ignores § points of all-element resistance.",
    dth: "เพิ่มดาเมจธาตุทุกชนิด +§%; เพิกเฉยความต้านทานธาตุทุกชนิด +§",
  },
  "132306": {
    en: "Auto Spell",
    den: "When Magic Fist deals damage, §% chance to trigger Auto Spell, casting an extra Advanced Elemental Bolt at its current level § additional time; the bolt cast this way can trigger Double Cast.",
    dth: "เมื่อหมัดเวทสร้างดาเมจ มีโอกาส §% กระตุ้นร่ายอัตโนมัติ ร่ายลูกธนูธาตุขั้นสูงระดับปัจจุบันเพิ่มอีก §ครั้ง; ลูกธนูธาตุที่ร่ายด้วยวิธีนี้สามารถกระตุ้น Double Cast ได้",
  },
  "132308": {
    en: "Holy Lance",
    den: "When Advanced Elemental Bolt is cast or triggered, §% chance to trigger Holy Lance: within §m of the target, hits up to § targets for §%+§ Wind ranged magic damage. Holy Lance counts as an Elemental Bolt-type skill.",
    dth: "เมื่อร่ายหรือกระตุ้นลูกธนูธาตุขั้นสูง มีโอกาส §% กระตุ้นหอกศักดิ์สิทธิ์: ในระยะ §เมตรรอบเป้าหมาย โจมตีเป้าหมายสูงสุด §ตัว สร้างดาเมจเวทระยะไกลธาตุลม §%+§ หอกศักดิ์สิทธิ์นับเป็นสกิลตระกูลลูกธนูธาตุ",
  },
  "132310": {
    en: "Earth Elemental Field",
    den: "Creates an Earth Elemental Field in the target area, lasting §s; within §m, continuously clears enemy Spell Fields in the area, removing up to §; also grants up to § allies in the area ranged magic and physical damage immunity +§%. Only § Elemental Field can exist at a time.",
    dth: "สร้างสนามธาตุดินในพื้นที่เป้าหมาย นาน §วินาที; ในระยะ §เมตร จะล้างสนามเวทของศัตรูในพื้นที่ต่อเนื่อง ล้างได้สูงสุด §จุด; และให้พันธมิตรในพื้นที่สูงสุด §คน ได้รับภูมิคุ้มกันดาเมจเวทและกายภาพระยะไกล +§% มีสนามธาตุพร้อมกันได้สูงสุด §จุด",
  },
  "132312": {
    en: "Dispel",
    den: "Removes all buff effects from the target.",
    dth: "ปลดบัฟทั้งหมดของเป้าหมาย",
  },
  "132314": {
    en: "Diamond Dust Storm",
    den: "Evolves Diamond Dust into Diamond Dust Storm, expanding its hit range; Diamond Dust's skill multiplier +§%.",
    dth: "เปลี่ยนเพชรพราวดาวตกเป็นพายุเพชรพราวดาวตก ขยายระยะโดนของสกิล เพิ่มตัวคูณสกิลเพชรพราวดาวตก +§%",
  },

  // --- 622 Rogue ---
  "162201": {
    en: "Dagger Mastery",
    den: "When a dagger is equipped, physical damage +§%.",
    dth: "เมื่อสวมกริช เพิ่มดาเมจกายภาพ +§%",
  },
  "162202": {
    en: "Backstab",
    den: "Attacks the target twice, each hit dealing §%+§ Neutral ranged physical damage; Passive: for §s after attacking from behind, dagger physical damage +§%.",
    dth: "โจมตีเป้าหมาย 2 ครั้ง แต่ละครั้งสร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%+§; พาสซีฟ: หลังโจมตีจากด้านหลังเป็นเวลา §วินาที ดาเมจกายภาพของกริชเพิ่ม +§%",
  },
  "162203": {
    en: "Double Strafe",
    den: "Usable when a bow or off-hand crossbow is equipped: fires at the target § hits of §%+§ Neutral ranged physical damage.",
    dth: "ใช้ได้เมื่อสวมธนูหรือหน้าไม้มือรอง: ยิงเป้าหมาย §ครั้ง สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%+§",
  },
  "162204": {
    en: "Double Strafe: Enhanced",
    den: "When a bow is equipped, increases Double Strafe's skill multiplier by §%.",
    dth: "เมื่อสวมธนู เพิ่มตัวคูณสกิลของ Double Strafe +§%",
  },
  "162205": {
    en: "Cunning Eye",
    den: "When a bow is equipped, Hit +§, physical damage +§%.",
    dth: "เมื่อสวมธนู เพิ่ม Hit +§, ดาเมจกายภาพ +§%",
  },
  "162206": {
    en: "Third Hand",
    den: "ASPD +§%; when no off-hand crossbow is equipped, dagger normal-attack hits have a §% chance to automatically cast the skill learned via Plagiarism (the actual trigger chance varies by which skill was copied).",
    dth: "เพิ่มความเร็วโจมตี +§%; เมื่อไม่ได้สวมหน้าไม้มือรอง การโจมตีธรรมดาด้วยกริชมีโอกาส §% ปล่อยสกิลที่เรียนรู้จากการลอกเลียนอัตโนมัติ (โอกาสจริงจะต่างกันไปตามสกิลที่ลอก)",
  },
  "162207": {
    en: "Plagiarism",
    den: "Steals and learns the target's skill; can only learn certain 2nd-class-and-below skills, at level § at most; Passive: increases dagger normal-attack magic-damage multiplier by §%.",
    dth: "ขโมยเรียนรู้สกิลของเป้าหมาย เรียนได้เฉพาะบางสกิลระดับสองหรือต่ำกว่า สูงสุดเลเวล §; พาสซีฟ: เพิ่มตัวคูณดาเมจเวทของการโจมตีธรรมดาด้วยกริช +§%",
  },
  "162208": {
    en: "Overlord's Soul",
    den: "Physical and magic damage reduction +§%, and reflects §% of damage taken back to the enemy (reflection has no effect against MVP, Boss, and Mini monsters); the effect ends after reflecting § hits of damage or after §s at most.",
    dth: "เพิ่มการลดดาเมจกายภาพและเวท +§%, และสะท้อนดาเมจที่ได้รับ §% กลับไปยังศัตรู (สะท้อนไม่มีผลกับ MVP, Boss และ Mini); เอฟเฟกต์จะหายไปหลังสะท้อนดาเมจ §ครั้ง หรืออย่างมาก §วินาที",
  },
  "162209": {
    en: "Shadow Trace",
    den: "Enters Stealth for §s; casting a skill removes this state. After the effect ends, PVP damage dealt +§% for §s. Shares a cooldown with Hiding.",
    dth: "เข้าสู่สถานะล่องหน นาน §วินาที; การร่ายสกิลจะปลดสถานะนี้ หลังเอฟเฟกต์จบเพิ่มดาเมจ PVP ของตัวเอง +§% นาน §วินาที ใช้คูลดาวน์ร่วมกับการซ่อนตัว",
  },
  "162210": {
    en: "Divest All",
    den: "Strips a player target's weapon and shield; success chance is §% + (your DEX − target's DEX) × §%, lasting §s.",
    dth: "ปลดอาวุธและโล่ของเป้าหมายผู้เล่น อัตราสำเร็จ §% + (DEX เรา - DEX ศัตรู) × §%, มีผลนาน §วินาที",
  },
  "162212": {
    en: "Triangle Shot",
    den: "Usable when a bow or off-hand crossbow is equipped: fires at the target § times for §%+§ Neutral ranged physical damage each.",
    dth: "ใช้ได้เมื่อสวมธนูหรือหน้าไม้มือรอง: ยิงเป้าหมาย §ครั้ง สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%+§ ต่อครั้ง",
  },

  // --- 623 Stalker ---
  "162301": {
    en: "Fatal Menace",
    den: "Attacks the target and nearby enemies twice, each hit dealing §%+AGI×§%+§ Neutral ranged physical damage (capped at § AGI worth of bonus).",
    dth: "โจมตีเป้าหมายและศัตรูใกล้เคียง 2 ครั้ง แต่ละครั้งสร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%+AGI×§%+§ (โบนัสจาก AGI ได้สูงสุด §แต้ม)",
  },
  "162302": {
    en: "Feint Bomb",
    den: "Dashes behind the enemy, dealing § hits of §%+§ Neutral ranged physical damage to the target area and triggering Backstab; when a hunting bow is equipped, throws the bomb from range instead.",
    dth: "พุ่งเข้าไปด้านหลังศัตรู โจมตีพื้นที่เป้าหมาย §ครั้ง สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%+§ พร้อมกระตุ้นเอฟเฟกต์แทงข้างหลัง; เมื่อสวมธนูล่าสัตว์ จะเปลี่ยนเป็นขว้างระเบิดจากระยะไกลแทน",
  },
  "162304": {
    en: "Dagger Rain",
    den: "When a dagger is equipped, Triangle Shot instead throws a Dagger Rain on the target area, dealing § hits of §%+AGI×§%+§ Neutral ranged physical damage (capped at § AGI worth of bonus).",
    dth: "เมื่อสวมกริช สกิล Triangle Shot จะขว้างห่ากริชใส่พื้นที่เป้าหมาย §ครั้งแทน สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%+AGI×§%+§ (โบนัสจาก AGI ได้สูงสุด §แต้ม)",
  },
  "162305": {
    en: "Ghost Hand",
    den: "When a hunting bow is equipped, Double Strafe or Triangle Shot fires an additional shot at the target, dealing §%+AGI×§%+§ Neutral ranged physical damage to enemies in a line (capped at § AGI worth of bonus).",
    dth: "เมื่อสวมธนูล่าสัตว์ Double Strafe หรือ Triangle Shot จะยิงเพิ่มอีกนัดใส่เป้าหมาย สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%+AGI×§%+§ ให้ศัตรูที่อยู่ในแนวเส้นตรง (โบนัสจาก AGI ได้สูงสุด §แต้ม)",
  },
  "162309": {
    en: "Duplicate",
    den: "Steals and learns one damage-type skill from the target; can only learn certain advanced-2nd-class-and-below skills, at level § at most; Passive: using a dagger normal attack has a §% chance to raise skill multiplier by §%.",
    dth: "ขโมยเรียนรู้สกิลสร้างดาเมจ 1 สกิลจากเป้าหมาย เรียนได้เฉพาะบางสกิลระดับสองขั้นสูงหรือต่ำกว่า สูงสุดเลเวล §; พาสซีฟ: เมื่อโจมตีธรรมดาด้วยกริชมีโอกาส §% เพิ่มตัวคูณสกิล +§%",
  },
  "162311": {
    en: "Phantom Mask",
    den: "Ignore DEF +§%, lasting §s; while active, landing an attack automatically casts your learned level of Divest All, with a §s trigger interval.",
    dth: "เพิกเฉยเกราะป้องกัน +§%, นาน §วินาที; ระหว่างมีผล เมื่อโจมตีโดนจะปล่อยสกิลปลดอุปกรณ์ทั้งหมดระดับที่เรียนรู้ไว้อัตโนมัติ ทุก §วินาที",
  },
  "162312": {
    en: "Binding Grasp",
    den: "Shadow Claw grips the enemy: §% chance to Immobilize them for §s.",
    dth: "กรงเล็บเงาจับเป้าหมาย มีโอกาส §% ทำให้ศัตรูติดสถานะดึงติดนาน §วินาที",
  },
  "162313": {
    en: "Chaos Panic",
    den: "Creates a Chaos Circle on the ground in the target area; enemies who enter it have a §% chance to be inflicted with Chaos.",
    dth: "สร้างวงกลมความโกลาหลบนพื้นที่เป้าหมาย ศัตรูที่เข้ามาในวงมีโอกาส §% ติดสถานะสับสน",
  },
  "162314": {
    en: "Auto Shadow Spell",
    den: "MATK +§%, ASPD +§%; Feint Bomb instead deals magic damage. When no off-hand crossbow is equipped, dagger normal-attack hits have a §% chance to automatically cast the skill learned via Duplicate (the actual trigger chance varies by which skill was copied), lasting §s.",
    dth: "เพิ่ม MATK +§%, เพิ่มความเร็วโจมตี +§%; ระเบิดลวงเปลี่ยนเป็นสร้างดาเมจเวท เมื่อไม่ได้สวมหน้าไม้มือรอง การโจมตีธรรมดาด้วยกริชมีโอกาส §% ปล่อยสกิลที่เรียนรู้จากการทำซ้ำอัตโนมัติ (โอกาสจริงต่างกันไปตามสกิลที่คัดลอก) นาน §วินาที",
  },
};

const TAGS = {
  "傷害": ["Damage", "ดาเมจ"],
  "爆發": ["Burst", "ระเบิดพลัง"],
  "元素箭": ["Elemental Bolt", "ลูกธนูธาตุ"],
  "輔助": ["Support", "สนับสนุน"],
  "增益": ["Buff", "บัฟ"],
  "法術場": ["Spell Field", "สนามเวท"],
  "被動": ["Passive", "พาสซีฟ"],
  "魔拳": ["Magic Fist", "หมัดเวท"],
  "單體": ["Single", "เป้าหมายเดียว"],
  "控制": ["Control", "ควบคุม"],
  "位移": ["Dash", "เคลื่อนที่"],
  "減益": ["Debuff", "ลดพลัง"],
  "刺殺": ["Assassinate", "สังหาร"],
  "詭射": ["Trick Shot", "ยิงพลิกแพลง"],
  "影咒": ["Shadow Curse", "คำสาปเงา"],
  "隱身": ["Stealth", "ล่องหน"],
  "範圍": ["AoE", "พื้นที่"],
};

function fill(skel, nums) {
  let i = 0;
  return skel.replace(/§/g, () => (i < nums.length ? nums[i++] : "§"));
}

async function readJSON(p) { try { return JSON.parse(await readFile(p, "utf8")); } catch { return null; } }

async function translateFile(jid, locale, nameKey, desKey) {
  const zd = await readJSON(DATA + "jobs_zh-TW/" + jid + ".json");
  const d = await readJSON(DATA + "jobs_" + locale + "/" + jid + ".json");
  if (!zd || !d) return;
  const zskills = (zd.job || zd).skills || {};
  const job = d.job || d;
  for (const [kid, s] of Object.entries(job.skills || {})) {
    const t = TRANS[kid];
    if (!t) continue;
    s.name = t[nameKey];
    const zlv = (zskills[kid] || {}).levels || {};
    for (const [lk, L] of Object.entries(s.levels || {})) {
      const zde = clean((zlv[lk] || {}).des);
      if (zde) L.des = fill(t[desKey], zde.match(NUM) || []);
      for (const tg of (L.skill_tags || [])) {
        const nm = clean(tg.name);
        if (TAGS[nm]) tg.name = TAGS[nm][nameKey === "en" ? 0 : 1];
      }
    }
    // top-level skilldes mirrors level-1's des in this dataset; keep it in sync
    // so any UI reading skilldes directly (rather than levels[1].des) also sees
    // the localized text instead of stale Chinese.
    const l1 = s.levels && (s.levels["1"] || s.levels[1]);
    if (l1) s.skilldes = l1.des;
  }
  await writeFile(DATA + "jobs_" + locale + "/" + jid + ".json", JSON.stringify(d));
}

export async function translateTwSageRogue() {
  for (const jid of JOBS) {
    await translateFile(jid, "en-US", "en", "den");
    // th-TH keeps the literal English skill NAME (matches how the rest of the
    // game's Thai locale leaves ability names untranslated, e.g. "Firebolt",
    // "Sonic Blow") - only the description body is localized to Thai.
    await translateFile(jid, "th-TH", "en", "dth");
  }
  console.log("  translated TW skill files (Sage/Scholar/Rogue/Stalker) -> EN/TH");
}

if (import.meta.url === ("file://" + process.argv[1])) translateTwSageRogue();
