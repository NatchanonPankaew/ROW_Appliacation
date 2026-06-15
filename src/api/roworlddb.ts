// Self-hosted dataset (mirrored by scripts/sync-data.mjs + sync-images.mjs into
// ./public). On web we serve from the same origin, so a relative path works and
// avoids CORS. Native builds have no origin, so set EXPO_PUBLIC_DATA_HOST to the
// deployed site (e.g. https://mimir.pages.dev) to fetch the same files.
const HOST = process.env.EXPO_PUBLIC_DATA_HOST ?? "";
const BASE_DATA = HOST + "/data/sea";
const BASE_IMG = HOST + "/media/images/";

export type Kind =
  | "character"
  | "cards"
  | "equipment"
  | "skills"
  | "monsters"
  | "pets"
  | "shop"
  | "maps"
  | "apocalypse"
  | "runes";

export interface DetailRow { label: string; value: string; }
export interface FilterDef { key: string; label: string; options: string[]; }

export interface NormItem {
  id: number | string;
  title: string;
  subtitle?: string;
  effects?: string[];
  iconName?: string;
  iconUrl?: string;
  quality?: number;
  details?: DetailRow[];
  story?: string;
  tags?: Record<string, string>;

  // --- added for the character builder ---
  // numeric stats kept raw so they can be summed (details[] is for display only)
  stats?: Record<string, number>;
  // bonus added PER +1 refine (attrName -> value per level), from refinePerLevel
  refineStats?: Record<string, number>;
  // which equipment slot this item belongs to (localized string, for display)
  slot?: string;
  // stable, locale-independent slot key (see canonicalSlot) for ordering & matching
  slotKey?: string;
  // --- equipment: job restriction + weapon subtype ---
  jobLimits?: number[];      // job ids that can use this item ([] when jobAll)
  jobAll?: boolean;          // usable by every job
  subtypeName?: string;      // weapon/armor subtype label (e.g. "ดาบสองมือ")
  twoHanded?: boolean;       // weapon occupies the off-hand slot too
  reqLevel?: number;         // level required to equip (from openLevel)
}

export interface JobOpt { id: number; name: string; icon?: string; }
export interface FetchResult { items: NormItem[]; filters: FilterDef[]; jobs?: JobOpt[]; }

// Raw card shape (as it comes from handbook_cards_*.json), used by CardItem.
export interface Card {
  id: number | string;
  name: string;
  card_type_name?: string;
  effect?: string;
  effect_lines?: string[];
  effect_extra?: string;
  item_icon?: string;
  quality?: number;
  stats?: Record<string, number>;
}

export type IconPaths = Record<string, string>;

export const QUALITY: Record<number, { label: string; color: string }> = {
  1: { label: "Normal", color: "#9AA0A6" },
  2: { label: "Green", color: "#5DBB63" },
  3: { label: "Blue", color: "#4F8EE6" },
  4: { label: "Purple", color: "#A65CD6" },
  5: { label: "Gold", color: "#E8B339" },
  6: { label: "Red", color: "#E0533D" },
};

const QUALITY_ORDER = [
  "Normal",
  "Green",
  "Blue",
  "Purple",
  "Gold",
  "Red",
];
const TH_MAP: Record<string, string> = {
  "臉飾": "ใบหน้า",
  "頭飾": "ศีรษะ",
  "嘴飾": "ปาก",
  "背飾": "หลัง",
  "尾飾": "หาง",
  "副手": "มือรอง",
  "披風": "ผ้าคลุม",
  "武器": "อาวุธ",
  "鎧甲": "เกราะ",
  "鞋子": "รองเท้า",
  "飾品": "เครื่องประดับ",

  "Fire": "ไฟ",
  "Water": "น้ำ",
  "Wind": "ลม",
  "Earth": "ดิน",
  "Holy": "ศักดิ์สิทธิ์",
  "Shadow": "เงา",
  "Ghost": "ผี",
  "Poison": "พิษ",
  "Neutral": "กลาง",
};

function tr(value: string | undefined, locale: string): string {
  if (!value) return "";

  if (locale !== "th-TH") {
    return value;
  }

  return TH_MAP[value] || value;
}
function qualityTag(quality?: number): string {
  return qualityInfo(quality)?.label || "";
}
export const LOCALES = ["en-US", "th-TH", "zh-TW"];

export const KIND_HAS_QUALITY: Record<Kind, boolean> = {
  character: false,
  cards: true, equipment: true, pets: true, shop: true, runes: true,
  monsters: false, skills: false, maps: false, apocalypse: false,
};

async function getJSON(url: string) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

let _iconCache: IconPaths | null = null;
export async function fetchIconPaths(): Promise<IconPaths> {
  if (_iconCache) return _iconCache;
  _iconCache = await getJSON(BASE_DATA + "/skill-simulator/data/icon_paths.json");
  return _iconCache as IconPaths;
}

export function resolveIconUrl(item: NormItem, iconPaths?: IconPaths | null): string | null {
  if (iconPaths && item.iconName && iconPaths[item.iconName]) {
    return BASE_IMG + iconPaths[item.iconName];
  }
  if (item.iconUrl) {
    if (item.iconUrl.startsWith("http")) return item.iconUrl;
    // server-absolute path like "/media/images/pet/x.webp" -> prefix the host
    // root, not BASE_IMG (which would double up the /media/images/ segment)
    if (item.iconUrl.startsWith("/")) return HOST + item.iconUrl;
    return BASE_IMG + item.iconUrl;
  }
  return null;
}

export function qualityInfo(quality?: number) {
  if (quality == null) return null;
  return QUALITY[quality] || { label: String(quality), color: "#888" };
}

function statRows(stats: any): DetailRow[] {
  if (!stats || typeof stats !== "object") return [];
  return Object.keys(stats)
    .filter((k) => stats[k] != null && stats[k] !== 0)
    .map((k) => ({ label: k.toUpperCase(), value: String(stats[k]) }));
}

// Coerce a raw stats object into a numeric map (drops non-numeric / zero values)
// so equipped items and cards can be summed in the builder.
function numStats(stats: any): Record<string, number> {
  if (!stats || typeof stats !== "object") return {};
  const out: Record<string, number> = {};
  for (const k of Object.keys(stats)) {
    const n = Number(stats[k]);
    if (!Number.isNaN(n) && n !== 0) out[k] = n;
  }
  return out;
}

// Cards store their bonuses as TEXT (e.g. "LUK +4~7", "Atk +9~15"), not numbers.
// Pull the flat stat bonuses out so the build calculator can sum them. Ranges
// (a~b) use the upper bound; percentage bonuses (reductions etc.) are skipped.
const CARD_STAT_KW: [RegExp, string][] = [
  [/\bstr\b|พละกำลัง|พลังกาย/i, "STR"],
  [/\bagi\b|ความว่องไว/i, "AGI"],
  [/\bvit\b|พลังชีวิต/i, "VIT"],
  [/\bint\b|สติปัญญา/i, "INT"],
  [/\bdex\b|ความแม่นยำ/i, "DEX"],
  [/\bluk\b|โชค/i, "LUK"],
  [/\bm\.?atk\b|พลังเวท/i, "MATK"],
  [/\bp\.?atk\b|\batk\b|พลังโจมตี/i, "ATK"],
];
function parseCardStats(effects: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of effects || []) {
    const m = String(line).match(/([^+]*?)\+\s*(\d+)(?:\s*~\s*(\d+))?\s*(%?)/);
    if (!m || m[4] === "%") continue;          // skip % bonuses (resist/reduction)
    const name = m[1];
    const val = Number(m[3] || m[2]);          // upper bound of a range
    if (!val) continue;
    for (const [re, key] of CARD_STAT_KW) {
      if (re.test(name)) { out[key] = (out[key] || 0) + val; break; }
    }
  }
  return out;
}

// ---- equipment schema helpers (decoded from the live equipment.js) ----
// item.itemType (numeric code) -> stable slot key
const ITEM_TYPE_SLOT: Record<number, string> = {
  51: "head", 52: "face", 53: "mouth", 54: "armor", 55: "garment",
  56: "shoes", 58: "back", 60: "accessory", 69: "offhand", 70: "weapon",
};

function stripColorTags(s: any): string {
  return String(s || "").replace(/<color[^>]*>/gi, "").replace(/<\/color>/gi, "");
}

function fmtNum(e: any): string {
  const t = Number(e);
  if (!Number.isFinite(t)) return String(e ?? "");
  if (Math.abs(t % 1) < 1e-4) return String(Math.trunc(t));
  return t.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

// Mirrors formatAttributeValue() from the site so equipment values match the game.
function formatAttr(def: any, value: any): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  const i = Number(def?.percentage_show || 0);
  const a = Number(def?.reserve_number || 0);
  const pct = (val: number, mul: number) => {
    const nn = val * mul;
    if (a === 0 || Math.floor(val) === 0) return fmtNum(Math.trunc(nn)) + "%";
    return fmtNum(Number.isInteger(nn) ? nn : Number(nn.toFixed(1))) + "%";
  };
  if (i === 0) return fmtNum(n);
  if (i === 1) return pct(n, 0.01);
  if (i === 3) return pct(n, 0.25);
  if (i === 4) { const e = 0.1 * Math.abs(n); return fmtNum(n < 0 ? -Math.trunc(e) : Math.trunc(e)); }
  if (i === 5) return fmtNum(Math.floor(0.01 * n) / 100);
  const s = 0.01 * Math.abs(n);
  return fmtNum(n < 0 ? -Math.trunc(s) : Math.trunc(s));
}

// item.stats is an array of [attrId, value]; resolve names via the attributes map.
function parseEquipStats(rawStats: any, attrs: any): { details: DetailRow[]; numeric: Record<string, number> } {
  const details: DetailRow[] = [];
  const numeric: Record<string, number> = {};
  if (!Array.isArray(rawStats)) return { details, numeric };
  for (const pair of rawStats) {
    const attrId = Array.isArray(pair) ? pair[0] : pair?.attrId;
    const value = Array.isArray(pair) ? pair[1] : pair?.value;
    const def = (attrs && (attrs[attrId] || attrs[String(attrId)])) || { name: "Attr " + attrId };
    const name = def.name || ("Attr " + attrId);
    const disp = formatAttr(def, value);
    const sign = Number(value) >= 0 ? "+" : "";
    details.push({ label: name, value: sign + disp });
    const num = Number(String(disp).replace(/[%,]/g, ""));
    if (!Number.isNaN(num) && num !== 0) numeric[name] = (numeric[name] || 0) + num;
  }
  return { details, numeric };
}

// Weapon subtypes that take both hands. Detection is by subtype NAME (localized)
// because the dataset doesn't expose a 1H/2H flag directly. Bows, katars and
// instruments are inherently two-handed; anything explicitly "two-handed" matches.
// If a weapon is misclassified, add/remove a hint here.
function isTwoHandedWeapon(name?: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  const HINTS = [
    "two-hand", "two hand", "2-hand", "2 hand", "雙手", "双手", "สองมือ", "สอง มือ", "2 มือ",
    "bow", "弓", "ธนู",
    "katar", "拳刃", "กะตาร์", "คาตาร์",
    "instrument", "樂器", "乐器", "เครื่องดนตรี",
    "huuma", "風魔", "风魔",
  ];
  return HINTS.some((h) => n.includes(h));
}

// Map a card's localized card_type_name to an equipment slot key.
function cardSlotKey(typeName?: string): string | undefined {
  if (!typeName) return undefined;
  const n = String(typeName).toLowerCase();
  const has = (...ks: string[]) => ks.some((k) => n.includes(k));
  if (has("อาวุธ", "weapon", "武器")) return "weapon";
  if (has("โล่", "shield", "副手", "盾")) return "offhand";
  if (has("เกราะ", "armor", "armour", "鎧甲", "盔甲", "防具")) return "armor";
  if (has("ผ้าคลุม", "garment", "cape", "披風", "披风")) return "garment";
  if (has("รองเท้า", "shoes", "footgear", "boots", "鞋")) return "shoes";
  if (has("เครื่องประดับ", "accessory", "飾品", "饰品")) return "accessory";
  if (has("หมวก", "ศีรษะ", "head", "頭", "头")) return "head";
  if (has("ใบหน้า", "face", "臉", "脸")) return "face";
  if (has("ปาก", "mouth", "嘴")) return "mouth";
  if (has("หลัง", "back", "背")) return "back";
  return undefined;
}

function buildFilter(
  key: string,
  label: string,
  items: NormItem[]
): FilterDef | null {
  const vals = [
    ...new Set(
      items
        .map(i => (i.tags || {})[key])
        .filter(Boolean)
    ),
  ];

  if (key === "quality") {
    vals.sort(
      (a, b) =>
        QUALITY_ORDER.indexOf(a) -
        QUALITY_ORDER.indexOf(b)
    );
  } else {
    vals.sort();
  }

  return vals.length > 1
    ? { key, label, options: vals }
    : null;
}
export async function fetchData(kind: Kind, locale: string): Promise<FetchResult> {
  let items: NormItem[] = [];

  // The "character" tab is a builder workspace, not a browsable list.
  // It does not fetch its own list of items — the CharacterBuilder component
  // pulls equipment via fetchData("equipment") and cards via fetchData("cards").
  // So we just return an empty result here to keep the tab switching consistent.
  if (kind === "character") {
    return { items: [], filters: [] };
  }

  if (kind === "cards") {
    const d = await getJSON(BASE_DATA + "/card-simulator/data/handbook_cards_" + locale + ".json");
    items = (d.cards || []).map((c: any) => {
      const effects = [...new Set((c.effect_lines || [c.effect]).filter(Boolean) as string[])];
      if (c.effect_extra && !effects.includes(c.effect_extra)) effects.push(c.effect_extra);

      return {
        id: c.id,
        title: c.name,
        subtitle: tr(c.card_type_name, locale),
        effects,
        iconName: c.item_icon,
        quality: c.quality,

        // cards store bonuses as text — parse the flat stat lines so they sum
        stats: { ...numStats(c.stats), ...parseCardStats(effects) },
        slot: tr(c.card_type_name, locale),
        slotKey: cardSlotKey(c.card_type_name),

        details: [
          {
            label: locale === "th-TH" ? "ประเภท" : "Card Type",
            value: tr(c.card_type_name, locale) || "-"
          }
        ],

        tags: {
          slot: tr(c.card_type_name, locale),
          quality: qualityTag(c.quality),
        },
      };
    });

    const filters = [
      buildFilter(
        "slot",
        locale === "th-TH" ? "ประเภท" : "Slot",
        items
      ),
      buildFilter(
        "quality",
        locale === "th-TH" ? "คุณภาพ" : "Quality",
        items
      ),
    ].filter(Boolean) as FilterDef[];
    return { items, filters };
  }

  if (kind === "equipment") {
    const d = await getJSON(BASE_DATA + "/equipment/data/equipment_" + locale + ".json");
    const attrs = d.attributes || {};
    const types = d.itemTypes || {};
    const subs = d.itemSubtypes || {};
    items = (d.items || []).map((it: any) => {
      // real schema: it.itemType (numeric) is the slot; name is in itemTypes[itemType].name
      const slotKey = ITEM_TYPE_SLOT[Number(it.itemType)] || "other";
      const typeDef = types[it.itemType] || types[String(it.itemType)];
      const slot = typeDef && typeDef.name ? stripColorTags(typeDef.name) : undefined;
      const subDef = subs[it.itemSubtype] || subs[String(it.itemSubtype)];
      const subtypeName = subDef && subDef.name ? stripColorTags(subDef.name) : undefined;
      const twoHanded = slotKey === "weapon" && isTwoHandedWeapon(subtypeName);
      const { details, numeric } = parseEquipStats(it.stats, attrs);
      // per-refine-level bonus (array of [attrId, valuePerLevel])
      const refineParsed = parseEquipStats(it.refinePerLevel, attrs);

      return {
        id: it.id,
        title: stripColorTags(it.name),
        subtitle: slot || (it.openLevel ? "Lv." + it.openLevel : undefined),
        effects: it.desc ? [stripColorTags(it.desc)] : [],
        iconName: it.icon,
        // equipment icons live under /media/images/item/<icon>.webp when not in icon_paths
        iconUrl: it.icon ? "item/" + it.icon + ".webp" : undefined,
        quality: it.quality,
        details,
        stats: numeric,
        refineStats: refineParsed.numeric,
        slot,
        slotKey,
        jobLimits: Array.isArray(it.jobLimits) ? it.jobLimits.map(Number) : [],
        jobAll: !!it.jobAll,
        subtypeName,
        twoHanded,
        reqLevel: it.openLevel ? Number(it.openLevel) : undefined,
        tags: {
          quality: qualityTag(it.quality),
          slot: slot || "",
        },
      };
    });
    const filters = [
      buildFilter(
        "slot",
        locale === "th-TH" ? "ช่อง" : "Slot",
        items
      ),
      buildFilter(
        "quality",
        locale === "th-TH" ? "คุณภาพ" : "Quality",
        items
      ),
    ].filter(Boolean) as FilterDef[];

    // job options for the class picker. Use the FULL jobs map (every class,
    // including 2nd/3rd-job advancements), not just jobFilters (base classes).
    const jobMap = d.jobs || {};
    const jobs: JobOpt[] = [];
    const pushJob = (j: any, id: number) => {
      if (j) jobs.push({ id: Number(j.id ?? id), name: stripColorTags(j.name || "Job " + id), icon: j.icon });
    };
    const jobValues = Object.values(jobMap);
    if (jobValues.length) {
      jobValues.forEach((j: any) => pushJob(j, Number(j.id)));
    } else {
      const ids: number[] = Array.from(
        new Set<number>((d.items || []).flatMap((x: any) => (x.jobLimits || []).map(Number)))
      );
      ids.forEach((id: number) => pushJob(jobMap[id] || jobMap[String(id)], id));
    }
    const seen = new Set<number>();
    const uniqJobs = jobs.filter((j) => (seen.has(j.id) ? false : (seen.add(j.id), true)));
    uniqJobs.sort((a, b) => a.id - b.id); // by id ≈ job-tree progression order

    return { items, filters, jobs: uniqJobs };
  }

  if (kind === "pets") {
    const d = await getJSON(BASE_DATA + "/pet/data/pet_library_" + locale + ".json");
    const th = locale === "th-TH";
    items = (d.pets || []).map((p: any) => {
      // quality is an object { quality, name, tag, ... }, not a bare number
      const qNum = p.quality && typeof p.quality === "object" ? p.quality.quality : p.quality;

      // combat skill names/desc live under combatSkills[].unlocks[].skill — take
      // the highest unlock (last entry) of each so we show the fully-upgraded form
      const skillLines: string[] = [];
      (p.combatSkills || []).forEach((cs: any) => {
        const unlocks = cs.unlocks || [];
        const sk = unlocks.length ? unlocks[unlocks.length - 1].skill : null;
        if (sk && sk.name) {
          const tag = cs.typeLabel ? "[" + cs.typeLabel + "] " : "";
          skillLines.push(tag + sk.name + (sk.description ? ": " + stripColorTags(sk.description) : ""));
        }
      });

      // owner bonus at max favorability: last levels[] entry that carries attrs.
      // these are the passive stats the pet grants the PLAYER (the main reason to
      // raise a pet), distinct from the pet's own battleStats below.
      const lvls = p.levels || [];
      let maxAttrs: any[] = [];
      for (let i = lvls.length - 1; i >= 0; i--) {
        const a = lvls[i] && lvls[i].skill && lvls[i].skill.attrs;
        if (a && a.length) { maxAttrs = a; break; }
      }
      const bonus = maxAttrs
        .filter((a: any) => a.target === "player")
        .map((a: any) => a.name + " " + (a.value >= 0 ? "+" : "") + a.value + (a.isPercentage ? "%" : ""));

      const effects = [...skillLines];
      if (bonus.length) {
        effects.unshift((th ? "โบนัสเจ้าของ (สูงสุด): " : "Owner bonus (max): ") + bonus.join(", "));
      }

      // battleStats is { level, stats: { atk, def, ... } } — read the inner stats
      const bs = (p.battleStats && p.battleStats.stats) || {};

      return {
        id: p.id,
        title: p.name,
        subtitle: p.maxLevel ? "Max Lv." + p.maxLevel : undefined,

        iconName: p.icon,
        iconUrl: p.iconUrl,
        quality: qNum,

        effects,

        details: statRows(bs),
        stats: numStats(bs),

        tags: {
          quality: qualityTag(qNum),
        },
      };
    });

    const filters = [
      buildFilter(
        "quality",
        locale === "th-TH" ? "คุณภาพ" : "Quality",
        items
      ),
    ].filter(Boolean) as FilterDef[];

    return { items, filters };
  }

  if (kind === "monsters") {
    const d = await getJSON(BASE_DATA + "/monster-album/data/monster_album_" + locale + ".json");
    items = (d.monsters || []).map((m: any) => {
      const drops = (m.drops || []).map((x: any) => x.name).filter(Boolean);
      const details = statRows(m.stats);
      if (m.race_name) details.unshift({ label: "Race", value: m.race_name });
      if (m.element_name) details.unshift({ label: "Element", value: m.element_name });
      details.unshift({ label: "Level", value: String(m.level) });
      return {
        id: m.id, title: m.name,
        subtitle: ["Lv." + m.level, m.race_name, m.element_name].filter(Boolean).join("  -  "),
        iconName: m.image, details,
        effects: drops.length ? ["Drops: " + drops.join(", ")] : [],
        tags: { element: m.element_name || "", race: m.race_name || "" },
      };
    });
    const filters = [
      buildFilter("element", "Element", items),
      buildFilter("race", "Race", items),
    ].filter(Boolean) as FilterDef[];
    return { items, filters };
  }

  if (kind === "skills") {
    const d = await getJSON(BASE_DATA + "/skill-simulator/data/skills_index_" + locale + ".json");
    const jmap: any = d.jobs || d || {};
    // walk parent links to build the evolution path (root → ... → job)
    const pathOf = (j: any): string => {
      const names: string[] = [];
      const seen = new Set<number>();
      let cur = j;
      while (cur && !seen.has(cur.job_id)) {
        seen.add(cur.job_id);
        names.unshift(stripColorTags(cur.job_name));
        cur = cur.parent ? (jmap[cur.parent] || jmap[String(cur.parent)]) : null;
      }
      return names.join(" → ");
    };
    items = (Object.values(jmap) as any[]).map((j) => ({
      id: j.job_id,
      title: j.job_name,
      subtitle: pathOf(j),
      iconName: j.job_icon,
      details: [
        { label: locale === "th-TH" ? "สกิลพอยต์" : "Skill points", value: String(j.skill_point_limit ?? "-") },
      ],
      tags: { points: String(j.skill_point_limit ?? ""), parent: String(j.parent ?? ""), hasSkills: j.has_skills ? "1" : "" },
    }));
    return { items, filters: [] };
  }

  if (kind === "shop") {
    const d = await getJSON(BASE_DATA + "/shop/data/shop_" + locale + ".json");
    items = (d.items || []).map((it: any) => ({
      id: it.id, title: it.name,
      subtitle: it.itemUseLevelLimit ? "Lv." + it.itemUseLevelLimit : undefined,
      effects: it.desc ? [it.desc] : [], iconName: it.iconName, quality: it.quality,
      story: it.story || undefined, tags: {
        quality: qualityTag(it.quality),
      },
    }));
    const filters = [
      buildFilter("quality", "Quality", items),
    ].filter(Boolean) as FilterDef[];

    return { items, filters };
  }

  if (kind === "maps") {
    const d = await getJSON(BASE_DATA + "/map-simulator/data/map_index_" + locale + ".json");
    items = (d.world_maps || []).map((m: any) => ({ id: m.world_map_id, title: m.name, tags: {} }));
    return { items, filters: [] };
  }

  if (kind === "apocalypse") {
    const d = await getJSON(BASE_DATA + "/apocalypse-simulator/data/apocalypse_planner_" + locale + ".json");
    items = (d.entries || []).map((e: any) => ({
      id: e.id, title: e.name,
      subtitle: [e.quality_name, e.category, e.type].filter(Boolean).join("  -  "),
      tags: { quality: e.quality_name || "", category: String(e.category || "") },
      details: [
        e.quality_name && { label: "Quality", value: e.quality_name },
        e.category && { label: "Category", value: String(e.category) },
      ].filter(Boolean) as DetailRow[],
    }));
    const filters = [
      buildFilter("quality", "Quality", items),
      buildFilter("category", "Category", items),
    ].filter(Boolean) as FilterDef[];
    return { items, filters };
  }

  if (kind === "runes") {
    const d = await getJSON(BASE_DATA + "/skill-simulator/data/engine_runes_" + locale + ".json");
    const elements = d.elements || {};
    const packages = d.effectPackages || {};   // pkgId -> [{ effectId, needLevel, weight }]
    const configs = d.effectConfigs || {};      // effectId -> { name, desc, level, color }
    // rune baseItems carry no icon field; map the element to its elemental-stone
    // icon (these keys exist in icon_paths.json). Lumina/holy has no stone icon.
    const ELEMENT_ICON: Record<number, string> = {
      1: "icon_elementstone_wind_01",   // Gale
      2: "icon_elementstone_land_01",   // Geo
      3: "icon_elementstone_water_01",  // Aqua
      4: "icon_elementstone_fire_01",   // Pyro
    };
    const vals = d.baseItems ? Object.values(d.baseItems) : [];
    items = (vals as any[]).map((r) => {
      const el = elements[r.element] || elements[String(r.element)];
      const elName = (el && el.name) || r.filterName;

      // resonance: set-bonus lines keyed by piece count (2 / 4 / 7). This is the
      // meaningful rune info; the raw element id alone isn't useful.
      const reso = (el && el.resonance) || {};
      const effects: string[] = [];
      Object.keys(reso)
        .sort((a, b) => Number(a) - Number(b))
        .forEach((cnt) => {
          (reso[cnt] || []).forEach((ln: string, i: number) => {
            const head = i === 0 ? "[" + cnt + (locale === "th-TH" ? " ชิ้น" : " pcs") + "] " : "";
            effects.push(head + stripColorTags(ln));
          });
        });

      // rollable ember effects: effectLibrary -> effectPackages -> effectConfigs.
      // the rune's quality fixes the ember level (needLevel), so group by level.
      const byLevel: Record<number, string[]> = {};
      Object.keys(r.effectLibrary || {}).forEach((pkgId) => {
        (packages[pkgId] || []).forEach((e: any) => {
          const cfg = configs[String(e.effectId)] || configs[e.effectId];
          if (!cfg) return;
          (byLevel[e.needLevel] ||= []).push(cfg.name + ": " + stripColorTags(cfg.desc));
        });
      });
      Object.keys(byLevel)
        .sort((a, b) => Number(a) - Number(b))
        .forEach((lvl) => {
          effects.push((locale === "th-TH" ? "— เอ็มเบอร์สุ่มได้ (Lv." : "— Random Ember (Lv.") + lvl + ") —");
          Array.from(new Set(byLevel[Number(lvl)])).forEach((line) => effects.push("• " + line));
        });

      return {
        id: r.id,
        title: r.filterName || elName || String(r.id),
        subtitle: elName,
        quality: r.quality,
        iconName: r.icon || ELEMENT_ICON[r.element] || undefined,
        effects,
        details: elName ? [{ label: locale === "th-TH" ? "ธาตุ" : "Element", value: elName }] : [],
        tags: { quality: qualityTag(r.quality), element: elName || "" },
      };
    });
    const filters = [
      buildFilter("element", locale === "th-TH" ? "ธาตุ" : "Element", items),
      buildFilter("quality", locale === "th-TH" ? "คุณภาพ" : "Quality", items),
    ].filter(Boolean) as FilterDef[];
    return { items, filters };
  }

  return { items: [], filters: [] };
}

/* =========================================================================
 * Character build support
 * ========================================================================= */

export interface CharacterBuild {
  name: string;
  // editable starting stats (e.g. base STR/AGI or HP/ATK — whatever your data uses)
  baseStats: Record<string, number>;
  // slot label (localized, from item.slot) -> equipped item
  equipment: Record<string, NormItem>;
  // cards currently inserted (kept as a flat list in v1)
  cards: NormItem[];
}

export function emptyBuild(name = "New Build"): CharacterBuild {
  return { name, baseStats: {}, equipment: {}, cards: [] };
}

// Sum the numeric `stats` of the base + every equipped item + every card.
export function computeBuildStats(build: CharacterBuild): Record<string, number> {
  const total: Record<string, number> = { ...build.baseStats };

  const add = (s?: Record<string, number>) => {
    if (!s) return;
    for (const k of Object.keys(s)) {
      total[k] = (total[k] || 0) + s[k];
    }
  };

  Object.values(build.equipment).forEach((it) => add(it?.stats));
  build.cards.forEach((c) => add(c.stats));

  // drop zeros for a cleaner display
  for (const k of Object.keys(total)) {
    if (total[k] === 0) delete total[k];
  }
  return total;
}

/* ---- Equipment slots: stable keys + fixed order, independent of locale ---- */

export interface SlotDef { key: string; order: number; aliases: string[]; }

// `aliases` lists the slot tokens seen across en-US / zh-TW / th-TH data files.
// NOTE: the English aliases are best guesses — confirm/extend them against the
// real equipment_en-US.json (and add any slots your data has that aren't here).
export const SLOT_DEFS: SlotDef[] = [
  { key: "head",      order: 0,  aliases: ["頭飾", "ศีรษะ", "Head", "Headgear", "Upper Headgear"] },
  { key: "face",      order: 1,  aliases: ["臉飾", "ใบหน้า", "Face", "Mid Headgear"] },
  { key: "mouth",     order: 2,  aliases: ["嘴飾", "ปาก", "Mouth", "Lower Headgear"] },
  { key: "weapon",    order: 3,  aliases: ["武器", "อาวุธ", "Weapon"] },
  { key: "offhand",   order: 4,  aliases: ["副手", "มือรอง", "Off-hand", "Offhand", "Shield"] },
  { key: "armor",     order: 5,  aliases: ["鎧甲", "เกราะ", "Armor", "Armour", "Body"] },
  { key: "garment",   order: 6,  aliases: ["披風", "ผ้าคลุม", "Garment", "Cape", "Cloak"] },
  { key: "back",      order: 7,  aliases: ["背飾", "หลัง", "Back"] },
  { key: "tail",      order: 8,  aliases: ["尾飾", "หาง", "Tail"] },
  { key: "shoes",     order: 9,  aliases: ["鞋子", "รองเท้า", "Shoes", "Footgear", "Boots"] },
  { key: "accessory", order: 10, aliases: ["飾品", "เครื่องประดับ", "Accessory", "Accessories"] },
];

const _slotAlias: Record<string, SlotDef> = {};
for (const def of SLOT_DEFS) {
  for (const a of def.aliases) _slotAlias[a.toLowerCase()] = def;
}

// Map any localized slot string to a stable key. Unknown values pass through
// unchanged so nothing is silently dropped (it just sorts to the end).
export function canonicalSlot(raw?: string): string {
  if (!raw) return "other";
  return _slotAlias[String(raw).toLowerCase()]?.key || String(raw);
}

export function slotOrder(key: string): number {
  const def = SLOT_DEFS.find((d) => d.key === key);
  return def ? def.order : 99;
}

// Group equipment by its STABLE slot key (so a build keyed by slot survives a
// locale switch, and ordering stays consistent across languages).
export function groupBySlot(items: NormItem[]): Record<string, NormItem[]> {
  const out: Record<string, NormItem[]> = {};
  for (const it of items) {
    const key = it.slotKey || it.slot || "other";
    (out[key] ||= []).push(it);
  }
  return out;
}

export interface SlotGroup { key: string; label: string; items: NormItem[]; }

// Ready-to-render slot groups: stable key, localized display label (taken from
// the items themselves), ordered by SLOT_DEFS. Use this in the builder UI.
export function orderedSlots(items: NormItem[]): SlotGroup[] {
  const groups = groupBySlot(items);
  return Object.keys(groups)
    .map((key) => ({
      key,
      label: groups[key][0]?.slot || key,
      items: groups[key],
    }))
    .sort((a, b) => slotOrder(a.key) - slotOrder(b.key) || a.label.localeCompare(b.label));
}

/* ============================================================================
 *  SKILL TREE (real data for the skill planner)
 *  index:   /skill-simulator/data/skills_index_<locale>.json
 *  per-job: /skill-simulator/data/jobs_<locale>/<job_id>.json
 * ========================================================================== */
export const SKILL_TIER_POOLS = { novice: 9, first: 40, second: 40, third: 70 };
export const skillUnlockLimit = (jobId: number) => (Number(jobId) === 101 ? 9 : 40);

export interface JobNode {
  id: number; name: string; icon?: string;
  parent: number; children: number[];
  points: number; hasSkills: boolean;
}
export interface SkillNode {
  kindId: string; name: string; icon?: string; position: number;
  maxLevel: number; naturalMax: number; preSkill: number[]; passive: boolean;
  levels?: Record<string, any>;
}

export async function fetchSkillIndex(locale: string): Promise<Record<number, JobNode>> {
  const d = await getJSON(BASE_DATA + "/skill-simulator/data/skills_index_" + locale + ".json");
  const jmap: any = d.jobs || d || {};
  const out: Record<number, JobNode> = {};
  Object.values(jmap).forEach((j: any) => {
    if (j == null || j.job_id == null) return;
    out[Number(j.job_id)] = {
      id: Number(j.job_id),
      name: stripColorTags(j.job_name || j.name || "Job " + j.job_id),
      icon: j.job_icon,
      parent: Number(j.parent) || 0,
      children: Array.isArray(j.children) ? j.children.map(Number) : [],
      points: Number(j.skill_point_limit) || 0,
      hasSkills: !!j.has_skills,
    };
  });
  return out;
}

// root -> target list of job ids (walks parent links)
export function skillPathTo(index: Record<number, JobNode>, target: number): number[] {
  const path: number[] = [];
  let cur: number | undefined = Number(target);
  const seen = new Set<number>();
  while (cur && index[cur] && !seen.has(cur)) {
    seen.add(cur);
    path.unshift(cur);
    cur = index[cur].parent;
    if (!cur) break;
  }
  return path.length ? path : [101];
}

// every job in the path (incl. self) must have skills (matches the site's filter)
export function jobPathHasSkills(index: Record<number, JobNode>, jobId: number): boolean {
  const p = skillPathTo(index, jobId);
  return p.length > 0 && p.every((id) => index[id] && index[id].hasSkills);
}

export async function fetchJobSkills(jobId: number | string, locale: string): Promise<{ skills: SkillNode[]; jobName: string }> {
  const d = await getJSON(BASE_DATA + "/skill-simulator/data/jobs_" + locale + "/" + jobId + ".json");
  const job = d.job || d;
  const raw = job.skills || {};
  const skills: SkillNode[] = Object.entries(raw).map(([kindId, s]: [string, any]) => ({
    kindId,
    name: stripColorTags(s.name || s.skilldes || "Skill " + kindId),
    icon: s.icon,
    position: Number.isFinite(Number(s.position)) && Number(s.position) > 0 ? Number(s.position) : 999,
    maxLevel: Number(s.max_level) || Number(s.natural_max_level) || 10,
    naturalMax: Number(s.natural_max_level) || Number(s.max_level) || 10,
    preSkill: Array.isArray(s.pre_skill) ? s.pre_skill.map(Number) : [],
    passive: Number(s.skill_type) === 2,
    levels: s.levels,
  }));
  skills.sort((a, b) => a.position - b.position || Number(a.kindId) - Number(b.kindId));
  return { skills, jobName: stripColorTags(job.job_name || "") };
}