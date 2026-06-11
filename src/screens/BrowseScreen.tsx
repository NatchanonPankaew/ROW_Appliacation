import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View, Text, TextInput, SectionList, ActivityIndicator,
  TouchableOpacity, StyleSheet, Image, ScrollView,
} from "react-native";
import {
  fetchData, fetchIconPaths, resolveIconUrl, qualityInfo,
  QUALITY, KIND_HAS_QUALITY, NormItem, IconPaths, Kind, slotOrder,
} from "../api/roworlddb";

const LOCALES = ["en-US", "th-TH", "zh-TW"];
const Q_FILTERS = [6, 5, 4, 3, 2];

function Row({ item, iconUrl }: { item: NormItem; iconUrl: string | null }) {
  const q = qualityInfo(item.quality);
  return (
    <View style={[styles.row, q && { borderLeftColor: q.color, borderLeftWidth: 4 }]}>
      <View style={styles.iconWrap}>
        {iconUrl ? (
          <Image source={{ uri: iconUrl }} style={styles.icon} resizeMode="contain" />
        ) : (
          <View style={[styles.icon, styles.iconFallback]} />
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
          {q && (
            <View style={[styles.badge, { backgroundColor: q.color }]}>
              <Text style={styles.badgeText}>{q.label}</Text>
            </View>
          )}
        </View>
        {(item.effects || []).map((line, i) => (
          <Text key={i} style={styles.effect} numberOfLines={3}>{line}</Text>
        ))}
      </View>
    </View>
  );
}

// Group items into sections by their stable SLOT (weapon / armor / garment /
// head ...). Cards carry slotKey too (from card_type_name), so weapon cards,
// armor cards, etc. land in their own sections. Title is the localized slot
// label taken from the items; ordering follows the equipment slot order.
function groupByType(items: NormItem[]) {
  const map: Record<string, NormItem[]> = {};
  const labelOf: Record<string, string> = {};
  for (const it of items) {
    const key = (it.slotKey || it.subtitle || it.tags?.slot || "อื่นๆ") + "";
    (map[key] ||= []).push(it);
    if (!labelOf[key]) labelOf[key] = (it.slot || it.subtitle || it.tags?.slot || key) + "";
  }
  return Object.keys(map)
    .sort((a, b) => {
      const oa = slotOrder(a), ob = slotOrder(b);
      if (oa !== ob) return oa - ob;
      return (labelOf[a] || a).localeCompare(labelOf[b] || b);
    })
    .map((key) => ({ title: labelOf[key] || key, data: map[key] }));
}

export default function BrowseScreen({ kind }: { kind: Kind }) {
  const [locale, setLocale] = useState("th-TH");
  const [items, setItems] = useState<NormItem[]>([]);
  const [iconPaths, setIconPaths] = useState<IconPaths | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [qFilter, setQFilter] = useState<number | null>(null);
  const [slotFilter, setSlotFilter] = useState<string | null>(null);
  const [subtypeFilter, setSubtypeFilter] = useState<string | null>(null);

  const hasQuality = KIND_HAS_QUALITY[kind];

  useEffect(() => { setSlotFilter(null); setQFilter(null); setSubtypeFilter(null); }, [kind]);
  useEffect(() => { setSubtypeFilter(null); }, [slotFilter]);

  const load = useCallback(async (loc: string) => {
    setLoading(true);
    setError(null);
    try {
      const [data, icons] = await Promise.all([fetchData(kind, loc), fetchIconPaths()]);
      setItems(data.items);          // <- this was missing before
      setIconPaths(icons);
    } catch (e: any) {
      setError(e.message || "load failed");
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => { load(locale); }, [locale, load]);

  const slotKeyOf = (it: NormItem) => (it.slotKey || it.subtitle || it.tags?.slot || "อื่นๆ") + "";

  // distinct slot categories present (for the filter chips)
  const slotChips = useMemo(() => {
    const label: Record<string, string> = {};
    for (const it of items) {
      const key = slotKeyOf(it);
      if (!label[key]) label[key] = (it.slot || it.subtitle || it.tags?.slot || key) + "";
    }
    return Object.keys(label)
      .sort((a, b) => slotOrder(a) - slotOrder(b) || label[a].localeCompare(label[b]))
      .map((key) => ({ key, label: label[key] }));
  }, [items]);

  // distinct weapon/armor subtypes (within the chosen slot, if any)
  const subtypeChips = useMemo(() => {
    const base = slotFilter ? items.filter((it) => slotKeyOf(it) === slotFilter) : items;
    const set = new Set<string>();
    base.forEach((it) => { if (it.subtypeName) set.add(it.subtypeName); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items, slotFilter]);

  const sections = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().replace(/[\u0E47-\u0E4E]/g, "");
    const textOf = (it: NormItem) =>
      norm([
        it.title, it.subtitle, it.slot, it.subtypeName,
        ...(it.effects || []),
        ...(it.details || []).map((d) => d.label + " " + d.value),
      ].filter(Boolean).join(" "));
    const tokens = norm(query.trim()).split(/\s+/).filter(Boolean);
    const filtered = items.filter((it) => {
      if (qFilter != null && it.quality !== qFilter) return false;
      if (slotFilter != null && slotKeyOf(it) !== slotFilter) return false;
      if (subtypeFilter != null && it.subtypeName !== subtypeFilter) return false;
      if (tokens.length) { const t = textOf(it); if (!tokens.every((tok) => t.includes(tok))) return false; }
      return true;
    });
    return groupByType(filtered);
  }, [items, query, qFilter, slotFilter, subtypeFilter]);

  const total = useMemo(() => sections.reduce((n, s) => n + s.data.length, 0), [sections]);
  const multiSection = sections.length > 1;

  const renderItem = useCallback(({ item }: { item: NormItem }) => (
    <Row item={item} iconUrl={resolveIconUrl(item, iconPaths)} />
  ), [iconPaths]);

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

      <TextInput style={styles.search} placeholder="ค้นหาชื่อ/ความสามารถ เช่น กันสตัน ป้องกันไฟ"
        placeholderTextColor="#6B7079" value={query} onChangeText={setQuery} />

      {slotChips.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.slotRow} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => setSlotFilter(null)}
            style={[styles.fChip, slotFilter == null && styles.fChipOn]}>
            <Text style={[styles.fText, slotFilter == null && styles.fTextOn]}>ทั้งหมด</Text>
          </TouchableOpacity>
          {slotChips.map((c) => {
            const on = slotFilter === c.key;
            return (
              <TouchableOpacity key={c.key} onPress={() => setSlotFilter(on ? null : c.key)}
                style={[styles.fChip, on && styles.fChipOn]}>
                <Text style={[styles.fText, on && styles.fTextOn]} numberOfLines={1}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {subtypeChips.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subRow} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => setSubtypeFilter(null)}
            style={[styles.fChip, styles.subChip, subtypeFilter == null && styles.fChipOn]}>
            <Text style={[styles.fText, subtypeFilter == null && styles.fTextOn]}>ชนิดทั้งหมด</Text>
          </TouchableOpacity>
          {subtypeChips.map((st) => {
            const on = subtypeFilter === st;
            return (
              <TouchableOpacity key={st} onPress={() => setSubtypeFilter(on ? null : st)}
                style={[styles.fChip, styles.subChip, on && styles.fChipOn]}>
                <Text style={[styles.fText, on && styles.fTextOn]} numberOfLines={1}>{st}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {hasQuality && (
        <View style={styles.filterRow}>
          <TouchableOpacity onPress={() => setQFilter(null)}
            style={[styles.fChip, qFilter == null && styles.fChipOn]}>
            <Text style={[styles.fText, qFilter == null && styles.fTextOn]}>All</Text>
          </TouchableOpacity>
          {Q_FILTERS.map((q) => {
            const on = qFilter === q;
            return (
              <TouchableOpacity key={q} onPress={() => setQFilter(on ? null : q)}
                style={[styles.fChip, on && { backgroundColor: QUALITY[q].color, borderColor: QUALITY[q].color }]}>
                <Text style={[styles.fText, on && styles.fTextOn]}>{QUALITY[q].label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#E8B339" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={() => load(locale)}>
            <Text style={styles.retryText}>retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          renderSectionHeader={({ section }) =>
            multiSection ? (
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionCount}>{section.data.length}</Text>
              </View>
            ) : null
          }
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 16 }}
          initialNumToRender={12}
          windowSize={10}
          removeClippedSubviews
          ListHeaderComponent={<Text style={styles.count}>{total} items</Text>}
          ListEmptyComponent={<Text style={styles.empty}>no results</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0F12" },
  localeRow: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 8 },
  localeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 6, backgroundColor: "#16181D" },
  localeChipOn: { backgroundColor: "#E8B339" },
  localeText: { color: "#8A8F99", fontSize: 12, fontWeight: "700" },
  localeTextOn: { color: "#0E0F12" },
  search: { marginHorizontal: 16, marginTop: 8, backgroundColor: "#16181D", color: "#F2F3F5",
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, marginTop: 10 },
  slotRow: { paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  subRow: { paddingHorizontal: 12, paddingBottom: 6, alignItems: "center" },
  subChip: { paddingVertical: 4, backgroundColor: "#0E0F12" },
  fChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, margin: 4,
    borderWidth: 1, borderColor: "#2A2E36", backgroundColor: "#16181D" },
  fChipOn: { backgroundColor: "#C7CBD1", borderColor: "#C7CBD1" },
  fText: { color: "#C7CBD1", fontSize: 13, fontWeight: "600" },
  fTextOn: { color: "#0E0F12", fontWeight: "800" },
  count: { color: "#6B7079", fontSize: 12, marginLeft: 18, marginVertical: 4 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#0E0F12", paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6 },
  sectionTitle: { color: "#E8B339", fontSize: 15, fontWeight: "800" },
  sectionCount: { color: "#6B7079", fontSize: 12, fontWeight: "700" },
  row: { flexDirection: "row", backgroundColor: "#16181D", borderRadius: 12, padding: 12,
    marginHorizontal: 14, marginVertical: 6 },
  iconWrap: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#0E0F12",
    alignItems: "center", justifyContent: "center", marginRight: 12 },
  icon: { width: 48, height: 48 },
  iconFallback: { backgroundColor: "#23262D", borderRadius: 6 },
  body: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  name: { color: "#F2F3F5", fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { color: "#0E0F12", fontSize: 10, fontWeight: "800" },
  effect: { color: "#C7CBD1", fontSize: 13, lineHeight: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#E06C6C", marginBottom: 12, paddingHorizontal: 24, textAlign: "center" },
  retry: { backgroundColor: "#E8B339", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: "#0E0F12", fontWeight: "800" },
  empty: { color: "#6B7079", textAlign: "center", marginTop: 40 },
});
