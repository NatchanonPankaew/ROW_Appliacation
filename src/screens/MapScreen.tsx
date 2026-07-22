import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Modal, ScrollView,
  TextInput, FlatList, ActivityIndicator, useWindowDimensions, Platform,
} from "react-native";
import {
  fetchMapIndex, fetchMarkersByScene, mapMarkIconUrl, monsterPortraitUrl,
  mapBackgroundUrl, rewardItemIconUrl, worldToImageFraction,
  MapConfig, MapMarker, MapLayer,
} from "../api/mapData";

const LOCALES = ["en-US", "th-TH", "zh-TW"];

const LAYER_DEFS: { key: MapLayer; th: string; en: string; color: string }[] = [
  { key: "card", th: "การ์ด", en: "Cards", color: "#E8B339" },
  { key: "mvp", th: "MVP", en: "MVP", color: "#A65CD6" },
  { key: "elite", th: "Elite", en: "Elite", color: "#E0533D" },
  { key: "mini", th: "Mini", en: "Mini", color: "#5DBB63" },
];

interface PickableMap { sceneId: number; name: string; picRes: string; }

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

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

function MarkerModal({
  marker, locale, onClose,
}: { marker: MapMarker; locale: string; onClose: () => void }) {
  const th = locale === "th-TH";
  const layerDef = LAYER_DEFS.find((l) => l.key === marker.layer)!;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.markerModalBg} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.markerCard}>
          <View style={styles.markerHead}>
            {marker.portrait ? (
              <Image source={{ uri: monsterPortraitUrl(marker.portrait) }} style={styles.markerPortrait} resizeMode="contain" />
            ) : (
              <Image source={{ uri: mapMarkIconUrl(marker.icon) }} style={styles.markerPortrait} resizeMode="contain" />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.markerName}>{marker.name}</Text>
              <View style={[styles.markerBadge, { backgroundColor: layerDef.color }]}>
                <Text style={styles.markerBadgeText}>{th ? layerDef.th : layerDef.en}</Text>
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
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function MapScreen() {
  const { width } = useWindowDimensions();
  const [locale, setLocale] = useState("th-TH");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, MapConfig>>({});
  const [markersByScene, setMarkersByScene] = useState<Map<number, MapMarker[]>>(new Map());
  const [sceneId, setSceneId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [visible, setVisible] = useState<Record<MapLayer, boolean>>({ card: true, mvp: true, elite: true, mini: true });
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const hScrollRef = useRef<ScrollView>(null);
  const vScrollRef = useRef<ScrollView>(null);
  const th = locale === "th-TH";

  // Reset pan/zoom whenever a different map is picked, so it always opens fit-to-screen.
  useEffect(() => {
    setZoom(MIN_ZOOM);
    hScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    vScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  }, [sceneId]);

  const zoomBy = useCallback((delta: number) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((z + delta) * 10) / 10)));
  }, []);

  // Web bonus: mouse wheel also zooms the map. React attaches wheel listeners
  // as passive, so preventDefault() can't stop the underlying scroll — that's
  // fine here, the scroll and the zoom step just both happen together.
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
  const visibleMarkers = currentMarkers.filter((m) => visible[m.layer]);

  const counts = useMemo(() => {
    const c: Record<MapLayer, number> = { card: 0, mvp: 0, elite: 0, mini: 0 };
    currentMarkers.forEach((m) => { c[m.layer]++; });
    return c;
  }, [currentMarkers]);

  useEffect(() => {
    setImgSize(null);
    if (!currentCfg) return;
    const uri = mapBackgroundUrl(currentCfg.pic_res);
    Image.getSize(uri, (w, h) => setImgSize({ w, h }), () => setImgSize({ w: 1000, h: 1000 }));
  }, [currentCfg?.pic_res]);

  const containerWidth = Math.min(width - 32, 720);
  const aspect = imgSize ? imgSize.w / imgSize.h : 1;

  return (
    <View style={styles.container}>
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
          return (
            <TouchableOpacity key={l.key}
              style={[styles.legendChip, { borderColor: l.color }, on && { backgroundColor: l.color }]}
              onPress={() => setVisible((v) => ({ ...v, [l.key]: !v[l.key] }))}>
              <Text style={[styles.legendText, on && styles.legendTextOn, !on && { color: l.color }]}>
                {(th ? l.th : l.en)} ({counts[l.key]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={hScrollRef}
            horizontal
            style={{ flex: 1 }}
            contentContainerStyle={{ minWidth: "100%" }}
            showsHorizontalScrollIndicator={false}
            {...webWheelProps}
          >
            <ScrollView
              ref={vScrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ minHeight: "100%", alignItems: "center", justifyContent: "center", paddingVertical: 12 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ width: containerWidth * zoom, aspectRatio: aspect, backgroundColor: "#0F1626", borderRadius: 12, overflow: "hidden" }}>
                <Image source={{ uri: mapBackgroundUrl(currentCfg.pic_res) }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                {visibleMarkers.map((m) => {
                  const { left, top } = worldToImageFraction(currentCfg, m.x, m.z);
                  if (left < -0.02 || left > 1.02 || top < -0.02 || top > 1.02) return null;
                  const layerColor = LAYER_DEFS.find((l) => l.key === m.layer)?.color || "#FFFFFF";
                  return (
                    <TouchableOpacity
                      key={m.key}
                      style={[styles.marker, { left: `${left * 100}%`, top: `${top * 100}%` }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => setSelectedMarker(m)}
                    >
                      <View style={[styles.markerHalo, { borderColor: layerColor }]}>
                        <Image source={{ uri: mapMarkIconUrl(m.icon) }} style={styles.markerIcon} resizeMode="contain" />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </ScrollView>

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

          <Text style={styles.hint}>
            {th ? "แตะจุดบนแมพเพื่อดูรายละเอียด • ใช้ปุ่ม +/− เพื่อซูมโฟกัส" : "Tap a point for details • use +/− to zoom in and pan"}
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

      {selectedMarker && (
        <MarkerModal marker={selectedMarker} locale={locale} onClose={() => setSelectedMarker(null)} />
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

  legendRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, marginTop: 10 },
  legendChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, margin: 4, borderWidth: 1.5, backgroundColor: "#FFFFFF" },
  legendText: { fontSize: 13, fontWeight: "bold" },
  legendTextOn: { color: "#FFFFFF" },

  zoomControls: { position: "absolute", right: 16, bottom: 16, alignItems: "center",
    backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#DCE6F4",
    paddingVertical: 4, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  zoomBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  zoomBtnDisabled: { opacity: 0.35 },
  zoomBtnText: { color: "#41506B", fontSize: 20, fontWeight: "bold" },
  zoomPct: { color: "#8A97AD", fontSize: 11, fontWeight: "bold", paddingVertical: 2 },

  marker: { position: "absolute", width: 24, height: 24, marginLeft: -12, marginTop: -12 },
  markerHalo: { width: 24, height: 24, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  markerIcon: { width: 18, height: 18 },
  hint: { color: "#8A97AD", fontSize: 12, marginTop: 8 },

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
  markerName: { color: "#41506B", fontSize: 16, fontWeight: "bold" },
  markerBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginTop: 4 },
  markerBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "bold" },
  rewardRow: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#E6EDF7", paddingTop: 10 },
  rewardLabel: { color: "#8A97AD", fontSize: 12, fontWeight: "bold", marginBottom: 6 },
  rewardItem: { flexDirection: "row", alignItems: "center", marginRight: 12, marginBottom: 6 },
  rewardIcon: { width: 32, height: 32, marginRight: 4 },
  rewardCount: { color: "#5A6781", fontSize: 12, fontWeight: "bold" },
});
