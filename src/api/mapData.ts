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

export interface CardPointEntry {
  id: number | string;
  sceneId: number;
  mapRegionName: string;
  objectPos: [number, number, number];
  markIcon: string;
  questName?: string;
  rewardItems: CardRewardItem[];
}

interface CardPointsRaw {
  meta: { infoType: string; infoTypeEn: string; typeIcon: string };
  data: Record<string, any[]>;
}

// A single plottable point on a map: either a monster spawn spot or a card
// collection point, normalized to one shape so the screen can render + filter
// them uniformly.
export type MapLayer = "mvp" | "elite" | "mini" | "card";

export interface MapMarker {
  layer: MapLayer;
  key: string;           // stable id for React lists
  name: string;
  icon: string;          // /media/images/map_mark/<icon>.webp
  portrait?: string;     // /media/images/monster/<portrait>.webp (monsters only)
  x: number;             // world X
  z: number;             // world Z
  reward?: CardRewardItem[];
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

const _cardCache = new Map<string, CardPointsRaw>();
async function fetchCardPointsRaw(locale: string): Promise<CardPointsRaw> {
  const cached = _cardCache.get(locale);
  if (cached) return cached;
  const d = await getJSON(
    BASE_DATA + "/map-simulator/data/interactive_placing_" + locale + "/monster_cards.json"
  );
  _cardCache.set(locale, d);
  return d;
}

// Group every monster spawn + card point by the scene it actually renders on
// (each spawn marker / card entry carries its own scene_id), rather than by
// the upstream "view" bucket a scene was indexed under — a view can bundle a
// city with its surrounding field maps, which would otherwise mix markers
// from neighboring scenes onto the wrong background image.
export async function fetchMarkersByScene(locale: string): Promise<Map<number, MapMarker[]>> {
  const [spawns, cards] = await Promise.all([
    fetchMonsterSpawnsRaw(locale),
    fetchCardPointsRaw(locale).catch(() => ({ meta: { infoType: "", infoTypeEn: "", typeIcon: "" }, data: {} } as CardPointsRaw)),
  ]);

  const byScene = new Map<number, MapMarker[]>();
  const push = (sceneId: number, m: MapMarker) => {
    const arr = byScene.get(sceneId);
    if (arr) arr.push(m);
    else byScene.set(sceneId, [m]);
  };

  for (const view of Object.values(spawns.views || {})) {
    for (const group of view.monsters || []) {
      if (group.family !== "elite" && group.family !== "mini" && group.family !== "mvp") continue;
      group.markers.forEach((mk, i) => {
        push(mk.scene_id, {
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

  for (const arr of Object.values(cards.data || {})) {
    for (const e of arr || []) {
      const sceneId = Number(e.sceneId);
      const pos = e.objectPos;
      if (!Number.isFinite(sceneId) || !Array.isArray(pos)) continue;
      push(sceneId, {
        layer: "card",
        key: "card_" + e.id,
        name: e.quest?.name || cards.meta?.infoTypeEn || "Card",
        icon: e.markIcon || cards.meta?.typeIcon || "icon_map_mark_kpmw",
        x: Number(pos[0]),
        z: Number(pos[2]),
        reward: e.rewardItems || e.quest?.rewardItems || [],
      });
    }
  }

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
