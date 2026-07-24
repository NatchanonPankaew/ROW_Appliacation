// Map viewer data: world map list + per-scene monster spawn points + card
// collection points, mirrored from roworlddb.com's map-simulator (see
// scripts/sync-data.mjs). Coordinate math mirrors the site's own
// worldXZToNaturalPixels() so markers land in the same spot as upstream.
import { BASE_DATA, BASE_IMG, getJSON } from "./roworlddb";
import { COMMUNITY_MYSTERY_CHESTS, CommunityChestPoint } from "./communityMysteryChests";

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
  | "expl_chest" | "guard_chest" | "monster_chest" | "mystery_chest" | "landmark" | "kafra"
  | "observation" | "private_chef" | "quest_mark" | "rw_quest";

// interactive_placing file name for each placing-based layer (everything
// except the monster-spawn families).
const PLACING_FILES: Partial<Record<MapLayer, string>> = {
  card: "monster_cards",
  recipe: "cooking_recipes",
  expl_chest: "expl_chest",
  guard_chest: "guard_chest",
  monster_chest: "monster_chest",
  mystery_chest: "mystery_chest",
  landmark: "landmark_photography",
  kafra: "kafra_service",
  observation: "jd",
  private_chef: "private_chef",
  quest_mark: "quest_mark_008",
  rw_quest: "rw_quest",
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
  reqLevel?: number;     // base level required to turn in/collect (card/recipe/quest entries)
  speciesKey?: string;   // stable per-species id (mvp/elite/mini only) for the breakdown list
  mysterySubtype?: CommunityChestPoint["subtype"]; // known weather sub-type (mystery_chest only) — shown in the tap modal, not on the pin
}

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
  const [idx, spawns, ...placings] = await Promise.all([
    fetchMapIndex(locale),
    fetchMonsterSpawnsRaw(locale),
    ...placingLayers.map((layer) => fetchPlacingRaw(locale, PLACING_FILES[layer]!)),
  ]);

  // Some placing entries carry a raw scene_id that's actually a shared
  // "connector" corridor between two named areas (e.g. Geffen River's chests
  // are filed under scene 10005, the Prontera<->Geffen transit scene, not
  // Geffen River's own 10141) — the same raw id can legitimately belong to
  // different regions depending on the entry. mapRegionName is the reliable
  // per-entry signal for this: when it matches a real world-map name, use
  // that map's scene id outright, ahead of the (raw-id -> one view) fallback.
  const nameToScene = new Map<string, number>();
  for (const wm of idx.world_maps || []) {
    if (wm.name) nameToScene.set(wm.name, wm.center_scene_id);
  }

  // Some placing entries' sceneId isn't a real scene/map_config key at all —
  // it's actually a background-image resource number (e.g. 10005, which
  // matches no map_config, but map_configs 10141 "Geffen River" and 10142 both
  // use pic_res "icon_map_10005"). Reverse pic_res -> config keys so those
  // entries resolve to the map that actually shows them, instead of falling
  // all the way through to a bucket with no background image (silently
  // dropping the marker, as happened to Geffen River's Ambernite/Savage Babe
  // cards and its chests/landmarks/kafra points).
  const validSceneIds = new Set(Object.keys(idx.map_configs || {}).map(Number));
  const worldMapSceneIds = new Set((idx.world_maps || []).map((wm) => wm.center_scene_id));
  const picResGroups = new Map<number, number[]>();
  for (const [key, cfg] of Object.entries(idx.map_configs || {})) {
    const m = /^icon_map_(\d+)$/.exec(cfg.pic_res || "");
    if (!m) continue;
    const picNum = Number(m[1]);
    const group = picResGroups.get(picNum);
    if (group) group.push(Number(key));
    else picResGroups.set(picNum, [Number(key)]);
  }
  const resolveUnknownScene = (rawSceneId: number): number => {
    const group = picResGroups.get(rawSceneId);
    if (!group) return rawSceneId;
    return group.find((k) => worldMapSceneIds.has(k)) ?? group[0];
  };

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
          speciesKey: group.key,
        });
      });
    }
  }

  // Community mystery-chest data (see communityMysteryChests.ts) pins each
  // chest with its confirmed weather-based sub-type, but its point count
  // doesn't match roworlddb's own mystery_chest.json 1:1 for every region
  // (calibration drift), so it's used to *enrich* the authoritative points
  // (nearest match within 20 world units) rather than replace them — that
  // keeps the on-screen count identical to the live site while still telling
  // players the specific type wherever a confident match exists.
  const communityByScene = new Map<number, { subtype: CommunityChestPoint["subtype"]; x: number; z: number; used: boolean }[]>();
  for (const c of COMMUNITY_MYSTERY_CHESTS) {
    const arr = communityByScene.get(c.sceneId);
    const entry = { ...c, used: false };
    if (arr) arr.push(entry);
    else communityByScene.set(c.sceneId, [entry]);
  }
  const MYSTERY_MATCH_RADIUS = 20;
  const findMysteryMatch = (sceneId: number, x: number, z: number) => {
    const cands = communityByScene.get(sceneId);
    if (!cands) return null;
    let best: (typeof cands)[number] | null = null;
    let bestDist = MYSTERY_MATCH_RADIUS;
    for (const c of cands) {
      if (c.used) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    if (best) best.used = true;
    return best;
  };

  const th = locale === "th-TH";

  placingLayers.forEach((layer, layerIdx) => {
    const raw = placings[layerIdx];
    for (const arr of Object.values(raw.data || {})) {
      for (const e of arr || []) {
        const rawSceneId = Number(e.sceneId);
        const pos = e.objectPos;
        if (!Number.isFinite(rawSceneId) || !Array.isArray(pos)) continue;
        const x = Number(pos[0]), z = Number(pos[2]);
        if (x === 0 && z === 0) continue; // disabled/placeholder entries
        const sceneId =
          nameToScene.get(e.mapRegionName) ??
          sceneToView.get(rawSceneId) ??
          (validSceneIds.has(rawSceneId) ? rawSceneId : resolveUnknownScene(rawSceneId));
        const label =
          layer === "card" || layer === "quest_mark" || layer === "rw_quest"
            ? (e.quest?.name || raw.meta?.infoTypeEn || "Card")
            : layer === "recipe"
            ? (e.cookingRecipe?.[1] || raw.meta?.infoTypeEn || "Recipe")
            : layer === "private_chef"
            ? (e.cookingStarter?.[1] || raw.meta?.infoTypeEn || "Private Chef")
            : (raw.meta?.infoType || raw.meta?.infoTypeEn || layer);
        const match = layer === "mystery_chest" ? findMysteryMatch(sceneId, x, z) : null;
        push(sceneId, {
          layer,
          key: layer + "_" + e.id,
          // The map pin always keeps the chest icon and generic name (never
          // swaps to the weather emoji) so a scan of the map still reads as
          // "chest here" — the specific sub-type, when known, only surfaces
          // as extra detail inside the tap modal.
          name: label,
          icon: e.markIcon || raw.meta?.typeIcon || "icon_map_mark_kpmw",
          mysterySubtype: match?.subtype,
          x,
          z,
          reward: e.rewardItems || e.quest?.rewardItems || [],
          reqLevel: e.quest?.requirements?.baseLevel ?? e.cookingRequirements?.baseLevel,
        });
      }
    }
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
