// AUTO-GENERATED data + applier. Localizes the Taiwan-sourced skill files
// (Bard/Dancer/Alchemist + their T2: Clown/Gypsy/Creator) into EN/TH after sync,
// so re-syncs don't revert to Chinese. zh-TW is left as the original Traditional
// Chinese. § placeholders mark where each level's numbers go; the numbers are
// always read from the zh-TW file so the fill stays correct + idempotent.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const DATA = fileURLToPath(new URL("../public/data/sea/skill-simulator/data/", import.meta.url));
const JOBS = [422, 423, 432, 433, 722, 723];
const NUM = /\d+(?:\.\d+)?/g;
const clean = (s) => String(s || "").replace(/<[^>]+>/g, "").trim();

const TRANS = {
  "142202": {
    "en": "Instrument Mastery",
    "th": "เชี่ยวชาญเครื่องดนตรี",
    "den": "When an instrument is equipped, Max SP +§%, ATK +§, ASPD +§%.",
    "dth": "เมื่อสวมเครื่องดนตรี: SP สูงสุด +§%, ATK +§, ความเร็วโจมตี +§%"
  },
  "142203": {
    "en": "Apple of Idun",
    "th": "แอปเปิลแห่งอีดุน",
    "den": "Heals self and all allies within §m for §%*ATK+§ HP;\nEnsemble Aura: every §s heals self and all allies within §m for §%*ATK+§ HP for §s; cannot coexist with other ensemble/solo auras;\nEnsemble Enhance: heal raised to §%*ATK+§; aura heal raised to §%*ATK+§.",
    "dth": "ฟื้น HP ให้ตัวเองและเพื่อนในระยะ §เมตร เท่ากับ §%*ATK+§;\nออร่าคู่ร้อง: ทุก §วินาที ฟื้น HP ให้ตัวเองและเพื่อนในระยะ §เมตร เท่ากับ §%*ATK+§ นาน §วินาที ใช้ร่วมกับออร่าอื่นไม่ได้;\nเสริมคู่ร้อง: เพิ่มการฟื้นเป็น §%*ATK+§; ออร่าฟื้นเป็น §%*ATK+§"
  },
  "142205": {
    "en": "Bragi's Poem",
    "th": "บทกวีของบราคี",
    "den": "Ensemble Aura: for self and all allies within §m, reduces cooldown and global cooldown of damage skills by §% for §s; cannot coexist with other ensemble/solo auras;\nEnsemble Enhance: the cooldown / global-cooldown reduction is raised to §%.",
    "dth": "ออร่าคู่ร้อง: ลดคูลดาวน์และคูลดาวน์รวมของสกิลโจมตีให้ตัวเองและเพื่อนในระยะ §เมตร ลง §% นาน §วินาที ใช้ร่วมกับออร่าอื่นไม่ได้;\nเสริมคู่ร้อง: เพิ่มการลดคูลดาวน์เป็น §%"
  },
  "142206": {
    "en": "Battle Drum",
    "th": "กลองศึกสะท้านฟ้า",
    "den": "Grants self and all allies within §m: ATK and MATK +§, movement speed +§% (does not stack with other group speed buffs), for §s;\nEnsemble Aura: grants all allies within §m ATK and MATK +§ for §s; cannot coexist with other ensemble/solo auras;\nEnsemble Enhance: ATK/MATK bonus raised to §, movement speed to §%; aura ATK/MATK bonus raised to §.",
    "dth": "ให้ตัวเองและเพื่อนในระยะ §เมตร: ATK และ MATK +§, ความเร็วเคลื่อนที่ +§% (ไม่ซ้อนกับสกิลเร่งกลุ่มอื่น) นาน §วินาที;\nออร่าคู่ร้อง: ให้เพื่อนในระยะ §เมตร เพิ่ม ATK และ MATK +§ นาน §วินาที ใช้ร่วมกับออร่าอื่นไม่ได้;\nเสริมคู่ร้อง: เพิ่มโบนัส ATK/MATK เป็น §, ความเร็วเคลื่อนที่เป็น §%; ออร่า ATK/MATK เป็น §"
  },
  "142207": {
    "en": "Musical Strike",
    "th": "โจมตีด้วยเครื่องดนตรี",
    "den": "Fires two notes at the target, dealing §%+§ Neutral ranged physical damage.",
    "dth": "ยิงโน้ต 2 ครั้งใส่เป้าหมาย สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%+§"
  },
  "142208": {
    "en": "Dissonance",
    "th": "เสียงไม่ประสาน",
    "den": "Fires sound waves at enemies within §m (up to §) for §%+§ Neutral ranged physical damage;\nSolo Aura: each second, fires sound waves at enemies within §m (up to §) for §%+§ Neutral ranged physical damage for §s; cannot coexist with other ensemble/solo auras.",
    "dth": "ปล่อยคลื่นเสียงใส่ศัตรูในระยะ §เมตร สูงสุด §ตัว สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%+§;\nออร่าเดี่ยว: ทุกวินาทีปล่อยคลื่นเสียงใส่ศัตรูในระยะ §เมตร สูงสุด §ตัว สร้างดาเมจ §%+§ นาน §วินาที ใช้ร่วมกับออร่าอื่นไม่ได้"
  },
  "142210": {
    "en": "Assassin Cross of Sunset",
    "th": "สนธยานักฆ่า",
    "den": "Grants self and all allies within §m: ASPD +§%, variable cast time -§%, for §s.",
    "dth": "ให้ตัวเองและเพื่อนในระยะ §เมตร: ความเร็วโจมตี +§%, เวลาร่ายแปรผัน -§%, นาน §วินาที"
  },
  "142211": {
    "en": "Resurrection Hymn",
    "th": "บทเพลงคืนชีพ",
    "den": "Revives one ally, restoring §% of their HP and SP.",
    "dth": "ชุบชีวิตพวกพ้อง 1 คน ฟื้น HP และ SP §%"
  },
  "142212": {
    "en": "Lullaby",
    "th": "เพลงกล่อมเด็ก",
    "den": "§% chance to inflict Sleep on enemies within §m (up to §) for §s.",
    "dth": "มีโอกาส §% ทำให้ศัตรูในระยะ §เมตร สูงสุด §ตัว ติดสถานะหลับ นาน §วินาที"
  },
  "143202": {
    "en": "Dance Practice",
    "th": "ฝึกเต้นรำ",
    "den": "When a whip is equipped, Max SP +§%, ATK +§, ASPD +§%.",
    "dth": "เมื่อสวมแส้: SP สูงสุด +§%, ATK +§, ความเร็วโจมตี +§%"
  },
  "143203": {
    "en": "Service for You",
    "th": "รับใช้คุณ",
    "den": "Heals self and all allies within §m for §%*ATK+§ HP;\nEnsemble Aura: every §s heals self and all allies within §m for §%*ATK+§ HP for §s; cannot coexist with other ensemble/solo auras;\nEnsemble Enhance: heal raised to §%*ATK+§; aura heal raised to §%*ATK+§.",
    "dth": "ฟื้น HP ให้ตัวเองและเพื่อนในระยะ §เมตร เท่ากับ §%*ATK+§;\nออร่าคู่ร้อง: ทุก §วินาที ฟื้น HP ให้ตัวเองและเพื่อนในระยะ §เมตร เท่ากับ §%*ATK+§ นาน §วินาที ใช้ร่วมกับออร่าอื่นไม่ได้;\nเสริมคู่ร้อง: เพิ่มการฟื้นเป็น §%*ATK+§; ออร่าฟื้นเป็น §%*ATK+§"
  },
  "143205": {
    "en": "Forget-Me-Not",
    "th": "อย่าลืมฉัน",
    "den": "Ensemble Aura: enemies within §m (up to §) ASPD -§%, global cooldown of damage skills +§; monsters' skill damage reduced by §%, for §s; cannot coexist with other ensemble/solo dance auras;\nEnsemble Enhance: ASPD reduction raised to §%, global-cooldown increase to §, monster skill-damage reduction to §%.",
    "dth": "ออร่าคู่ร้อง: ศัตรูในระยะ §เมตร สูงสุด §ตัว ความเร็วโจมตี -§%, คูลดาวน์รวมของสกิลโจมตี +§; ต่อมอนสเตอร์ลดดาเมจสกิลที่มันสร้าง §% นาน §วินาที ใช้ร่วมกับออร่าอื่นไม่ได้;\nเสริมคู่ร้อง: เพิ่มการลดความเร็วโจมตีเป็น §%, เพิ่มคูลดาวน์รวมเป็น §, ลดดาเมจสกิลมอนสเตอร์เป็น §%"
  },
  "143206": {
    "en": "Battle Drum",
    "th": "กลองศึกสะท้านฟ้า",
    "den": "Grants self and all allies within §m: ATK and MATK +§, movement speed +§% (does not stack with other group speed buffs), for §s;\nEnsemble Aura: grants all allies within §m ATK and MATK +§ for §s; cannot coexist with other ensemble/solo dance auras;\nEnsemble Enhance: ATK/MATK bonus raised to §, movement speed to §%; aura ATK/MATK bonus raised to §.",
    "dth": "ให้ตัวเองและเพื่อนในระยะ §เมตร: ATK และ MATK +§, ความเร็วเคลื่อนที่ +§% (ไม่ซ้อนกับสกิลเร่งกลุ่มอื่น) นาน §วินาที;\nออร่าคู่ร้อง: ให้เพื่อนในระยะ §เมตร เพิ่ม ATK และ MATK +§ นาน §วินาที ใช้ร่วมกับออร่าอื่นไม่ได้;\nเสริมคู่ร้อง: เพิ่มโบนัส ATK/MATK เป็น §, ความเร็วเคลื่อนที่เป็น §%; ออร่า ATK/MATK เป็น §"
  },
  "143207": {
    "en": "Throw Arrow",
    "th": "ขว้างลูกศรพันแส้",
    "den": "Throws with the whip, firing two arrows at the target for §%+§ Neutral ranged physical damage.",
    "dth": "ใช้แส้ขว้างยิงลูกศร 2 ดอกใส่เป้าหมาย สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%+§"
  },
  "143208": {
    "en": "Ugly Dance",
    "th": "ระบำอัปลักษณ์",
    "den": "Unleashes a dance rhythm at enemies within §m (up to §) for §%+§ Neutral ranged physical damage;\nSolo Dance Aura: each second, unleashes a dance rhythm at enemies within §m (up to §) for §%+§ Neutral ranged physical damage for §s; cannot coexist with other ensemble/solo dance auras.",
    "dth": "ปล่อยจังหวะระบำใส่ศัตรูในระยะ §เมตร สูงสุด §ตัว สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%+§;\nออร่าระบำเดี่ยว: ทุกวินาทีปล่อยจังหวะระบำใส่ศัตรูในระยะ §เมตร สูงสุด §ตัว สร้างดาเมจ §%+§ นาน §วินาที ใช้ร่วมกับออร่าอื่นไม่ได้"
  },
  "143210": {
    "en": "Goddess's Kiss",
    "th": "จุมพิตเทพี",
    "den": "Grants self and all allies within §m Crit +§ for §s.",
    "dth": "ให้ตัวเองและเพื่อนในระยะ §เมตร คริ +§ นาน §วินาที"
  },
  "143211": {
    "en": "Resurrection Hymn",
    "th": "บทเพลงคืนชีพ",
    "den": "Revives one ally, restoring §% of their HP and SP.",
    "dth": "ชุบชีวิตพวกพ้อง 1 คน ฟื้น HP และ SP §%"
  },
  "143212": {
    "en": "Humming",
    "th": "เสียงฮัมเพลง",
    "den": "§% chance to inflict Chaos on enemies within §m (up to §) for §s.",
    "dth": "มีโอกาส §% ทำให้ศัตรูในระยะ §เมตร สูงสุด §ตัว ติดสถานะสับสน นาน §วินาที"
  },
  "172210": {
    "en": "Fire Bottle Throw",
    "th": "ขว้างขวดไฟ",
    "den": "Throws a fire bottle, leaving a flame area §m wide for §s; each second it hits up to § targets in the area for §% Neutral ranged physical damage, with §% chance to inflict Weapon Break for §s; up to § flame areas can exist at once.",
    "dth": "ขว้างขวดไฟใส่เป้าหมาย ทิ้งพื้นที่เพลิงรัศมี §เมตร นาน §วินาที, แต่ละวินาทีโจมตีเป้าหมายในพื้นที่สูงสุด §ตัว สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%, และมีโอกาส §% ทำให้ติดสถานะทำลายอาวุธ นาน §วินาที, มีพื้นที่เพลิงพร้อมกันได้สูงสุด §จุด"
  },
  "172212": {
    "en": "Acid Terror",
    "th": "กรดกัดกร่อน",
    "den": "Throws an acid bottle at the target for §% Neutral ranged physical damage, with §% chance to inflict Armor Break.",
    "dth": "ขว้างขวดกรดใส่เป้าหมาย สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%, และมีโอกาส §% ทำให้ติดสถานะทำลายเกราะ"
  },
  "172213": {
    "en": "Chemical Weapon Protection",
    "th": "ปกป้องอาวุธเคมี",
    "den": "Grants self and allies within §m immunity to Weapon Break for §s.",
    "dth": "ให้ตัวเองและเพื่อนในระยะ §เมตร ภูมิคุ้มกันสถานะทำลายอาวุธ นาน §วินาที"
  },
  "172214": {
    "en": "Chemical Armor Protection",
    "th": "ปกป้องเกราะเคมี",
    "den": "Grants self and allies within §m immunity to Armor Break for §s.",
    "dth": "ให้ตัวเองและเพื่อนในระยะ §เมตร ภูมิคุ้มกันสถานะทำลายเกราะ นาน §วินาที"
  },
  "172215": {
    "en": "Summon Filir",
    "th": "อัญเชิญฟิลิร์",
    "den": "Summons the homunculus Filir for §s. Filir auto-attacks the selected enemy for §% Neutral ranged physical damage; you can have at most § Filir. Filir's attacks have §% chance to trigger the enhanced skill Moonlight, hitting the target and enemies within §m for §% Neutral ranged physical damage. While Filir is present, self and master gain +§% ranged physical damage. The homunculus's first § hits are forced to § damage.",
    "dth": "อัญเชิญโฮมุนคูลุสฟิลิร์ นาน §วินาที ฟิลิร์โจมตีศัตรูที่เลือกอัตโนมัติ สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%; มีฟิลิร์ได้สูงสุด §ตัว เมื่อฟิลิร์โจมตีมีโอกาส §% กระตุ้นสกิลเสริมแสงจันทร์ ใส่เป้าหมายและศัตรูรอบ §เมตร สร้างดาเมจ §%, ขณะฟิลิร์อยู่เพิ่มดาเมจกายภาพระยะไกลให้ตัวเองและเจ้าของ §%, โฮมุนคูลุสจะรับดาเมจ § ครั้งแรกเป็น § หน่วยแบบบังคับ"
  },
  "172220": {
    "en": "Bioethics",
    "th": "เสริมพลังชีวิต",
    "den": "Increases the homunculus's chance to trigger its enhanced skill by §%.",
    "dth": "เพิ่มโอกาสที่โฮมุนคูลุสจะกระตุ้นสกิลเสริม §%"
  },
  "172221": {
    "en": "Life Potion Throw",
    "th": "ขว้างยาชีวิต",
    "den": "Throws a life potion at the target for §% Neutral ranged physical damage; on hit, the target takes +§% damage from homunculus skills for §s.",
    "dth": "ขว้างยาชีวิตใส่เป้าหมาย สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%; เมื่อโดน เป้าหมายรับดาเมจจากสกิลโฮมุนคูลุสเพิ่ม §% นาน §วินาที"
  },
  "142301": {
    "en": "Professional Performer",
    "th": "นักบรรเลงอาชีพ",
    "den": "Removes the performance fatigue effect.",
    "dth": "ลบสถานะอ่อนล้าจากการบรรเลง"
  },
  "142302": {
    "en": "Encore",
    "th": "อังกอร์",
    "den": "Recasts the last ensemble skill used; when Encore reaches level §, the recast ensemble skill always gains the Ensemble Enhance effect.",
    "dth": "ร่ายสกิลคู่ร้องล่าสุดซ้ำ; เมื่ออังกอร์ถึงระดับ § สกิลคู่ร้องที่ร่ายซ้ำจะได้รับเอฟเฟกต์เสริมคู่ร้องเสมอ"
  },
  "142303": {
    "en": "Ring of Nibelungen",
    "th": "แหวนนีเบลุงเกน",
    "den": "Grants self and all allies within §m one random buff below for §s:\nTotal ATK and MATK increase equal to §% of the Clown's own ATK (cannot exceed §% of the target's ATK and MATK);\nMax HP and Max SP +§%;\nAll stats +§;\nSkill SP cost -§%;\nEnsemble Enhance: gain all of the buffs.",
    "dth": "ให้ตัวเองและเพื่อนในระยะ §เมตร ได้รับบัฟสุ่ม 1 อย่างต่อไปนี้ นาน §วินาที:\nATK และ MATK รวมเพิ่มขึ้นเท่ากับ §% ของ ATK ของ Clown เอง (ไม่เกิน §% ของ ATK และ MATK เป้าหมาย);\nHP สูงสุดและ SP สูงสุด +§%;\nสเตตัสทุกตัว +§;\nSP ที่ใช้ร่ายสกิล -§%;\nเสริมคู่ร้อง: ได้รับบัฟทั้งหมด"
  },
  "142304": {
    "en": "Eternal Chaos",
    "th": "ความโกลาหลนิรันดร์",
    "den": "Ensemble Aura: enemies within §m (up to §) have physical and magical damage reduction -§%; cannot coexist with other ensemble/solo auras;\nEnsemble Enhance: the aura's P/M damage-reduction cut is raised to §%.",
    "dth": "ออร่าคู่ร้อง: ศัตรูในระยะ §เมตร สูงสุด §ตัว ลดการลดดาเมจกายและดาเมจเวท -§% ใช้ร่วมกับออร่าอื่นไม่ได้;\nเสริมคู่ร้อง: เพิ่มการลดเป็น §%"
  },
  "142305": {
    "en": "Hermode's Rod",
    "th": "คทาเฮอร์โหมด",
    "den": "§% chance to cure Stun, Freeze and Petrify for all allies within §m;\nEnsemble Aura: grants self and all allies within §m magical damage reduction +§%; cannot coexist with other ensemble/solo auras;\nEnsemble Enhance: on cast, §% chance to cure all status ailments on allies; the aura's magical damage reduction is raised to §%.",
    "dth": "มีโอกาส §% ปลดสถานะ มึนงง/แช่แข็ง/หิน ให้เพื่อนในระยะ §เมตร;\nออร่าคู่ร้อง: ให้ตัวเองและเพื่อนในระยะ §เมตร เพิ่มการลดดาเมจเวท +§% ใช้ร่วมกับออร่าอื่นไม่ได้;\nเสริมคู่ร้อง: ตอนร่ายมีโอกาส §% ปลดสถานะผิดปกติทั้งหมดของเพื่อน, เพิ่มการลดดาเมจเวทของออร่าเป็น §%"
  },
  "142306": {
    "en": "Unending Rhythm",
    "th": "จังหวะไม่หยุดพัก",
    "den": "Each time you cast an ensemble or solo skill, gain § Rhythm Note stacks for §s, stacking up to §; each Rhythm Note grants ASPD +§%, movement speed +§%, ATK +§.",
    "dth": "ทุกครั้งที่ร่ายสกิลคู่ร้องหรือเดี่ยว ได้รับโน้ตจังหวะ §ชั้น นาน §วินาที ซ้อนได้สูงสุด §ชั้น; แต่ละชั้นเพิ่มความเร็วโจมตี +§%, ความเร็วเคลื่อนที่ +§%, ATK +§"
  },
  "142307": {
    "en": "Arrow Vulcan",
    "th": "ระบำลูกศรลับ",
    "den": "Fires continuous arrows at enemies within §m (up to §), dealing § hits of §%+§ Neutral ranged physical damage in total; Arrow Vulcan consumes all Rhythm Notes, and each consumed stack adds +§ hits.\nArrow Vulcan's total PVP skill multiplier is reduced by §%.",
    "dth": "ยิงลูกศรต่อเนื่องใส่ศัตรูในระยะ §เมตร สูงสุด §ตัว รวม §ครั้ง สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%+§; Arrow Vulcan ใช้โน้ตจังหวะทั้งหมด ทุกชั้นที่ใช้เพิ่มจำนวนครั้ง +§\nตัวคูณสกิลรวมของ Arrow Vulcan ใน PVP ลดลง §%"
  },
  "142308": {
    "en": "Sound of Agony",
    "th": "เสียงแห่งความเจ็บปวด",
    "den": "When an ensemble or solo skill damages an enemy, §% chance to inflict the Vulnerable status for §s.",
    "dth": "เมื่อสกิลคู่ร้องหรือเดี่ยวสร้างดาเมจใส่ศัตรู มีโอกาส §% ทำให้ติดสถานะบอบช้ำ (รับดาเมจเพิ่ม) นาน §วินาที"
  },
  "143301": {
    "en": "Professional Performer",
    "th": "นักบรรเลงอาชีพ",
    "den": "Removes the performance fatigue effect.",
    "dth": "ลบสถานะอ่อนล้าจากการบรรเลง"
  },
  "143302": {
    "en": "Encore",
    "th": "อังกอร์",
    "den": "Recasts the last ensemble dance skill used; when Encore reaches level §, the recast ensemble skill always gains the Ensemble Enhance effect.",
    "dth": "ร่ายสกิลคู่ร้องล่าสุดซ้ำ; เมื่ออังกอร์ถึงระดับ § สกิลคู่ร้องที่ร่ายซ้ำจะได้รับเอฟเฟกต์เสริมคู่ร้องเสมอ"
  },
  "143303": {
    "en": "Ring of Nibelungen",
    "th": "แหวนนีเบลุงเกน",
    "den": "Grants self and all allies within §m one random buff below for §s:\nTotal ATK and MATK increase equal to §% of the Gypsy's own ATK (cannot exceed §% of the target's ATK and MATK);\nMax HP and Max SP +§%;\nAll stats +§;\nSkill SP cost -§%;\nEnsemble Enhance: gain all of the buffs.",
    "dth": "ให้ตัวเองและเพื่อนในระยะ §เมตร ได้รับบัฟสุ่ม 1 อย่างต่อไปนี้ นาน §วินาที:\nATK และ MATK รวมเพิ่มขึ้นเท่ากับ §% ของ ATK ของ Gypsy เอง (ไม่เกิน §% ของ ATK และ MATK เป้าหมาย);\nHP สูงสุดและ SP สูงสุด +§%;\nสเตตัสทุกตัว +§;\nSP ที่ใช้ร่ายสกิล -§%;\nเสริมคู่ร้อง: ได้รับบัฟทั้งหมด"
  },
  "143304": {
    "en": "Loki's Wail",
    "th": "เสียงคร่ำครวญของโลกิ",
    "den": "Ensemble Aura: grants self and all allies within §m all control resistance +§ for §s;\nEnsemble Enhance: the aura's control resistance is raised to §.",
    "dth": "ออร่าคู่ร้อง: ให้ตัวเองและเพื่อนในระยะ §เมตร ต้านทานการควบคุมทั้งหมด +§ นาน §วินาที;\nเสริมคู่ร้อง: เพิ่มต้านทานการควบคุมของออร่าเป็น §"
  },
  "143305": {
    "en": "Hermode's Rod",
    "th": "คทาเฮอร์โหมด",
    "den": "§% chance to cure Stun, Freeze and Petrify for all allies within §m;\nEnsemble Aura: grants self and all allies within §m magical damage reduction +§%; cannot coexist with other ensemble/solo dance auras;\nEnsemble Enhance: on cast, §% chance to cure all status ailments on allies; the aura's magical damage reduction is raised to §%.",
    "dth": "มีโอกาส §% ปลดสถานะ มึนงง/แช่แข็ง/หิน ให้เพื่อนในระยะ §เมตร;\nออร่าคู่ร้อง: ให้ตัวเองและเพื่อนในระยะ §เมตร เพิ่มการลดดาเมจเวท +§% ใช้ร่วมกับออร่าอื่นไม่ได้;\nเสริมคู่ร้อง: ตอนร่ายมีโอกาส §% ปลดสถานะผิดปกติทั้งหมดของเพื่อน, เพิ่มการลดดาเมจเวทของออร่าเป็น §%"
  },
  "143306": {
    "en": "Unending Rhythm",
    "th": "จังหวะไม่หยุดพัก",
    "den": "Each time you cast an ensemble or solo dance skill, gain § Rhythm Note stacks for §s, stacking up to §; each Rhythm Note grants ASPD +§%, movement speed +§%, ATK +§.",
    "dth": "ทุกครั้งที่ร่ายสกิลคู่ร้องหรือระบำเดี่ยว ได้รับโน้ตจังหวะ §ชั้น นาน §วินาที ซ้อนได้สูงสุด §ชั้น; แต่ละชั้นเพิ่มความเร็วโจมตี +§%, ความเร็วเคลื่อนที่ +§%, ATK +§"
  },
  "143307": {
    "en": "Arrow Vulcan",
    "th": "ระบำลูกศรลับ",
    "den": "Fires continuous arrows at enemies within §m (up to §), dealing § hits of §%+§ Neutral ranged physical damage in total; Arrow Vulcan consumes all Rhythm Notes, and each consumed stack adds +§ hits.\nArrow Vulcan's total PVP skill multiplier is reduced by §%.",
    "dth": "ยิงลูกศรต่อเนื่องใส่ศัตรูในระยะ §เมตร สูงสุด §ตัว รวม §ครั้ง สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%+§; Arrow Vulcan ใช้โน้ตจังหวะทั้งหมด ทุกชั้นที่ใช้เพิ่มจำนวนครั้ง +§\nตัวคูณสกิลรวมของ Arrow Vulcan ใน PVP ลดลง §%"
  },
  "143308": {
    "en": "Wink of Charm",
    "th": "ขยิบตาเย้ายวน",
    "den": "Enemies inflicted with Chaos by the Dancer move toward her; when an ensemble or solo dance skill damages an enemy, §% chance to inflict Chaos for §s.",
    "dth": "ศัตรูที่ถูก Dancer ทำให้สับสนจะเคลื่อนเข้าหา Dancer; เมื่อสกิลคู่ร้องหรือระบำเดี่ยวสร้างดาเมจ มีโอกาส §% ทำให้ติดสถานะสับสน นาน §วินาที"
  },
  "172231": {
    "en": "Acid Demonstration",
    "th": "ระเบิดกรดไฟ",
    "den": "Throws an acid+fire bottle at the target for ATK*(§% + target VIT/§) Neutral ranged physical damage, with §% chance to inflict Weapon and Armor Break.",
    "dth": "ขว้างขวดกรดไฟใส่เป้าหมาย สร้างดาเมจกายภาพระยะไกลธาตุ Neutral เท่ากับ ATK*(§% + VIT เป้าหมาย/§), และมีโอกาส §% ทำให้ติดสถานะทำลายอาวุธและเกราะ"
  },
  "172232": {
    "en": "Power Throw",
    "th": "ขว้างทรงพลัง",
    "den": "Increases Acid Demonstration's cast range by § and skill multiplier by §%.",
    "dth": "เพิ่มระยะร่ายของขว้างขวดกรดไฟ §, และตัวคูณสกิล §%"
  },
  "172233": {
    "en": "Full Chemical Protection",
    "th": "ปกป้องเคมีทั้งหมด",
    "den": "Grants self and allies within §m immunity to Weapon, Armor, Shoes, Cape and Shield break/strip status for §s.",
    "dth": "ให้ตัวเองและเพื่อนในระยะ §เมตร ภูมิคุ้มกันสถานะทำลาย/ปลด อาวุธ เกราะ รองเท้า ผ้าคลุม และโล่ นาน §วินาที"
  },
  "172234": {
    "en": "Potion Throw",
    "th": "ขว้างยา",
    "den": "Restores HP to allies within §m equal to §%*P.ATK.",
    "dth": "ฟื้น HP ให้เพื่อนในระยะ §เมตร เท่ากับ §%*P.ATK"
  },
  "172235": {
    "en": "Equipment Break",
    "th": "ทำลายอุปกรณ์",
    "den": "On dealing damage, §% chance to inflict Weapon/Armor Break and Shield Strip for §s (homunculi cannot trigger this). Homunculus skill multiplier +§%.",
    "dth": "เมื่อสร้างดาเมจ มีโอกาส §% ทำให้ติดสถานะทำลายอาวุธ/เกราะ และปลดโล่ นาน §วินาที (โฮมุนคูลุสกระตุ้นไม่ได้) เพิ่มตัวคูณสกิลโฮมุนคูลุส +§%"
  },
  "172241": {
    "en": "Summon Amistr",
    "th": "อัญเชิญอามิสเตอร์",
    "den": "Summons the homunculus Amistr for §s. Amistr auto-attacks the selected enemy for §% Neutral ranged physical damage; you can have at most § Amistr. Amistr's attacks have §% chance to trigger the enhanced skill Land Wind, hitting enemies within §m for §% Neutral ranged physical damage. While Amistr is present, skill damage taken by self and master is reduced by §%. The homunculus's first § hits are forced to § damage.",
    "dth": "อัญเชิญโฮมุนคูลุสอามิสเตอร์ นาน §วินาที อามิสเตอร์โจมตีศัตรูที่เลือกอัตโนมัติ สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%; มีอามิสเตอร์ได้สูงสุด §ตัว เมื่ออามิสเตอร์โจมตีมีโอกาส §% กระตุ้นสกิลเสริมพายุพสุธา ใส่ศัตรูรอบ §เมตร สร้างดาเมจ §%, ขณะอามิสเตอร์อยู่ลดดาเมจสกิลที่ตัวเองและเจ้าของได้รับ §%, โฮมุนคูลุสรับดาเมจ § ครั้งแรกเป็น § หน่วยแบบบังคับ"
  },
  "172251": {
    "en": "Summon Lif",
    "th": "อัญเชิญลีฟ",
    "den": "Summons the homunculus Lif for §s. Lif auto-attacks the selected enemy for §% Neutral ranged physical damage; you can have at most § Lif. Lif's attacks have §% chance to trigger the enhanced skill Healing Hands, healing the master for §%*P.ATK HP (cooldown §s). While Lif is present, healing received by self and master is increased by §%. The homunculus's first § hits are forced to § damage.",
    "dth": "อัญเชิญโฮมุนคูลุสลีฟ นาน §วินาที ลีฟโจมตีศัตรูที่เลือกอัตโนมัติ สร้างดาเมจกายภาพระยะไกลธาตุ Neutral §%; มีลีฟได้สูงสุด §ตัว เมื่อลีฟโจมตีมีโอกาส §% กระตุ้นสกิลเสริมหัตถ์เยียวยา ฟื้น HP ให้เจ้าของ §%*P.ATK (คูลดาวน์ §วินาที), ขณะลีฟอยู่เพิ่มการรับการรักษาของตัวเองและเจ้าของ §%, โฮมุนคูลุสรับดาเมจ § ครั้งแรกเป็น § หน่วยแบบบังคับ"
  },
  "172261": {
    "en": "Bioethics Burst",
    "th": "ระเบิดพลังชีวิต",
    "den": "Increases the homunculus's chance to trigger its enhanced skill by §% for §s.",
    "dth": "เพิ่มโอกาสที่โฮมุนคูลุสจะกระตุ้นสกิลเสริม §% นาน §วินาที"
  }
};
const TAGS = {
  "傷害": [
    "Damage",
    "ดาเมจ"
  ],
  "召喚": [
    "Summon",
    "อัญเชิญ"
  ],
  "合奏": [
    "Ensemble",
    "คู่ร้อง"
  ],
  "單體": [
    "Single",
    "เป้าหมายเดียว"
  ],
  "增益": [
    "Buff",
    "บัฟ"
  ],
  "復活": [
    "Revive",
    "ชุบชีวิต"
  ],
  "投擲": [
    "Throw",
    "ขว้าง"
  ],
  "持續": [
    "Sustained",
    "ต่อเนื่อง"
  ],
  "控制": [
    "Control",
    "ควบคุม"
  ],
  "治療": [
    "Heal",
    "ฟื้นฟู"
  ],
  "獨奏": [
    "Solo",
    "เดี่ยว"
  ],
  "獨舞": [
    "Solo Dance",
    "ระบำเดี่ยว"
  ],
  "生命體": [
    "Homunculus",
    "โฮมุนคูลุส"
  ],
  "範圍": [
    "AoE",
    "พื้นที่"
  ],
  "被動": [
    "Passive",
    "พาสซีฟ"
  ],
  "輔助": [
    "Support",
    "สนับสนุน"
  ],
  "防護": [
    "Protection",
    "ป้องกัน"
  ],
  "易傷": [
    "Vulnerable",
    "บอบช้ำ"
  ]
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
  }
  await writeFile(DATA + "jobs_" + locale + "/" + jid + ".json", JSON.stringify(d));
}

export async function translateTwSkills() {
  for (const jid of JOBS) {
    await translateFile(jid, "en-US", "en", "den");
    await translateFile(jid, "th-TH", "th", "dth");
  }
  console.log("  translated TW skill files (Bard/Dancer/Alchemist +T2) -> EN/TH");
}

if (import.meta.url === ("file://" + process.argv[1])) translateTwSkills();
