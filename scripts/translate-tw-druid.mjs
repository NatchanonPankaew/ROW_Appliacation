// AUTO-GENERATED data + applier. Localizes the Taiwan-sourced Druid job line
// (901 Druid -> 912 Karnos -> 913 Alitea) into EN/TH after sync, so re-syncs
// don't revert to Chinese. zh-TW is left as the original Traditional Chinese.
// § placeholders mark where each level's numbers go; the numbers are always read
// from the zh-TW file so the fill stays correct + idempotent. Job names follow
// the official reveal (Divine Pride): Druid / Karnos / Alitea.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const DATA = fileURLToPath(new URL("../public/data/sea/skill-simulator/data/", import.meta.url));
const JOBS = [901, 912, 913];
const NUM = /\d+(?:\.\d+)?/g;
const clean = (s) => String(s || "").replace(/<[^>]+>/g, "").trim();

const JOB_NAMES = {
  "901": { en: "Druid", th: "ดรูอิด" },
  "912": { en: "Karnos", th: "คาร์นอส" },
  "913": { en: "Alitea", th: "อลิเทีย" },
};

const TAGS = {
  "位移": ["Dash", "เคลื่อนที่"],
  "傷害": ["Damage", "ดาเมจ"],
  "冰霜": ["Frost", "น้ำแข็ง"],
  "利爪": ["Claw", "กรงเล็บ"],
  "召喚": ["Summon", "อัญเชิญ"],
  "單體": ["Single", "เป้าหมายเดียว"],
  "增益": ["Buff", "บัฟ"],
  "大地": ["Earth", "ปฐพี"],
  "控制": ["Control", "ควบคุม"],
  "機動": ["Mobility", "คล่องแคล่ว"],
  "減益": ["Debuff", "ดีบัฟ"],
  "爆發": ["Burst", "เบิร์สต์"],
  "猛獸": ["Beast", "สัตว์ร้าย"],
  "猛禽": ["Raptor", "ปักษา"],
  "範圍": ["AoE", "พื้นที่"],
  "被動": ["Passive", "พาสซีฟ"],
  "輔助": ["Support", "สนับสนุน"],
  "風暴": ["Storm", "พายุ"],
};

const TRANS = {
  // ===== 901 Druid =====
  "190105": {
    en: "Transform: Beast", th: "แปลงร่าง: สัตว์ร้าย",
    den: "Unleashes the soul of a mighty beast. While in Beast form: Max HP +§%, melee physical damage +§%, STR +§, LUK +§, HIT +§, ASPD +§%. Casting a Beast skill automatically transforms you into the beast; in Beast form your race becomes Animal.",
    dth: "ปลดปล่อยวิญญาณสัตว์ร้ายอันทรงพลัง ระหว่างอยู่ในร่างสัตว์ร้าย: HP สูงสุด +§%, ดาเมจกายภาพระยะประชิด +§%, STR +§, LUK +§, HIT +§, ความเร็วโจมตี +§%; เมื่อร่ายสกิลสายสัตว์ร้ายจะแปลงร่างเป็นสัตว์ร้ายอัตโนมัติ และในร่างสัตว์ร้ายเผ่าพันธุ์จะกลายเป็นสัตว์",
  },
  "190106": {
    en: "Ruthless Claw", th: "กรงเล็บอำมหิต",
    den: "With ruthless claws, strikes within §m at up to § targets for § hits of §% melee physical damage.",
    dth: "ฟันด้วยกรงเล็บอำมหิตในระยะ §เมตร ใส่เป้าหมายสูงสุด §ตัว สร้างดาเมจกายภาพระยะประชิด §ครั้ง ครั้งละ §%",
  },
  "190107": {
    en: "Savage Bite", th: "ขย้ำโหดเหี้ยม",
    den: "Charges a target up to §m away and deals §% melee physical damage. Killing the target resets this skill's cooldown.",
    dth: "พุ่งเข้าหาเป้าหมายในระยะ §เมตร สร้างดาเมจกายภาพระยะประชิด §%; หากสังหารเป้าหมายได้ จะรีเซ็ตคูลดาวน์ของสกิลนี้",
  },
  "190108": {
    en: "Ravenous", th: "หิวกระหาย",
    den: "Consumes §% SP to deal §% melee physical damage to the target and recover §% of your Max HP.",
    dth: "ใช้ SP §% สร้างดาเมจกายภาพระยะประชิด §% ใส่เป้าหมาย และฟื้น HP สูงสุด §%",
  },
  "190113": {
    en: "Nature's Shield", th: "โล่แห่งธรรมชาติ",
    den: "Gain INT +§, VIT +§, DEF +§, MDEF +§ for § minutes.",
    dth: "ได้รับ INT +§, VIT +§, DEF +§, MDEF +§ นาน § นาที",
  },
  "190109": {
    en: "Transform: Raptor", th: "แปลงร่าง: ปักษาล่าเหยื่อ",
    den: "Unleashes the soul of a sky-soaring raptor. While in Raptor form: movement speed +§%, ranged physical damage +§%, AGI +§, DEX +§, FLEE +§, HIT +§. Casting a Raptor skill automatically transforms you into the raptor; in Raptor form your race becomes Animal, and most Raptor skills can be cast while moving.",
    dth: "ปลดปล่อยวิญญาณปักษาที่โบยบินบนท้องฟ้า ระหว่างอยู่ในร่างปักษา: ความเร็วเคลื่อนที่ +§%, ดาเมจกายภาพระยะไกล +§%, AGI +§, DEX +§, FLEE +§, HIT +§; เมื่อร่ายสกิลสายปักษาจะแปลงร่างเป็นปักษาอัตโนมัติ ในร่างปักษาเผ่าพันธุ์จะกลายเป็นสัตว์ และสกิลสายปักษาส่วนใหญ่ร่ายขณะเคลื่อนที่ได้",
  },
  "190110": {
    en: "Feather Shot", th: "ยิงขนนก",
    den: "Fires enhanced feathers at the target for § hits of §% ranged physical damage.",
    dth: "ยิงขนนกเสริมพลังใส่เป้าหมาย สร้างดาเมจกายภาพระยะไกล §ครั้ง ครั้งละ §%",
  },
  "190111": {
    en: "Low Flight", th: "บินระดับต่ำ",
    den: "Flies swiftly at low altitude, dashing to the target and dealing § hits of §% ranged physical damage.",
    dth: "บินความเร็วสูงในระดับต่ำ พุ่งเข้าหาเป้าหมายทันที สร้างดาเมจกายภาพระยะไกล §ครั้ง ครั้งละ §%",
  },
  "190112": {
    en: "Gale Tornado", th: "พายุทอร์นาโด",
    den: "Whips up a powerful tornado, dealing §% ranged physical damage to the target while you retreat §m.",
    dth: "ก่อพายุทอร์นาโดทรงพลัง สร้างดาเมจกายภาพระยะไกล §% ใส่เป้าหมาย พร้อมถอยหลัง §เมตร",
  },
  "190114": {
    en: "Nature's Truth", th: "สัจธรรมแห่งธรรมชาติ",
    den: "Grasp the laws of nature, gaining MATK +§, magic damage +§%, Water damage +§%, Wind damage +§%, Earth damage +§%.",
    dth: "เข้าใจกฎแห่งธรรมชาติ ได้รับ MATK +§, ดาเมจเวท +§%, ดาเมจธาตุน้ำ +§%, ดาเมจธาตุลม +§%, ดาเมจธาตุดิน +§%",
  },
  "190115": {
    en: "Frost Totem", th: "โทเทมน้ำแข็ง",
    den: "Plants a frost totem that strikes an area of §m radius around the target for § hits of §% Water magic damage.",
    dth: "วางโทเทมน้ำแข็ง สร้างความเสียหายในพื้นที่รัศมี §เมตร รอบเป้าหมาย เป็นดาเมจเวทธาตุน้ำ §ครั้ง ครั้งละ §%",
  },
  "190116": {
    en: "Gale Blades", th: "ใบมีดวายุ",
    den: "Kicks up violent winds, striking an area of §m radius around the target for § hits of §% Wind magic damage.",
    dth: "ก่อลมกรรโชกแรง สร้างความเสียหายในพื้นที่รัศมี §เมตร รอบเป้าหมาย เป็นดาเมจเวทธาตุลม §ครั้ง ครั้งละ §%",
  },
  "190117": {
    en: "Blooming Flowers", th: "บุปผาเบ่งบาน",
    den: "Makes flowers bloom across an area of §m radius, dealing §% Earth magic damage.",
    dth: "ทำให้ดอกไม้เบ่งบานในพื้นที่รัศมี §เมตร สร้างดาเมจเวทธาตุดิน §%",
  },
  // ===== 912 Karnos =====
  "191201": {
    en: "Vile Claw", th: "ตะปบชั่วช้า",
    den: "Deals §% melee physical damage to the target while retreating §m.",
    dth: "สร้างดาเมจกายภาพระยะประชิด §% ใส่เป้าหมาย พร้อมถอยหลัง §เมตร",
  },
  "191202": {
    en: "Shred", th: "สับเฉือน",
    den: "Swings your claws each second within §m around you for § hits of §% melee physical damage. Can be cast while moving.",
    dth: "กวัดแกว่งกรงเล็บ ทุกวินาทีในพื้นที่รอบตัว §เมตร สร้างดาเมจกายภาพระยะประชิด §ครั้ง ครั้งละ §% ร่ายขณะเคลื่อนที่ได้",
  },
  "191203": {
    en: "Nightfall Hunt", th: "เงาล่าราตรี",
    den: "Shrouds enemies within §m in darkness; shrouded enemies cannot see or target units beyond §m for §s. On hitting monsters, reduces their ATK by §%.",
    dth: "เรียกความมืดปกคลุมศัตรูในระยะ §เมตร ศัตรูที่ถูกปกคลุมจะมองไม่เห็นและเลือกเป้าหมายที่อยู่นอกระยะ §เมตร ไม่ได้ นาน §วินาที; เมื่อโดนมอนสเตอร์ ลด ATK ของมัน §%",
  },
  "191204": {
    en: "Nature's Vitality", th: "พลังชีวิตธรรมชาติ",
    den: "Draw on nature's vitality, gaining Max SP +§% and SP recovery rate +§%.",
    dth: "ใช้พลังชีวิตแห่งธรรมชาติ ได้รับ SP สูงสุด +§% และอัตราการฟื้น SP +§%",
  },
  "191205": {
    en: "Cutting Cyclone", th: "พายุหมุนคมกริบ",
    den: "Kicks up sharp feathers and a cyclone, hitting up to § targets in a line for § hits of §% ranged physical damage.",
    dth: "พัดขนนกคมและพายุหมุน ใส่เป้าหมายในแนวเส้นตรงสูงสุด §ตัว สร้างดาเมจกายภาพระยะไกล §ครั้ง ครั้งละ §%",
  },
  "191206": {
    en: "Hurricane Wings", th: "ปีกพายุเฮอริเคน",
    den: "Conjures a hurricane, knocking back units within §m of the target and dealing § hits of §% ranged physical damage.",
    dth: "สร้างพายุเฮอริเคน ผลักหน่วยในระยะ §เมตร รอบเป้าหมาย และสร้างดาเมจกายภาพระยะไกล §ครั้ง ครั้งละ §%",
  },
  "191207": {
    en: "Veil of Wind", th: "ม่านวายุ",
    den: "Surrounds yourself with wind, gaining movement speed +§% for §s.",
    dth: "ห่อหุ้มตัวเองด้วยสายลม ได้รับความเร็วเคลื่อนที่ +§% นาน §วินาที",
  },
  "191208": {
    en: "Glacial Monolith", th: "ศิลาธารน้ำแข็ง",
    den: "Summons a glacial monolith for a time. Casting a Frost skill within §m of the monolith triggers a glacial burst, hitting enemies within §m of it for §% Water magic damage.",
    dth: "อัญเชิญศิลาธารน้ำแข็งชั่วขณะ เมื่อร่ายสกิลสายน้ำแข็งในระยะ §เมตร รอบศิลา ศิลาจะปลดปล่อยการระเบิดธารน้ำแข็ง ใส่ศัตรูในระยะ §เมตร รอบศิลา สร้างดาเมจเวทธาตุน้ำ §%",
  },
  "191209": {
    en: "Overload", th: "โอเวอร์โหลด",
    den: "Each time you cast a Storm skill, gain § Charge stack. At § Charges you enter Overload; your next Storm skill consumes § Charges and increases its damage by §%.",
    dth: "ทุกครั้งที่ร่ายสกิลสายพายุ จะสะสมประจุ §ชั้น เมื่อประจุถึง §ชั้น จะเข้าสู่สถานะโอเวอร์โหลด สกิลสายพายุครั้งถัดไปจะใช้ประจุ §ชั้น และเพิ่มดาเมจของสกิล §%",
  },
  "191210": {
    en: "Earth Sprout", th: "หน่อพฤกษ์ปฐพี",
    den: "Each time you cast an Earth skill, gain § Growth stack. At § Growth, your next Earth skill automatically triggers Earthbloom, hitting enemies within §m around you for §% Earth magic damage.",
    dth: "ทุกครั้งที่ร่ายสกิลสายปฐพี จะสะสมการเติบโต §ชั้น เมื่อการเติบโตถึง §ชั้น การร่ายสกิลสายปฐพีครั้งถัดไปจะปลดปล่อยปฐพีเบ่งบานอัตโนมัติ ใส่ศัตรูในระยะ §เมตร รอบตัว สร้างดาเมจเวทธาตุดิน §%",
  },
  "191211": {
    en: "Power of Nature", th: "พลังแห่งธรรมชาติ",
    den: "Channels the power of frost, storm and earth, hitting within §m radius up to § enemies for § hits of §% magic damage. This skill counts as a Frost, Storm and Earth skill at once, and its element matches your current attack element.",
    dth: "นำพาพลังน้ำแข็ง พายุ และปฐพี ใส่ศัตรูในรัศมี §เมตร สูงสุด §ตัว สร้างดาเมจเวท §ครั้ง ครั้งละ §%; สกิลนี้นับเป็นสกิลสายน้ำแข็ง พายุ และปฐพีพร้อมกัน และธาตุของสกิลจะตรงกับธาตุโจมตีปัจจุบัน",
  },
  // ===== 913 Alitea =====
  "191301": {
    en: "Primal Claw", th: "กรงเล็บดึกดำบรรพ์",
    den: "The first strike of the hunt with claws full of primal fury, hitting within §m up to § enemies for §% melee physical damage.",
    dth: "การจู่โจมแรกของการล่าด้วยกรงเล็บที่เปี่ยมด้วยความโกรธดึกดำบรรพ์ ใส่ศัตรูในระยะ §เมตร สูงสุด §ตัว สร้างดาเมจกายภาพระยะประชิด §%",
  },
  "191302": {
    en: "Wild Claw", th: "กรงเล็บเถื่อน",
    den: "Usable only within §s after Primal Claw. Presses the attack with wild claws, hitting within §m up to § enemies for §% melee physical damage.",
    dth: "ใช้ได้เฉพาะภายใน §วินาที หลังใช้กรงเล็บดึกดำบรรพ์ รุกไล่ด้วยกรงเล็บเถื่อน ใส่ศัตรูในระยะ §เมตร สูงสุด §ตัว สร้างดาเมจกายภาพระยะประชิด §%",
  },
  "191303": {
    en: "Alpha Claw", th: "กรงเล็บจ่าฝูง",
    den: "Usable only within §s after Wild Claw. Ends the prey's breath with an alpha's claws, hitting within §m up to § enemies for §% melee physical damage.",
    dth: "ใช้ได้เฉพาะภายใน §วินาที หลังใช้กรงเล็บเถื่อน ปลิดลมหายใจเหยื่อด้วยกรงเล็บจ่าฝูง ใส่ศัตรูในระยะ §เมตร สูงสุด §ตัว สร้างดาเมจกายภาพระยะประชิด §%",
  },
  "191304": {
    en: "Sixth Sense", th: "สัมผัสที่หก",
    den: "Maximizes your sixth sense, gaining ATK +§% and Crit +§.",
    dth: "ปลุกสัมผัสที่หกให้สูงสุด ได้รับ ATK +§% และคริ +§",
  },
  "191305": {
    en: "Wild Pulse", th: "จังหวะเถื่อน",
    den: "Boiling instinct floods your body, allowing Claw skills to crit, but they inherit only §% of crit damage.",
    dth: "สัญชาตญาณเดือดพล่านหล่อเลี้ยงทั่วร่าง ทำให้สกิลกรงเล็บคริติคอลได้ แต่รับดาเมจคริเพียง §%",
  },
  "191306": {
    en: "Feather Lance", th: "ทวนขนนก",
    den: "A feather lance rides the wind to pierce prey, hitting up to § targets in a line for §% ranged physical damage.",
    dth: "ทวนขนนกโต้ลมทะลวงเหยื่อ ใส่เป้าหมายในแนวเส้นตรงสูงสุด §ตัว สร้างดาเมจกายภาพระยะไกล §%",
  },
  "191307": {
    en: "Wingbeat", th: "กระพือปีก",
    den: "Beats your wings to regroup, gaining ranged physical damage +§% and Crit +§%, and allowing Feather Lance to crit, but it inherits only §% of crit damage.",
    dth: "กระพือปีกจัดกระบวนใหม่ เพิ่มดาเมจกายภาพระยะไกล +§% และคริ +§% ทำให้ทวนขนนกคริติคอลได้ แต่รับดาเมจคริเพียง §%",
  },
  "191308": {
    en: "Synced Flight", th: "บินประสาน",
    den: "Rides the sky's currents to teleport to an ally's side, granting them the Wingbeat effect.",
    dth: "อาศัยกระแสลมบนฟ้า วาร์ปไปข้างเพื่อนร่วมทีม และมอบเอฟเฟกต์กระพือปีกให้",
  },
  "191309": {
    en: "Nature's Wrath", th: "โทสะแห่งธรรมชาติ",
    den: "Unleashes nature's fury, hitting within §m radius up to § enemies for § hits of §% magic damage. This skill counts as a Frost, Storm and Earth skill at once, and its element matches your current attack element.",
    dth: "ปลดปล่อยเปลวโทสะแห่งธรรมชาติ ใส่ศัตรูในรัศมี §เมตร สูงสุด §ตัว สร้างดาเมจเวท §ครั้ง ครั้งละ §%; สกิลนี้นับเป็นสกิลสายน้ำแข็ง พายุ และปฐพีพร้อมกัน และธาตุของสกิลจะตรงกับธาตุโจมตีปัจจุบัน",
  },
  "191310": {
    en: "Glacial Stomp", th: "เหยียบธารน้ำแข็ง",
    den: "Castable only within a Glacial Monolith's area. Teleports beside the monolith and hits within §m radius up to § enemies around you for §% Water magic damage, inflicting Root for §s.",
    dth: "ร่ายได้เฉพาะในพื้นที่ศิลาธารน้ำแข็ง วาร์ปไปข้างศิลา ใส่ศัตรูในรัศมี §เมตร รอบตัว สูงสุด §ตัว สร้างดาเมจเวทธาตุน้ำ §% และติดสถานะตรึงกาย §วินาที",
  },
  "191311": {
    en: "Thunder Charge", th: "ประจุอสุนี",
    den: "Calls down thunder, immediately granting § Charge stack while striking within §m radius around you up to § enemies for §% Wind magic damage.",
    dth: "เรียกสายฟ้าลงมา เพิ่มประจุให้ตัวเองทันที §ชั้น พร้อมใส่ศัตรูในรัศมี §เมตร รอบตัว สูงสุด §ตัว สร้างดาเมจเวทธาตุลม §%",
  },
  "191312": {
    en: "Earth Harvest", th: "เก็บเกี่ยวปฐพี",
    den: "Grasp the mysteries of earth: when Earthbloom is triggered, recover §% HP, and each enemy Earthbloom hits grants +§% temporary Max HP for §s.",
    dth: "หยั่งรู้ความลี้ลับของปฐพี: เมื่อปฐพีเบ่งบานทำงาน ฟื้น HP §% และปฐพีเบ่งบานที่โดนศัตรูแต่ละตัวจะได้ HP สูงสุดชั่วคราว +§% นาน §วินาที",
  },
  "191313": {
    en: "Gravity Hole", th: "หลุมแรงโน้มถ่วง",
    den: "Warps the surrounding space, pulling enemies within §m — up to § of them — to your side, dealing §% Neutral magic damage and inflicting Stun for §s.",
    dth: "บิดเบือนพื้นที่รอบข้าง ดึงศัตรูในระยะ §เมตร สูงสุด §ตัว มาข้างตัว สร้างดาเมจเวทไร้ธาตุ §% และติดสถานะมึนงง §วินาที",
  },
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
  const nm = JOB_NAMES[String(jid)];
  if (nm) job.job_name = nm[nameKey];
  for (const [kid, s] of Object.entries(job.skills || {})) {
    const t = TRANS[kid];
    if (!t) continue;
    s.name = t[nameKey];
    const zlv = (zskills[kid] || {}).levels || {};
    for (const [lk, L] of Object.entries(s.levels || {})) {
      const zde = clean((zlv[lk] || {}).des);
      L.des = fill(t[desKey], zde.match(NUM) || []);
      for (const tg of (L.skill_tags || [])) {
        const t2 = clean(tg.name);
        if (TAGS[t2]) tg.name = TAGS[t2][nameKey === "en" ? 0 : 1];
      }
    }
  }
  await writeFile(DATA + "jobs_" + locale + "/" + jid + ".json", JSON.stringify(d));
  // Localize the job name in the index too (merge seeds it from zh-TW).
  const idxPath = DATA + "skills_index_" + locale + ".json";
  const idx = await readJSON(idxPath);
  if (idx && nm) {
    const jm = idx.jobs || idx;
    if (jm[String(jid)]) jm[String(jid)].job_name = nm[nameKey];
    await writeFile(idxPath, JSON.stringify(idx));
  }
}

export async function translateTwDruid() {
  for (const jid of JOBS) {
    await translateFile(jid, "en-US", "en", "den");
    await translateFile(jid, "th-TH", "th", "dth");
  }
  console.log("  translated TW Druid line (901/912/913) -> EN/TH");
}

if (import.meta.url === ("file://" + process.argv[1])) translateTwDruid();
