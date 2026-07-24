import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Modal,
  TextInput, FlatList, ActivityIndicator, useWindowDimensions, Platform, PanResponder,
} from "react-native";
import {
  fetchMapIndex, fetchMarkersByScene, mapMarkIconUrl, monsterPortraitUrl,
  mapBackgroundUrl, rewardItemIconUrl, worldToImageFraction,
  MapConfig, MapMarker, MapLayer,
} from "../api/mapData";
import { loadJSON, saveJSON } from "../api/storage";
import { MYSTERY_SUBTYPE_INFO } from "../api/communityMysteryChests";

const COLLECTED_STORAGE_KEY = "row_map_collected_points";

const LOCALES = ["en-US", "th-TH", "zh-TW"];

const LAYER_DEFS: { key: MapLayer; th: string; en: string; color: string }[] = [
  { key: "card", th: "การ์ด", en: "Cards", color: "#E8B339" },
  { key: "recipe", th: "สูตรอาหาร", en: "Recipes", color: "#8B5E3C" },
  { key: "expl_chest", th: "หีบสำรวจ", en: "Expl. Chest", color: "#4F8EE6" },
  { key: "guard_chest", th: "หีบผู้พิทักษ์", en: "Guard Chest", color: "#607D8B" },
  { key: "monster_chest", th: "หีบมอนสเตอร์", en: "Monster Chest", color: "#D2691E" },
  { key: "mystery_chest", th: "หีบลึกลับ", en: "Mystery Chest", color: "#6A1B9A" },
  { key: "landmark", th: "ถ่ายรูป", en: "Landmark", color: "#EC407A" },
  { key: "kafra", th: "คาฟรา", en: "Kafra", color: "#26A69A" },
  { key: "observation", th: "จุดสังเกต", en: "Observation Point", color: "#FFA000" },
  { key: "private_chef", th: "เชฟส่วนตัว", en: "Private Chef", color: "#C2185B" },
  { key: "quest_mark", th: "เควสเรื่องราว", en: "Story Quest", color: "#7CB342" },
  { key: "rw_quest", th: "เควสภารกิจ", en: "World Tour Quest", color: "#00897B" },
  { key: "mvp", th: "MVP", en: "MVP", color: "#A65CD6" },
  { key: "elite", th: "Elite", en: "Elite", color: "#E0533D" },
  { key: "mini", th: "Mini", en: "Mini", color: "#5DBB63" },
];

// These 3 layers lump every distinct monster species under one combined
// count — tapping the chip's expand button opens a per-species breakdown
// (own icon/name/count, individually toggleable) instead of one opaque total.
const SPECIES_LAYERS: MapLayer[] = ["mvp", "elite", "mini"];

interface SpeciesEntry { key: string; name: string; icon?: string; portrait?: string; total: number; done: number; }

interface PickableMap { sceneId: number; name: string; picRes: string; }

// Mystery chests come in 6 known variants gated by weather/condition, but
// roworlddb's data has no per-point type tag (community guides only show
// them via screenshots, not machine-readable coordinates) — so rather than
// guess which of the 91 points is which, the modal just explains the 6
// possibilities. See forum.gamer.com.tw/C.php?bsn=83054&snA=1017.
const MYSTERY_CHEST_TYPES = [
  { emoji: "☀️", th: "อุปกรณ์รับแดด — โผล่เฉพาะตอนแดดออก ต้องชาร์จพลังแดดก่อน", en: "Sunlight device — appears only in sunny weather, needs charging first" },
  { emoji: "❄️", th: "กวาดหิมะ — หัวหิมะโผล่ตอนหิมะตก", en: "Snow clearing — snowman head appears in snowy weather" },
  { emoji: "💧", th: "กล่องลอยน้ำ — โผล่ตอนฝนตก เก็บไม่ทันจะแตกหาย", en: "Water balloon box — appears in rain, pops if not collected in time" },
  { emoji: "🏔️", th: "หีบที่สูง — อยู่บนที่ไม่ใช่พื้นราบ", en: "High place — sits somewhere off the ground" },
  { emoji: "🦋", th: "ผีเสื้อลึกลับ — เดินตามผีเสื้อจนสุดทาง", en: "Mystery butterfly — follow it to the end" },
  { emoji: "👹", th: "มอนสเตอร์เฝ้าหีบ — ฆ่ามอนที่เฝ้าก่อนถึงจะเปิดได้", en: "Guardian monster — defeat the guard to open it" },
];

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;
// Start already zoomed in past the cover-fit minimum (100%) — showing the
// whole map at once made every marker read tiny; players can still zoom
// back out to 50% themselves for an overview.
const DEFAULT_ZOOM = 2;

function MapPickerModal({
  maps, locale, onPick, onClose,
}: { maps: PickableMap[]; locale: string; onPick: (m: PickableMap) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const th = locale === "th-TH";
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return maps;
    return maps.filter((m) => m.name.toLowerCase().includes(t));
  }, [maps, q]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.pickerCard}>
          <View style={styles.modalHandle} />
          <Text style={styles.pickerTitle}>{th ? "เลือกแมพ" : "Choose map"}</Text>
          <TextInput
            style={styles.search}
            placeholder={th ? "ค้นหาชื่อแมพ" : "Search map name"}
            placeholderTextColor="#8A97AD"
            value={q}
            onChangeText={setQ}
          />
          <FlatList
            data={filtered}
            keyExtractor={(m) => String(m.sceneId)}
            style={{ marginTop: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickerRow} onPress={() => onPick(item)}>
                <Image source={{ uri: mapBackgroundUrl(item.picRes) }} style={styles.pickerThumb} resizeMode="cover" />
                <Text style={styles.pickerRowText} numberOfLines={1}>{item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>{th ? "ไม่พบแมพ" : "No maps found"}</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

function SpeciesBreakdownModal({
  layer, locale, species, hiddenSpecies, onToggleSpecies, onClose,
}: {
  layer: MapLayer; locale: string; species: Map<string, SpeciesEntry>;
  hiddenSpecies: Record<string, boolean>; onToggleSpecies: (key: string) => void; onClose: () => void;
}) {
  const th = locale === "th-TH";
  const layerDef = LAYER_DEFS.find((l) => l.key === layer)!;
  const list = useMemo(() => [...species.values()].sort((a, b) => a.name.localeCompare(b.name)), [species]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.pickerCard}>
          <View style={styles.modalHandle} />
          <Text style={styles.pickerTitle}>{th ? layerDef.th : layerDef.en}</Text>
          <FlatList
            data={list}
            keyExtractor={(s) => s.key}
            style={{ marginTop: 8 }}
            renderItem={({ item }) => {
              const hidden = !!hiddenSpecies[item.key];
              return (
                <TouchableOpacity style={styles.pickerRow} onPress={() => onToggleSpecies(item.key)}>
                  {item.portrait ? (
                    <Image source={{ uri: monsterPortraitUrl(item.portrait) }} style={styles.pickerThumb} resizeMode="contain" />
                  ) : item.icon ? (
                    <Image source={{ uri: mapMarkIconUrl(item.icon) }} style={styles.pickerThumb} resizeMode="contain" />
                  ) : (
                    <View style={styles.pickerThumb} />
                  )}
                  <Text style={[styles.pickerRowText, hidden && styles.pickerRowTextOff]} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.speciesCount}>{item.done}/{item.total}</Text>
                  <View style={[styles.checkbox, !hidden && styles.checkboxOn]}>
                    {!hidden && <Text style={styles.checkboxMark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function MarkerModal({
  marker, locale, collected, onToggleCollected, onClose,
}: { marker: MapMarker; locale: string; collected: boolean; onToggleCollected: () => void; onClose: () => void }) {
  const th = locale === "th-TH";
  const layerDef = LAYER_DEFS.find((l) => l.key === marker.layer)!;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.markerModalBg} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.markerCard}>
          <View style={styles.markerHead}>
            {marker.emoji ? (
              <View style={[styles.markerPortrait, styles.markerEmojiWrap]}>
                <Text style={styles.markerEmojiLarge}>{marker.emoji}</Text>
              </View>
            ) : marker.portrait ? (
              <Image source={{ uri: monsterPortraitUrl(marker.portrait) }} style={styles.markerPortrait} resizeMode="contain" />
            ) : (
              <Image source={{ uri: mapMarkIconUrl(marker.icon!) }} style={styles.markerPortrait} resizeMode="contain" />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.markerName}>{marker.name}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                <View style={[styles.markerBadge, { backgroundColor: layerDef.color }]}>
                  <Text style={styles.markerBadgeText}>{th ? layerDef.th : layerDef.en}</Text>
                </View>
                {marker.reqLevel != null && (
                  <View style={[styles.markerBadge, styles.markerLevelBadge]}>
                    <Text style={styles.markerBadgeText}>{th ? `เลเวล ${marker.reqLevel}+` : `Lv.${marker.reqLevel}+`}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          {marker.reward && marker.reward.length > 0 && (
            <View style={styles.rewardRow}>
              <Text style={styles.rewardLabel}>{th ? "รางวัล" : "Reward"}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {marker.reward.map((r, i) => (
                  <View key={i} style={styles.rewardItem}>
                    <Image source={{ uri: rewardItemIconUrl(r.iconPath) }} style={styles.rewardIcon} resizeMode="contain" />
                    {r.count > 1 && <Text style={styles.rewardCount}>x{r.count}</Text>}
                  </View>
                ))}
              </View>
            </View>
          )}
          {marker.layer === "mystery_chest" && marker.mysterySubtype && (
            <View style={styles.rewardRow}>
              <Text style={styles.rewardLabel}>{th ? "ชนิดที่คาดว่าเป็น" : "Likely type"}</Text>
              <Text style={styles.mysteryTypeLine}>
                {MYSTERY_SUBTYPE_INFO[marker.mysterySubtype].emoji}  {th ? MYSTERY_SUBTYPE_INFO[marker.mysterySubtype].th : MYSTERY_SUBTYPE_INFO[marker.mysterySubtype].en}
              </Text>
            </View>
          )}
          {marker.layer === "mystery_chest" && !marker.mysterySubtype && (
            <View style={styles.rewardRow}>
              <Text style={styles.rewardLabel}>
                {th ? "จุดนี้อาจเป็น 1 ใน 6 แบบนี้ ขึ้นกับสภาพอากาศ" : "This point may be one of 6 variants, depending on weather"}
              </Text>
              {MYSTERY_CHEST_TYPES.map((t, i) => (
                <Text key={i} style={styles.mysteryTypeLine}>{t.emoji}  {th ? t.th : t.en}</Text>
              ))}
            </View>
          )}
          <TouchableOpacity
            style={[styles.collectBtn, collected && styles.collectBtnOn]}
            onPress={onToggleCollected}
          >
            <Text style={[styles.collectBtnText, collected && styles.collectBtnTextOn]}>
              {collected
                ? (th ? "✓ เก็บแล้ว (แตะเพื่อยกเลิก)" : "✓ Collected (tap to undo)")
                : (th ? "ทำเครื่องหมายว่าเก็บแล้ว" : "Mark as collected")}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function MapScreen() {
  const { width, height: windowHeight } = useWindowDimensions();
  const [locale, setLocale] = useState("th-TH");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, MapConfig>>({});
  const [markersByScene, setMarkersByScene] = useState<Map<number, MapMarker[]>>(new Map());
  const [sceneId, setSceneId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [collected, setCollected] = useState<Record<string, true>>({});
  const [hideCollected, setHideCollected] = useState(false);
  const [speciesPanelLayer, setSpeciesPanelLayer] = useState<MapLayer | null>(null);
  const [hiddenSpecies, setHiddenSpecies] = useState<Record<string, boolean>>({});
  const [visible, setVisible] = useState<Record<MapLayer, boolean>>(() => {
    const v = {} as Record<MapLayer, boolean>;
    LAYER_DEFS.forEach((l) => { v[l.key] = true; });
    return v;
  });
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // top-left offset of content within the viewport, always <= 0
  const [mapAreaHeight, setMapAreaHeight] = useState<number | null>(null);
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const th = locale === "th-TH";

  // Viewport is a rectangle sized independently in each dimension — the
  // screen's own actual rendered width, edge to edge (not the raw window
  // width: on wide desktops the app shell centers content in a capped
  // ~1200px column, so using the full window width here would overflow it)
  // and whatever vertical space onLayout says is left below the header/
  // legend rows. The image still keeps its true aspect (never distorted):
  // at zoom=1 it's scaled with a "cover" fit (like CSS object-fit: cover)
  // so it fills the box edge-to-edge, cropped top/bottom or sides as
  // needed; the pan feature already built lets you reach whatever falls
  // outside the box.
  const natW = imgSize?.w ?? 1000, natH = imgSize?.h ?? 1000;
  const viewportW = contentWidth ?? width;
  const viewportH = mapAreaHeight ?? viewportW; // falls back before first onLayout
  const viewport = { w: viewportW, h: viewportH };
  const baseScale = Math.max(viewportW / natW, viewportH / natH);
  const content = { w: natW * baseScale * zoom, h: natH * baseScale * zoom };

  // Keep the latest pan/sizes in refs so the PanResponder's callbacks (created
  // once) always read fresh values instead of a stale closure from first render.
  const panRef = useRef(pan);
  useEffect(() => { panRef.current = pan; }, [pan]);
  const sizeRef = useRef({ viewport, content });
  sizeRef.current = { viewport, content };

  // When content is smaller than the viewport in a dimension (possible now
  // that zooming out below the cover-fit 100% is allowed), center it there
  // instead of pinning it to the top-left corner.
  const clampPan = (p: { x: number; y: number }, c: { w: number; h: number }, v: { w: number; h: number }) => {
    const x = c.w <= v.w ? (v.w - c.w) / 2 : Math.max(v.w - c.w, Math.min(0, p.x));
    const y = c.h <= v.h ? (v.h - c.h) / 2 : Math.max(v.h - c.h, Math.min(0, p.y));
    return { x, y };
  };

  // Reset zoom + re-center pan whenever a different map is picked, or once the
  // real image size loads in (baseScale/content depend on it).
  useEffect(() => {
    setZoom(DEFAULT_ZOOM);
    const baseW = natW * baseScale * DEFAULT_ZOOM, baseH = natH * baseScale * DEFAULT_ZOOM;
    setPan({ x: Math.min(0, (viewportW - baseW) / 2), y: Math.min(0, (viewportH - baseH) / 2) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId, imgSize]);

  // Zoom while keeping whatever point is currently centered in the viewport
  // centered afterwards too, instead of jumping back to the top-left corner.
  const zoomBy = useCallback((delta: number) => {
    setZoom((prevZoom) => {
      const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((prevZoom + delta) * 10) / 10));
      if (nz === prevZoom) return prevZoom;
      const { viewport: v } = sizeRef.current;
      const oldW = natW * baseScale * prevZoom, oldH = natH * baseScale * prevZoom;
      const newW = natW * baseScale * nz, newH = natH * baseScale * nz;
      const cur = panRef.current;
      const fx = (v.w / 2 - cur.x) / oldW;
      const fy = (v.h / 2 - cur.y) / oldH;
      setPan(clampPan({ x: v.w / 2 - fx * newW, y: v.h / 2 - fy * newH }, { w: newW, h: newH }, v));
      return nz;
    });
  }, [natW, natH, baseScale]);

  // Drag-to-pan: only claim the gesture once the touch/mouse actually moves
  // (onStartShouldSet = false) so marker taps underneath still fire normally.
  // A second finger switches the same gesture to pinch-to-zoom instead of pan.
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  const dragStart = useRef({ x: 0, y: 0 });
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  const touchDist = (touches: { pageX: number; pageY: number }[]) => {
    const [a, b] = touches;
    return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
  };
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderGrant: (evt) => {
        dragStart.current = { ...panRef.current };
        const touches = evt.nativeEvent.touches;
        pinchStart.current = touches.length === 2 ? { dist: touchDist(touches), zoom: zoomRef.current } : null;
      },
      onPanResponderMove: (evt, g) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          if (!pinchStart.current) pinchStart.current = { dist: touchDist(touches), zoom: zoomRef.current };
          const scale = touchDist(touches) / pinchStart.current.dist;
          const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(pinchStart.current.zoom * scale * 20) / 20));
          setZoom(nz);
          const { viewport: v } = sizeRef.current;
          const newW = natW * baseScale * nz, newH = natH * baseScale * nz;
          setPan((p) => clampPan(p, { w: newW, h: newH }, v));
          return;
        }
        pinchStart.current = null;
        const { content: c, viewport: v } = sizeRef.current;
        setPan(clampPan({ x: dragStart.current.x + g.dx, y: dragStart.current.y + g.dy }, c, v));
      },
    })
  ).current;

  // Web bonus: mouse wheel also zooms the map. React attaches wheel listeners
  // as passive, so preventDefault() can't stop the underlying page scroll —
  // fine here since the map area doesn't scroll on its own anymore.
  const webWheelProps = Platform.OS === "web" ? {
    onWheel: (e: any) => zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP),
  } : {};

  const load = useCallback(async (loc: string) => {
    setLoading(true);
    setError(null);
    try {
      const [idx, byScene] = await Promise.all([fetchMapIndex(loc), fetchMarkersByScene(loc)]);
      setConfigs(idx.map_configs || {});
      setMarkersByScene(byScene);
      setSceneId((prev) => (prev != null && byScene.has(prev) ? prev : (byScene.has(101) ? 101 : [...byScene.keys()].sort((a, b) => a - b)[0] ?? null)));
    } catch (e: any) {
      setError(e.message || "load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Collected-point history survives app restarts (localStorage on web,
  // AsyncStorage on native) — loaded once, keyed by the marker's own stable
  // key so it's independent of locale/map switches.
  useEffect(() => {
    loadJSON<Record<string, true>>(COLLECTED_STORAGE_KEY, {}).then(setCollected);
  }, []);

  const toggleCollected = useCallback((key: string) => {
    setCollected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      saveJSON(COLLECTED_STORAGE_KEY, next);
      return next;
    });
  }, []);

  useEffect(() => { load(locale); }, [locale, load]);

  const pickableMaps = useMemo<PickableMap[]>(() => {
    const out: PickableMap[] = [];
    for (const id of markersByScene.keys()) {
      const cfg = configs[String(id)];
      if (cfg && cfg.name) out.push({ sceneId: id, name: cfg.name, picRes: cfg.pic_res });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [markersByScene, configs]);

  const currentCfg = sceneId != null ? configs[String(sceneId)] : null;
  const currentMarkers = sceneId != null ? (markersByScene.get(sceneId) || []) : [];
  const visibleMarkers = currentMarkers.filter((m) =>
    visible[m.layer] && !(m.speciesKey && hiddenSpecies[m.speciesKey]) && !(hideCollected && collected[m.key])
  );

  const counts = useMemo(() => {
    const c = {} as Record<MapLayer, { total: number; done: number }>;
    LAYER_DEFS.forEach((l) => { c[l.key] = { total: 0, done: 0 }; });
    currentMarkers.forEach((m) => {
      c[m.layer].total++;
      if (collected[m.key]) c[m.layer].done++;
    });
    return c;
  }, [currentMarkers, collected]);

  // Per-species breakdown for mvp/elite/mini: distinct monster identities
  // within each of those 3 layers, so a chip's expand button can list them
  // individually instead of one combined count.
  const speciesByLayer = useMemo(() => {
    const out = new Map<MapLayer, Map<string, SpeciesEntry>>();
    currentMarkers.forEach((m) => {
      if (!m.speciesKey) return;
      let layerMap = out.get(m.layer);
      if (!layerMap) { layerMap = new Map(); out.set(m.layer, layerMap); }
      const cur = layerMap.get(m.speciesKey);
      if (cur) { cur.total++; if (collected[m.key]) cur.done++; }
      else layerMap.set(m.speciesKey, { key: m.speciesKey, name: m.name, icon: m.icon, portrait: m.portrait, total: 1, done: collected[m.key] ? 1 : 0 });
    });
    return out;
  }, [currentMarkers, collected]);

  // Species hide-state is per-map (keys aren't unique across different
  // monster spawn tables), so reset it whenever the selected map changes.
  useEffect(() => { setHiddenSpecies({}); }, [sceneId]);

  useEffect(() => {
    setImgSize(null);
    if (!currentCfg) return;
    const uri = mapBackgroundUrl(currentCfg.pic_res);
    Image.getSize(uri, (w, h) => setImgSize({ w, h }), () => setImgSize({ w: 1000, h: 1000 }));
  }, [currentCfg?.pic_res]);

  return (
    <View style={styles.container} onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}>
      <View style={styles.localeRow}>
        {LOCALES.map((l) => (
          <TouchableOpacity key={l} onPress={() => setLocale(l)}
            style={[styles.localeChip, locale === l && styles.localeChipOn]}>
            <Text style={[styles.localeText, locale === l && styles.localeTextOn]}>
              {l.split("-")[0].toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.mapPickBtn} onPress={() => setPickerOpen(true)}>
        <Text style={styles.mapPickText} numberOfLines={1}>
          {currentCfg?.name || (th ? "เลือกแมพ" : "Choose map")}
        </Text>
        <Text style={styles.mapPickIcon}>▾</Text>
      </TouchableOpacity>

      <View style={styles.legendRow}>
        {LAYER_DEFS.map((l) => {
          const on = visible[l.key];
          const c = counts[l.key];
          const canExpand = SPECIES_LAYERS.includes(l.key) && c.total > 0;
          return (
            <View key={l.key} style={[styles.legendChip, { borderColor: l.color }, on && { backgroundColor: l.color }]}>
              <TouchableOpacity onPress={() => setVisible((v) => ({ ...v, [l.key]: !v[l.key] }))}>
                <Text style={[styles.legendText, on && styles.legendTextOn, !on && { color: l.color }]}>
                  {(th ? l.th : l.en)} ({c.done}/{c.total})
                </Text>
              </TouchableOpacity>
              {canExpand && (
                <TouchableOpacity
                  style={styles.legendExpandBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  onPress={() => setSpeciesPanelLayer(l.key)}
                >
                  <Text style={[styles.legendExpandIcon, on && styles.legendTextOn, !on && { color: l.color }]}>▤</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      <TouchableOpacity style={styles.hideRow} onPress={() => setHideCollected((h) => !h)}>
        <View style={[styles.checkbox, hideCollected && styles.checkboxOn]}>
          {hideCollected && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text style={styles.hideRowText}>{th ? "ซ่อนจุดที่เก็บแล้ว" : "Hide collected points"}</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#E8B339" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={() => load(locale)}>
            <Text style={styles.retryText}>retry</Text>
          </TouchableOpacity>
        </View>
      ) : !currentCfg ? (
        <View style={styles.center}><Text style={styles.empty}>{th ? "ไม่มีข้อมูลแมพ" : "No map data"}</Text></View>
      ) : (
        <View
          // Re-keyed on window size so this subtree remounts (and onLayout
          // re-fires) on resize — RN Web's onLayout only fires when *this*
          // component's own render/props change, not when a parent's CSS
          // flex box happens to resize the DOM around it (e.g. a mobile
          // browser's address bar collapsing) — plain onLayout alone missed
          // exactly that case, which is what left the zoom controls/hint
          // text unreachable with body's overflow:hidden allowing no scroll.
          key={`${Math.round(width)}x${Math.round(windowHeight)}`}
          style={{ flex: 1 }}
          onLayout={(e) => setMapAreaHeight(Math.max(120, e.nativeEvent.layout.height - 28))}
        >
          <View style={{ width: viewport.w, height: viewport.h }}>
            <View
              style={{ width: viewport.w, height: viewport.h, overflow: "hidden", backgroundColor: "#0F1626" }}
              {...webWheelProps}
              {...panResponder.panHandlers}
            >
              <View style={{ position: "absolute", left: pan.x, top: pan.y, width: content.w, height: content.h }}>
                <Image source={{ uri: mapBackgroundUrl(currentCfg.pic_res) }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                {visibleMarkers.map((m) => {
                  const { left, top } = worldToImageFraction(currentCfg, m.x, m.z);
                  if (left < -0.02 || left > 1.02 || top < -0.02 || top > 1.02) return null;
                  // A matched mystery-chest sub-type gets its own color (matching
                  // the reference tracker's icon coloring) instead of the flat
                  // generic mystery_chest purple, so the type is readable at a glance.
                  const layerColor = m.mysterySubtype
                    ? MYSTERY_SUBTYPE_INFO[m.mysterySubtype].color
                    : LAYER_DEFS.find((l) => l.key === m.layer)?.color || "#FFFFFF";
                  const done = !!collected[m.key];
                  return (
                    <TouchableOpacity
                      key={m.key}
                      style={[styles.marker, { left: `${left * 100}%`, top: `${top * 100}%` }, done && styles.markerDone]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => setSelectedMarker(m)}
                    >
                      <View style={[styles.markerHalo, { borderColor: layerColor }]}>
                        {m.emoji ? (
                          <Text style={styles.markerEmoji}>{m.emoji}</Text>
                        ) : (
                          <Image source={{ uri: mapMarkIconUrl(m.icon!) }} style={styles.markerIcon} resizeMode="contain" />
                        )}
                      </View>
                      {done && (
                        <View style={styles.markerDoneBadge}>
                          <Text style={styles.markerDoneBadgeText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.zoomControls}>
              <TouchableOpacity
                style={[styles.zoomBtn, zoom >= MAX_ZOOM && styles.zoomBtnDisabled]}
                onPress={() => zoomBy(ZOOM_STEP)}
                disabled={zoom >= MAX_ZOOM}
              >
                <Text style={styles.zoomBtnText}>+</Text>
              </TouchableOpacity>
              <Text style={styles.zoomPct}>{Math.round(zoom * 100)}%</Text>
              <TouchableOpacity
                style={[styles.zoomBtn, zoom <= MIN_ZOOM && styles.zoomBtnDisabled]}
                onPress={() => zoomBy(-ZOOM_STEP)}
                disabled={zoom <= MIN_ZOOM}
              >
                <Text style={styles.zoomBtnText}>−</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.hint}>
            {th ? "ลากเพื่อเลื่อนแมพ • ใช้ปุ่ม +/− เพื่อซูมโฟกัส" : "Drag to pan • use +/− to zoom in and focus"}
          </Text>
        </View>
      )}

      {pickerOpen && (
        <MapPickerModal
          maps={pickableMaps}
          locale={locale}
          onPick={(m) => { setSceneId(m.sceneId); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {speciesPanelLayer && (
        <SpeciesBreakdownModal
          layer={speciesPanelLayer}
          locale={locale}
          species={speciesByLayer.get(speciesPanelLayer) || new Map()}
          hiddenSpecies={hiddenSpecies}
          onToggleSpecies={(key) => setHiddenSpecies((h) => ({ ...h, [key]: !h[key] }))}
          onClose={() => setSpeciesPanelLayer(null)}
        />
      )}

      {selectedMarker && (
        <MarkerModal
          marker={selectedMarker}
          locale={locale}
          collected={!!collected[selectedMarker.key]}
          onToggleCollected={() => toggleCollected(selectedMarker.key)}
          onClose={() => setSelectedMarker(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8F2FD" },
  localeRow: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 8 },
  localeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 6, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCE6F4" },
  localeChipOn: { backgroundColor: "#6E83E8", borderColor: "#6E83E8" },
  localeText: { color: "#8A97AD", fontSize: 12, fontWeight: "bold" },
  localeTextOn: { color: "#FFFFFF" },

  mapPickBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCE6F4" },
  mapPickText: { color: "#41506B", fontSize: 16, fontWeight: "bold", flex: 1, marginRight: 8 },
  mapPickIcon: { color: "#8A97AD", fontSize: 14, fontWeight: "bold" },

  legendRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10, marginTop: 10 },
  legendChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, margin: 4, borderWidth: 1.5, backgroundColor: "#FFFFFF" },
  legendText: { fontSize: 13, fontWeight: "bold" },
  legendTextOn: { color: "#FFFFFF" },
  legendExpandBtn: { marginLeft: 6, paddingLeft: 6, borderLeftWidth: 1, borderLeftColor: "rgba(0,0,0,0.15)" },
  legendExpandIcon: { fontSize: 13, fontWeight: "bold" },
  speciesCount: { color: "#8A97AD", fontSize: 12, fontWeight: "bold", marginRight: 8 },
  pickerRowTextOff: { color: "#B7C2D6" },

  hideRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginTop: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: "#C9D6EE",
    backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginRight: 8 },
  checkboxOn: { backgroundColor: "#6E83E8", borderColor: "#6E83E8" },
  checkboxMark: { color: "#FFFFFF", fontSize: 12, fontWeight: "bold" },
  hideRowText: { color: "#5A6781", fontSize: 13, fontWeight: "600" },

  zoomControls: { position: "absolute", right: 16, bottom: 16, alignItems: "center",
    backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#DCE6F4",
    paddingVertical: 4, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  zoomBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  zoomBtnDisabled: { opacity: 0.35 },
  zoomBtnText: { color: "#41506B", fontSize: 20, fontWeight: "bold" },
  zoomPct: { color: "#8A97AD", fontSize: 11, fontWeight: "bold", paddingVertical: 2 },

  marker: { position: "absolute", width: 50, height: 50, marginLeft: -25, marginTop: -25 },
  markerHalo: { width: 50, height: 50, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 3, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  markerIcon: { width: 46, height: 46 },
  markerEmoji: { fontSize: 30, lineHeight: 34 },
  markerDone: { opacity: 0.4 },
  markerDoneBadge: { position: "absolute", top: -4, right: -4, width: 20, height: 20, borderRadius: 999,
    backgroundColor: "#3FA35A", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#FFFFFF" },
  markerDoneBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "bold", lineHeight: 12 },
  hint: { color: "#8A97AD", fontSize: 12, marginTop: 8, textAlign: "center", paddingHorizontal: 16 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#E0564E", marginBottom: 12, paddingHorizontal: 24, textAlign: "center" },
  retry: { backgroundColor: "#6E83E8", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: "#FFFFFF", fontWeight: "bold" },
  empty: { color: "#8A97AD", textAlign: "center", marginTop: 40 },

  modalBg: { flex: 1, backgroundColor: "rgba(40,60,100,0.45)", justifyContent: "flex-end" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#C9D6EE", alignSelf: "center", marginBottom: 12 },
  pickerCard: { backgroundColor: "#F4F8FE", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, maxHeight: "80%" },
  pickerTitle: { color: "#41506B", fontSize: 17, fontWeight: "bold", marginBottom: 8 },
  search: { backgroundColor: "#FFFFFF", color: "#41506B", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, borderWidth: 1, borderColor: "#DCE6F4" },
  pickerRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: "#E6EDF7" },
  pickerThumb: { width: 44, height: 44, borderRadius: 6, marginRight: 12, backgroundColor: "#EAF1FB" },
  pickerRowText: { color: "#41506B", fontSize: 14, fontWeight: "600", flex: 1 },

  markerModalBg: { flex: 1, backgroundColor: "rgba(40,60,100,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  markerCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, width: "100%", maxWidth: 360 },
  markerHead: { flexDirection: "row", alignItems: "center" },
  markerPortrait: { width: 48, height: 48, marginRight: 12, backgroundColor: "#EAF1FB", borderRadius: 8 },
  markerEmojiWrap: { alignItems: "center", justifyContent: "center" },
  markerEmojiLarge: { fontSize: 28 },
  markerName: { color: "#41506B", fontSize: 16, fontWeight: "bold" },
  markerBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginTop: 4, marginRight: 6 },
  markerBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "bold" },
  markerLevelBadge: { backgroundColor: "#5A6781" },
  rewardRow: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#E6EDF7", paddingTop: 10 },
  rewardLabel: { color: "#8A97AD", fontSize: 12, fontWeight: "bold", marginBottom: 6 },
  rewardItem: { flexDirection: "row", alignItems: "center", marginRight: 12, marginBottom: 6 },
  rewardIcon: { width: 32, height: 32, marginRight: 4 },
  rewardCount: { color: "#5A6781", fontSize: 12, fontWeight: "bold" },
  mysteryTypeLine: { color: "#5A6781", fontSize: 13, lineHeight: 20, marginTop: 4 },

  collectBtn: { marginTop: 14, paddingVertical: 12, borderRadius: 10, alignItems: "center",
    backgroundColor: "#F1F6FC", borderWidth: 1.5, borderColor: "#C9D6EE" },
  collectBtnOn: { backgroundColor: "#E9F7EE", borderColor: "#3FA35A" },
  collectBtnText: { color: "#5A6781", fontSize: 14, fontWeight: "bold" },
  collectBtnTextOn: { color: "#2E7D46" },
});
