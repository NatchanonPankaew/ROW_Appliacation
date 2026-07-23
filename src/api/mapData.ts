// Map viewer data: world map list + per-scene monster spawn points + card
// collection points, mirrored from roworlddb.com's map-simulator (see
// scripts/sync-data.mjs). Coordinate math mirrors the site's own
// worldXZToNaturalPixels() so markers land in the same spot as upstream.
import { BASE_DATA, BASE_IMG, getJSON } from "./roworlddb";

export interface WorldMapEntry {
  world_map_id: number;
  name: string;
  center_scene_id: number;
  pic_res: string;
}

export interface MapConfig {
  map_id: number;
  name: string | null;
  pic_res: string;
  scene_center_xz: [number, number];
  scene_extent_xz: [number, number];
}

export interface MapIndex {
  world_maps: WorldMapEntry[];
  map_configs: Record<string, MapConfig>;
}

export type MonsterFamily = "mvp" | "elite" | "mini" | "vale" | "rainbow";

export interface MonsterMarkerPos { scene_id: number; x: number; y: number; z: number; }

export interface MonsterSpawnGroup {
  key: string;
  monster_id: number;
  family: MonsterFamily;
  icon: string;
  name: string;
  total_spawn_spots: number;
  markers: MonsterMarkerPos[];
  image?: string;
}

interface MonsterSpawnsRaw {
  views: Record<string, { map_id: number; monsters: MonsterSpawnGroup[] }>;
}

export interface CardRewardItem { itemId: number; icon: string; iconPath: string; count: number; }

// Shared shape of every interactive_placing/<file>.json (cards, chests,
// landmarks, kafra service...): a locale-specific label/icon plus entries
// grouped by region name.
interface PlacingRaw {
  meta: { infoType: string; infoTypeEn: string; typeIcon: string };
  data: Record<string, any[]>;
}

// A single plottable point on a map: either a monster spawn spot, a card
// collection point, a chef recipe pickup, or one of the exploration-reward
// placing categories (chests / landmarks / kafra), normalized to one shape
// so the screen can render + filter them uniformly.
export type MapLayer =
  | "mvp" | "elite" | "mini" | "card" | "recipe"
  | "expl_chest" | "guard_chest" | "monster_chest" | "mystery_chest" | "landmark" | "kafra";

// interactive_placing file name for each placing-based layer (everything
// except the monster-spawn families and the hand-compiled recipe list).
const PLACING_FILES: Partial<Record<MapLayer, string>> = {
  card: "monster_cards",
  expl_chest: "expl_chest",
  guard_chest: "guard_chest",
  monster_chest: "monster_chest",
  mystery_chest: "mystery_chest",
  landmark: "landmark_photography",
  kafra: "kafra_service",
};

export interface MapMarker {
  layer: MapLayer;
  key: string;           // stable id for React lists
  name: string;
  icon?: string;         // /media/images/map_mark/<icon>.webp
  emoji?: string;        // used instead of icon when there's no in-game mark icon for this layer
  portrait?: string;     // /media/images/monster/<portrait>.webp (monsters only)
  x: number;             // world X
  z: number;             // world Z
  reward?: CardRewardItem[];
}

// Chef recipe pickup points. roworlddb.com's own map tool doesn't track this
// collectible (only cards + monster spawns), so this list is hand-compiled
// from the community exploration write-up for "RO: World Tour" (仙境傳說：世界之旅) —
// https://forum.gamer.com.tw/C.php?bsn=83054&snA=1890 ("食譜＆卡片之神探索整理",
// 17 recipes / 40 cards / 57 points total; the 40 cards match monster_cards.json
// exactly, confirming the recipe list is the missing complement). Coordinates
// are the community's raw (X,Y) which is the game's worldX/worldZ convention.
interface RecipePoint { sceneId: number; nameTh: string; nameEn: string; x: number; z: number; }
const RECIPE_POINTS: RecipePoint[] = [
  { sceneId: 70077, nameTh: "สูตรพายฟักทอง", nameEn: "Pumpkin Pie Recipe", x: 184, z: 181 },
  { sceneId: 104, nameTh: "สลัดเขียว", nameEn: "Green Salad", x: 144, z: 96 },
  { sceneId: 104, nameTh: "สูตรอาหาร STR", nameEn: "Strength Recipe", x: 58, z: 157 },
  { sceneId: 104, nameTh: "สูตรอาหาร AGI", nameEn: "Agility Recipe", x: 58, z: 162 },
  { sceneId: 101, nameTh: "ซุปปลาสีฟ้า", nameEn: "Blue Fish Soup", x: 686, z: 852 },
  { sceneId: 101, nameTh: "สูตรไวน์องุ่น", nameEn: "Wine Recipe", x: 428, z: 428 },
  { sceneId: 101, nameTh: "เยลลี่เชอร์รี่", nameEn: "Cherry Jelly", x: 575, z: 313 },
  { sceneId: 107, nameTh: "สูตรซุปเวทมนตร์สด", nameEn: "Fresh Mana Soup Recipe", x: 643, z: 318 },
  { sceneId: 107, nameTh: "อาหารบำรุงธาตุ VIT", nameEn: "Vitality Dish", x: 132, z: 74 },
  { sceneId: 106, nameTh: "สูตรซุปเวทมนตร์ข้น", nameEn: "Thick Mana Soup Recipe", x: 198, z: 129 },
  { sceneId: 106, nameTh: "สูตรซุปหนวดปลาหมึก", nameEn: "Squid Tentacle Soup Recipe", x: 99, z: 99 },
  { sceneId: 102, nameTh: "โจ๊กปูม่วง", nameEn: "Purple Crab Porridge", x: 458, z: 462 },
  { sceneId: 102, nameTh: "สูตรอาหาร STR ขั้นสูงสุด", nameEn: "Premium Strength Recipe", x: 137, z: 590 },
  { sceneId: 103, nameTh: "สูตรเค้กมันเทศ", nameEn: "Sweet Potato Cake Recipe", x: 510, z: 408 },
  { sceneId: 103, nameTh: "สูตรหม้อไฟปลาแดง", nameEn: "Red Fish Stew Recipe", x: 240, z: 425 },
  { sceneId: 103, nameTh: "ซุปอาหารทะเลแม่น้ำ", nameEn: "River Seafood Soup", x: 529, z: 548 },
  { sceneId: 103, nameTh: "พุดดิ้งแอปเปิ้ล", nameEn: "Apple Pudding", x: 682, z: 517 },
];

const _mapIndexCache = new Map<string, MapIndex>();
export async function fetchMapIndex(locale: string): Promise<MapIndex> {
  const cached = _mapIndexCache.get(locale);
  if (cached) return cached;
  const d = await getJSON(BASE_DATA + "/map-simulator/data/map_index_" + locale + ".json");
  _mapIndexCache.set(locale, d);
  return d as MapIndex;
}

const _spawnCache = new Map<string, MonsterSpawnsRaw>();
async function fetchMonsterSpawnsRaw(locale: string): Promise<MonsterSpawnsRaw> {
  const cached = _spawnCache.get(locale);
  if (cached) return cached;
  const d = await getJSON(BASE_DATA + "/map-simulator/data/map_monster_spawns_" + locale + ".json");
  _spawnCache.set(locale, d);
  return d;
}

const _placingCache = new Map<string, PlacingRaw>();
async function fetchPlacingRaw(locale: string, file: string): Promise<PlacingRaw> {
  const key = locale + "/" + file;
  const cached = _placingCache.get(key);
  if (cached) return cached;
  const d = await getJSON(
    BASE_DATA + "/map-simulator/data/interactive_placing_" + locale + "/" + file + ".json"
  ).catch(() => ({ meta: { infoType: "", infoTypeEn: "", typeIcon: "" }, data: {} } as PlacingRaw));
  _placingCache.set(key, d);
  return d;
}

// Group every monster spawn + placing point by the upstream "view" a scene
// belongs to, not by each marker's own raw scene_id. A view bundles a city
// with its surrounding, seamlessly-connected field maps (e.g. Geffen's city +
// its 6 gate/bank/wilds scenes all share one coordinate space and one view
// key, "107"): the site shows them together on that region's single wide
// background image rather than as separate maps per gate. Splitting by raw
// scene_id would fragment one region into a dozen near-empty picker entries.
export async function fetchMarkersByScene(locale: string): Promise<Map<number, MapMarker[]>> {
  const placingLayers = Object.keys(PLACING_FILES) as MapLayer[];
  const [spawns, ...placings] = await Promise.all([
    fetchMonsterSpawnsRaw(locale),
    ...placingLayers.map((layer) => fetchPlacingRaw(locale, PLACING_FILES[layer]!)),
  ]);

  const byScene = new Map<number, MapMarker[]>();
  const push = (sceneId: number, m: MapMarker) => {
    const arr = byScene.get(sceneId);
    if (arr) arr.push(m);
    else byScene.set(sceneId, [m]);
  };

  // Every raw scene_id a view's markers ever reference belongs to that view's
  // region (e.g. 10702-10709 -> 107 Geffen). Placing points reuse this map so
  // one sitting in one of those same field scenes folds into the region too,
  // instead of becoming its own near-empty picker entry.
  const sceneToView = new Map<number, number>();

  for (const [viewKey, view] of Object.entries(spawns.views || {})) {
    const viewId = Number(viewKey);
    for (const group of view.monsters || []) {
      if (group.family !== "elite" && group.family !== "mini" && group.family !== "mvp") continue;
      group.markers.forEach((mk, i) => {
        sceneToView.set(mk.scene_id, viewId);
        push(viewId, {
          layer: group.family as MapLayer,
          key: group.key + "_" + i,
          name: group.name,
          icon: group.icon,
          portrait: group.image,
          x: mk.x,
          z: mk.z,
        });
      });
    }
  }

  placingLayers.forEach((layer, idx) => {
    const raw = placings[idx];
    for (const arr of Object.values(raw.data || {})) {
      for (const e of arr || []) {
        const rawSceneId = Number(e.sceneId);
        const pos = e.objectPos;
        if (!Number.isFinite(rawSceneId) || !Array.isArray(pos)) continue;
        const sceneId = sceneToView.get(rawSceneId) ?? rawSceneId;
        const label = layer === "card"
          ? (e.quest?.name || raw.meta?.infoTypeEn || "Card")
          : (raw.meta?.infoType || raw.meta?.infoTypeEn || layer);
        push(sceneId, {
          layer,
          key: layer + "_" + e.id,
          name: label,
          icon: e.markIcon || raw.meta?.typeIcon || "icon_map_mark_kpmw",
          x: Number(pos[0]),
          z: Number(pos[2]),
          reward: e.rewardItems || e.quest?.rewardItems || [],
        });
      }
    }
  });

  const th = locale === "th-TH";
  RECIPE_POINTS.forEach((r, i) => {
    push(r.sceneId, {
      layer: "recipe",
      key: "recipe_" + i,
      name: th ? r.nameTh : r.nameEn,
      emoji: "📜",
      x: r.x,
      z: r.z,
    });
  });

  return byScene;
}

export function mapMarkIconUrl(icon: string): string {
  return BASE_IMG + "map_mark/" + icon + ".webp";
}
export function monsterPortraitUrl(portrait: string): string {
  return BASE_IMG + "monster/" + portrait + ".webp";
}
export function mapBackgroundUrl(picRes: string): string {
  return BASE_IMG + "map/" + picRes + ".webp";
}
export function rewardItemIconUrl(iconPath: string): string {
  return iconPath.startsWith("http") ? iconPath : iconPath.startsWith("/") ? iconPath : BASE_IMG + iconPath;
}

// World (X,Z) -> fraction (0..1) of the map image, matching the site's
// worldXZToNaturalPixels(): image left/top edge = scene_center - extent/2,
// Z is flipped (world Z increases "up", image Y increases downward).
export function worldToImageFraction(cfg: MapConfig, x: number, z: number): { left: number; top: number } {
  const [cx, cz] = cfg.scene_center_xz;
  const [ex, ez] = cfg.scene_extent_xz;
  const left0 = cx - ex / 2;
  const top0 = cz - ez / 2;
  return {
    left: (x - left0) / ex,
    top: 1 - (z - top0) / ez,
  };
}
