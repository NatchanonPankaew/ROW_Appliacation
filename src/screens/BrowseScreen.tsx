import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View, Text, TextInput, SectionList, ActivityIndicator,
  TouchableOpacity, StyleSheet, Image, Modal, ScrollView,
} from "react-native";
import {
  fetchData, fetchIconPaths, resolveIconUrl, qualityInfo,
  QUALITY, KIND_HAS_QUALITY, NormItem, IconPaths, Kind, slotOrder, JobOpt, DetailRow,
} from "../api/roworlddb";

const LOCALES = ["en-US", "th-TH", "zh-TW"];
const Q_FILTERS = [6, 5, 4, 3, 2];

function Row({ item, iconUrl, onPress }: { item: NormItem; iconUrl: string | null; onPress: () => void }) {
  const q = qualityInfo(item.quality);
  const preview = item.effects?.length
    ? item.effects.slice(0, 2)
    : (item.details || []).slice(0, 2).map((d) => `${d.label}: ${d.value}`);
  return (
    <TouchableOpacity activeOpacity={0.75}
      style={[styles.row, q && { borderLeftColor: q.color, borderLeftWidth: 4 }]}
      onPress={onPress}>
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
        {preview.map((line, i) => (
          <Text key={i} style={styles.effect} numberOfLines={2}>{line}</Text>
        ))}
      </View>
    </TouchableOpacity>
  );
}

function DetailModal({ item, iconUrl, locale, jobNames, onClose }: {
  item: NormItem; iconUrl: string | null;
  locale?: string; jobNames?: Record<number, string>; onClose: () => void;
}) {
  const q = qualityInfo(item.quality);
  const th = locale === "th-TH";
  const L = (t: string, e: string) => (th ? t : e);

  // equipment-specific facts (weapon subtype, usable jobs, two-handed, level,
  // per-refine bonus). Only present on equipment items, so this block is empty
  // for cards / pets / etc. and renders nothing.
  const meta: DetailRow[] = [];
  if (item.subtypeName) {
    meta.push({
      label: L("ชนิด", "Type"),
      value: item.subtypeName + (item.twoHanded ? L(" (สองมือ)", " (2-handed)") : ""),
    });
  }
  if (item.reqLevel) meta.push({ label: L("เลเวล", "Level"), value: String(item.reqLevel) });
  if (item.jobAll) {
    meta.push({ label: L("อาชีพ", "Jobs"), value: L("ทุกอาชีพ", "All jobs") });
  } else if (item.jobLimits && item.jobLimits.length) {
    const names = item.jobLimits.map((id) => jobNames?.[id]).filter(Boolean) as string[];
    if (names.length) meta.push({ label: L("อาชีพ", "Jobs"), value: names.join(", ") });
  }
  const refine = Object.entries(item.refineStats || {});

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={styles.modalIconWrap}>
              {iconUrl
                ? <Image source={{ uri: iconUrl }} style={styles.modalIcon} resizeMode="contain" />
                : <View style={[styles.modalIcon, styles.iconFallback]} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{item.title}</Text>
              {item.subtitle ? <Text style={styles.modalSub}>{item.subtitle}</Text> : null}
              {q && <View style={[styles.badge, { backgroundColor: q.color, alignSelf: "flex-start", marginTop: 4 }]}>
                <Text style={styles.badgeText}>{q.label}</Text>
              </View>}
            </View>
          </View>
          <ScrollView style={{ marginTop: 8 }} contentContainerStyle={{ paddingBottom: 16 }}>
            {meta.length > 0 && (
              <View style={styles.metaBox}>
                {meta.map((m, i) => (
                  <View key={i} style={styles.metaRow}>
                    <Text style={styles.metaLabel}>{m.label}</Text>
                    <Text style={styles.metaValue}>{m.value}</Text>
                  </View>
                ))}
              </View>
            )}
            {(item.effects || []).map((line, i) => (
              <Text key={i} style={styles.modalEffect}>{line}</Text>
            ))}
            {(item.details || []).length > 0 && (
              <View style={styles.detailTable}>
                {(item.details || []).map((d, i) => (
                  <View key={i} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{d.label}</Text>
                    <Text style={styles.detailValue}>{d.value}</Text>
                  </View>
                ))}
              </View>
            )}
            {refine.length > 0 && (
              <View style={styles.detailTable}>
                <Text style={styles.refineHead}>{L("โบนัสต่อการตี +1", "Bonus per +1 refine")}</Text>
                {refine.map(([name, val], i) => (
                  <View key={i} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{name}</Text>
                    <Text style={styles.detailValue}>{val > 0 ? "+" : ""}{val}</Text>
                  </View>
                ))}
              </View>
            )}
            {item.story ? <Text style={styles.story}>{item.story}</Text> : null}
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>ปิด</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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

const LEVEL_BUCKETS = [
  { key: "1-30", label: "Lv.1-30", min: 1, max: 30 },
  { key: "31-60", label: "Lv.31-60", min: 31, max: 60 },
  { key: "61-90", label: "Lv.61-90", min: 61, max: 90 },
  { key: "91-120", label: "Lv.91-120", min: 91, max: 120 },
  { key: "121+", label: "Lv.121+", min: 121, max: 9999 },
];

export default function BrowseScreen({ kind }: { kind: Kind }) {
  const [locale, setLocale] = useState("th-TH");
  const [items, setItems] = useState<NormItem[]>([]);
  const [jobs, setJobs] = useState<JobOpt[]>([]);
  const [iconPaths, setIconPaths] = useState<IconPaths | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [qFilter, setQFilter] = useState<number | null>(null);
  const [slotFilter, setSlotFilter] = useState<string | null>(null);
  const [subtypeFilter, setSubtypeFilter] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [detail, setDetail] = useState<NormItem | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const hasQuality = KIND_HAS_QUALITY[kind];
  // level-range filter (monsters carry tags.level)
  const hasLevel = useMemo(() => items.some((it) => it.tags?.level), [items]);
  const activeFilters =
    (slotFilter != null ? 1 : 0) + (subtypeFilter != null ? 1 : 0) +
    (qFilter != null ? 1 : 0) + (levelFilter != null ? 1 : 0);

  useEffect(() => { setSlotFilter(null); setQFilter(null); setSubtypeFilter(null); setLevelFilter(null); }, [kind]);
  useEffect(() => { setSubtypeFilter(null); }, [slotFilter]);

  const load = useCallback(async (loc: string) => {
    setLoading(true);
    setError(null);
    try {
      const [data, icons] = await Promise.all([fetchData(kind, loc), fetchIconPaths()]);
      setItems(data.items);          // <- this was missing before
      setJobs(data.jobs || []);
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
      if (levelFilter != null) {
        const lv = Number(it.tags?.level);
        const b = LEVEL_BUCKETS.find((x) => x.key === levelFilter);
        if (b && !(lv >= b.min && lv <= b.max)) return false;
      }
      if (tokens.length) { const t = textOf(it); if (!tokens.every((tok) => t.includes(tok))) return false; }
      return true;
    });
    return groupByType(filtered);
  }, [items, query, qFilter, slotFilter, subtypeFilter, levelFilter]);

  const total = useMemo(() => sections.reduce((n, s) => n + s.data.length, 0), [sections]);
  const multiSection = sections.length > 1;

  // job id -> name, so the detail modal can show "usable by" job names instead of ids
  const jobNames = useMemo(() => {
    const m: Record<number, string> = {};
    jobs.forEach((j) => { m[j.id] = j.name; });
    return m;
  }, [jobs]);

  const renderItem = useCallback(({ item }: { item: NormItem }) => (
    <Row item={item} iconUrl={resolveIconUrl(item, iconPaths)} onPress={() => setDetail(item)} />
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

      {(slotChips.length > 1 || subtypeChips.length > 1 || hasQuality) && (
        <TouchableOpacity style={styles.filterToggle} activeOpacity={0.7}
          onPress={() => setFiltersOpen((o) => !o)}>
          <Text style={styles.filterToggleText}>
            ตัวกรอง{activeFilters ? ` (${activeFilters})` : ""}
          </Text>
          <Text style={styles.filterToggleIcon}>{filtersOpen ? "▲" : "▼"}</Text>
        </TouchableOpacity>
      )}

      {filtersOpen && (
      <View style={styles.filterAreaContent}>
      {slotChips.length > 1 && (
        <View style={styles.filterRow}>
          <TouchableOpacity onPress={() => setSlotFilter(null)}
            style={[styles.fChip, slotFilter == null && styles.fChipOn]}>
            <Text style={[styles.fText, slotFilter == null && styles.fTextOn]}>ทั้งหมด</Text>
          </TouchableOpacity>
          {slotChips.map((c) => {
            const on = slotFilter === c.key;
            return (
              <TouchableOpacity key={c.key} onPress={() => setSlotFilter(on ? null : c.key)}
                style={[styles.fChip, on && styles.fChipOn]}>
                <Text style={[styles.fText, on && styles.fTextOn]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {subtypeChips.length > 1 && (
        <View style={styles.filterRow}>
          <TouchableOpacity onPress={() => setSubtypeFilter(null)}
            style={[styles.fChip, styles.subChip, subtypeFilter == null && styles.fChipOn]}>
            <Text style={[styles.fText, subtypeFilter == null && styles.fTextOn]}>ชนิดทั้งหมด</Text>
          </TouchableOpacity>
          {subtypeChips.map((st) => {
            const on = subtypeFilter === st;
            return (
              <TouchableOpacity key={st} onPress={() => setSubtypeFilter(on ? null : st)}
                style={[styles.fChip, styles.subChip, on && styles.fChipOn]}>
                <Text style={[styles.fText, on && styles.fTextOn]}>{st}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {hasLevel && (
        <View style={styles.filterRow}>
          <TouchableOpacity onPress={() => setLevelFilter(null)}
            style={[styles.fChip, levelFilter == null && styles.fChipOn]}>
            <Text style={[styles.fText, levelFilter == null && styles.fTextOn]}>ทุกเลเวล</Text>
          </TouchableOpacity>
          {LEVEL_BUCKETS.map((b) => {
            const on = levelFilter === b.key;
            return (
              <TouchableOpacity key={b.key} onPress={() => setLevelFilter(on ? null : b.key)}
                style={[styles.fChip, on && styles.fChipOn]}>
                <Text style={[styles.fText, on && styles.fTextOn]}>{b.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
          ListHeaderComponent={<Text style={styles.count}>{total} items</Text>}
          ListEmptyComponent={<Text style={styles.empty}>no results</Text>}
        />
      )}

      {detail && (
        <DetailModal
          item={detail}
          iconUrl={resolveIconUrl(detail, iconPaths)}
          locale={locale}
          jobNames={jobNames}
          onClose={() => setDetail(null)}
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
  localeText: { color: "#8A8F99", fontSize: 12, fontWeight: "bold" },
  localeTextOn: { color: "#0E0F12" },
  search: { marginHorizontal: 16, marginTop: 8, backgroundColor: "#16181D", color: "#F2F3F5",
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  // collapsible filter: a tappable bar toggles the chip area open/closed so it
  // doesn't permanently eat screen space. Active filter count shown in the label.
  filterToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, backgroundColor: "#16181D", borderWidth: 1, borderColor: "#2A2E36" },
  filterToggleText: { color: "#C7CBD1", fontSize: 14, fontWeight: "bold" },
  filterToggleIcon: { color: "#8A8F99", fontSize: 12, fontWeight: "bold" },
  // filter chips live in their own vertical scroll area so many chips (esp.
  // equipment slots + subtypes) stay capped in height and scroll instead of
  // pushing the list down. maxHeight ≈ 3 rows of chips.
  filterArea: { flexGrow: 0, maxHeight: 168 },
  filterAreaContent: { paddingBottom: 4 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, marginTop: 10 },
  chipWrapRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, paddingTop: 8 },
  subChip: { backgroundColor: "#0E0F12" },
  fChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, margin: 4,
    borderWidth: 1, borderColor: "#2A2E36", backgroundColor: "#16181D" },
  fChipOn: { backgroundColor: "#C7CBD1", borderColor: "#C7CBD1" },
  // lineHeight must be generous enough for Thai upper vowels/tone marks (เช่น "ทั้งหมด")
  // or Android clips them; includeFontPadding keeps the top marks inside the line box.
  fText: { color: "#C7CBD1", fontSize: 13, fontWeight: "bold", lineHeight: 20, includeFontPadding: true },
  fTextOn: { color: "#0E0F12", fontWeight: "bold" },
  count: { color: "#6B7079", fontSize: 12, marginLeft: 18, marginVertical: 4 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#0E0F12", paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6 },
  sectionTitle: { color: "#E8B339", fontSize: 15, fontWeight: "bold" },
  sectionCount: { color: "#6B7079", fontSize: 12, fontWeight: "bold" },
  row: { flexDirection: "row", backgroundColor: "#16181D", borderRadius: 12, padding: 12,
    marginHorizontal: 14, marginVertical: 6 },
  iconWrap: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#0E0F12",
    alignItems: "center", justifyContent: "center", marginRight: 12 },
  icon: { width: 48, height: 48 },
  iconFallback: { backgroundColor: "#23262D", borderRadius: 6 },
  body: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  name: { color: "#F2F3F5", fontSize: 15, fontWeight: "bold", flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { color: "#0E0F12", fontSize: 10, fontWeight: "bold" },
  effect: { color: "#C7CBD1", fontSize: 13, lineHeight: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#E06C6C", marginBottom: 12, paddingHorizontal: 24, textAlign: "center" },
  retry: { backgroundColor: "#E8B339", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: "#0E0F12", fontWeight: "bold" },
  empty: { color: "#6B7079", textAlign: "center", marginTop: 40 },
  chipScroll: { paddingTop: 8, flexGrow: 0 },
  chipScrollContent: { paddingHorizontal: 8, alignItems: "center" },
  // Detail modal
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#16181D", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, maxHeight: "85%" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#2A2E36",
    alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  modalIconWrap: { width: 72, height: 72, borderRadius: 10, backgroundColor: "#0E0F12",
    alignItems: "center", justifyContent: "center", marginRight: 14 },
  modalIcon: { width: 60, height: 60 },
  modalTitle: { color: "#F2F3F5", fontSize: 18, fontWeight: "bold", flexShrink: 1 },
  modalSub: { color: "#8A8F99", fontSize: 13, marginTop: 2 },
  modalEffect: { color: "#C7CBD1", fontSize: 14, lineHeight: 20, marginBottom: 4 },
  // equipment facts block (type / jobs / level …) shown above the stat table
  metaBox: { backgroundColor: "#0E0F12", borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 4, marginBottom: 10 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingVertical: 6 },
  metaLabel: { color: "#8A8F99", fontSize: 13, marginRight: 12 },
  metaValue: { color: "#E8B339", fontSize: 13, fontWeight: "bold", flexShrink: 1, textAlign: "right" },
  refineHead: { color: "#8A8F99", fontSize: 12, fontWeight: "bold", marginTop: 10, marginBottom: 2 },
  detailTable: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#23262D" },
  detailRow: { flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#23262D" },
  detailLabel: { color: "#8A8F99", fontSize: 13, flex: 1 },
  detailValue: { color: "#F2F3F5", fontSize: 13, fontWeight: "bold", textAlign: "right", flex: 1 },
  story: { color: "#6B7079", fontSize: 13, fontStyle: "italic", marginTop: 16, lineHeight: 20 },
  closeBtn: { marginTop: 16, backgroundColor: "#23262D", borderRadius: 10,
    paddingVertical: 12, alignItems: "center" },
  closeText: { color: "#F2F3F5", fontSize: 15, fontWeight: "bold" },
});
