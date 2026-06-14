import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View, Text, TextInput, FlatList, ActivityIndicator,
  TouchableOpacity, StyleSheet, Image, Modal, ScrollView,
} from "react-native";
import {
  fetchIconPaths, resolveIconUrl, IconPaths,
  fetchSkillIndex, fetchJobSkills, skillPathTo, jobPathHasSkills,
  JobNode, SkillNode,
} from "../api/roworlddb";

const LOCALES = ["en-US", "th-TH", "zh-TW"];

// tone-insensitive search so "กันสตัน" matches "กั๊นสตัน" etc.
const norm = (s: string) => s.toLowerCase().replace(/[็-๎]/g, "");

const stripTags = (s: any) =>
  String(s ?? "")
    .replace(/<color=#?[0-9a-fA-F]+>/g, "")
    .replace(/<\/color>/g, "")
    .replace(/\n/g, " ")
    .trim();

// best description available for a skill (max natural level, fall back to lv1)
function skillDesc(s: SkillNode): string {
  if (!s.levels) return "";
  const lvl = s.naturalMax || s.maxLevel || 1;
  const lv =
    s.levels[lvl] || s.levels[String(lvl)] || s.levels[1] || s.levels["1"];
  return lv ? stripTags(lv.des || lv.skilldes || "") : "";
}

/* ---- one skill row inside the detail sheet ---- */
function SkillRow({ skill, iconUrl }: { skill: SkillNode; iconUrl: string | null }) {
  const desc = skillDesc(skill);
  return (
    <View style={styles.skillRow}>
      <View style={styles.skillIconWrap}>
        {iconUrl ? (
          <Image source={{ uri: iconUrl }} style={styles.skillIcon} resizeMode="contain" />
        ) : (
          <View style={[styles.skillIcon, styles.iconFallback]} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.skillTitleRow}>
          <Text style={styles.skillName} numberOfLines={1}>{skill.name}</Text>
          <View style={[styles.kindBadge, skill.passive ? styles.passiveBadge : styles.activeBadge]}>
            <Text style={styles.kindBadgeText}>{skill.passive ? "Passive" : "Active"}</Text>
          </View>
        </View>
        <Text style={styles.skillMeta}>เลเวลสูงสุด {skill.maxLevel}</Text>
        {!!desc && <Text style={styles.skillDesc} numberOfLines={4}>{desc}</Text>}
      </View>
    </View>
  );
}

/* ---- detail sheet: loads the whole job path's skills, grouped by tier ---- */
function JobSkillsModal({ jobId, index, locale, iconPaths, onClose }: {
  jobId: number; index: Record<number, JobNode>; locale: string;
  iconPaths: IconPaths | null; onClose: () => void;
}) {
  const [skills, setSkills] = useState<Record<number, SkillNode[]>>({});
  const [loading, setLoading] = useState(true);

  const path = useMemo(() => skillPathTo(index, jobId), [index, jobId]);

  useEffect(() => {
    let ok = true;
    setLoading(true);
    Promise.all(
      path.map((id) =>
        fetchJobSkills(id, locale)
          .then((r) => [id, r.skills] as [number, SkillNode[]])
          .catch(() => [id, [] as SkillNode[]] as [number, SkillNode[]])
      )
    ).then((pairs) => {
      if (!ok) return;
      const next: Record<number, SkillNode[]> = {};
      pairs.forEach(([id, sk]) => (next[id] = sk));
      setSkills(next);
      setLoading(false);
    });
    return () => { ok = false; };
  }, [path, locale]);

  const skillIcon = (icon?: string) =>
    resolveIconUrl(
      { iconName: icon, iconUrl: icon ? "skill/" + icon + ".webp" : undefined } as any,
      iconPaths
    );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{index[jobId]?.name}</Text>
          <Text style={styles.modalSub}>{path.map((id) => index[id]?.name).filter(Boolean).join(" → ")}</Text>

          {loading ? (
            <ActivityIndicator color="#E8B339" style={{ marginTop: 24 }} />
          ) : (
            <ScrollView style={{ marginTop: 12 }} contentContainerStyle={{ paddingBottom: 16 }}>
              {path.map((id) => {
                const list = skills[id] || [];
                if (!list.length) return null;
                return (
                  <View key={id} style={{ marginBottom: 8 }}>
                    <View style={styles.tierHead}>
                      <Text style={styles.tierTitle}>{index[id]?.name}</Text>
                      <Text style={styles.tierCount}>{list.length}</Text>
                    </View>
                    {list.map((s) => (
                      <SkillRow key={s.kindId} skill={s} iconUrl={skillIcon(s.icon)} />
                    ))}
                  </View>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>ปิด</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function SkillsScreen() {
  const [locale, setLocale] = useState("th-TH");
  const [index, setIndex] = useState<Record<number, JobNode> | null>(null);
  const [iconPaths, setIconPaths] = useState<IconPaths | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const load = useCallback(async (loc: string) => {
    setLoading(true);
    setError(null);
    try {
      const [idx, icons] = await Promise.all([fetchSkillIndex(loc), fetchIconPaths()]);
      setIndex(idx);
      setIconPaths(icons);
    } catch (e: any) {
      setError(e.message || "load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(locale); }, [locale, load]);

  // jobs that actually have a skill tree, searchable, ordered by job progression
  const jobs = useMemo(() => {
    if (!index) return [];
    const tokens = norm(query.trim()).split(/\s+/).filter(Boolean);
    return Object.values(index)
      .filter((j) => j.id !== 101 && jobPathHasSkills(index, j.id))
      .filter((j) => {
        if (!tokens.length) return true;
        const path = skillPathTo(index, j.id).map((id) => index[id]?.name).join(" ");
        const t = norm(j.name + " " + path);
        return tokens.every((tok) => t.includes(tok));
      })
      .sort((a, b) => a.id - b.id);
  }, [index, query]);

  const skillIcon = (icon?: string) =>
    resolveIconUrl(
      { iconName: icon, iconUrl: icon ? "skill/" + icon + ".webp" : undefined } as any,
      iconPaths
    );

  const renderJob = useCallback(({ item }: { item: JobNode }) => {
    const path = index ? skillPathTo(index, item.id).map((id) => index[id]?.name).filter(Boolean) : [];
    const url = skillIcon(item.icon);
    return (
      <TouchableOpacity style={styles.jobRow} activeOpacity={0.75} onPress={() => setSelected(item.id)}>
        <View style={styles.jobIconWrap}>
          {url ? (
            <Image source={{ uri: url }} style={styles.jobIcon} resizeMode="contain" />
          ) : (
            <View style={[styles.jobIcon, styles.iconFallback]} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.jobName} numberOfLines={1}>{item.name}</Text>
          {path.length > 1 && (
            <Text style={styles.jobPath} numberOfLines={1}>{path.join(" → ")}</Text>
          )}
        </View>
        <Text style={styles.chev}>›</Text>
      </TouchableOpacity>
    );
  }, [index, iconPaths]);

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

      <TextInput style={styles.search} placeholder="ค้นหาอาชีพ เช่น Knight อัศวิน"
        placeholderTextColor="#6B7079" value={query} onChangeText={setQuery} />

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
        <FlatList
          data={jobs}
          keyExtractor={(j) => String(j.id)}
          renderItem={renderJob}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 16 }}
          initialNumToRender={15}
          ListHeaderComponent={<Text style={styles.count}>{jobs.length} อาชีพ</Text>}
          ListEmptyComponent={<Text style={styles.empty}>ไม่พบอาชีพ</Text>}
        />
      )}

      {selected != null && index && (
        <JobSkillsModal
          jobId={selected}
          index={index}
          locale={locale}
          iconPaths={iconPaths}
          onClose={() => setSelected(null)}
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
  count: { color: "#6B7079", fontSize: 12, marginLeft: 18, marginVertical: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#E06C6C", marginBottom: 12, paddingHorizontal: 24, textAlign: "center" },
  retry: { backgroundColor: "#E8B339", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: "#0E0F12", fontWeight: "bold" },
  empty: { color: "#6B7079", textAlign: "center", marginTop: 40 },

  // job list row
  jobRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#16181D", borderRadius: 12,
    padding: 12, marginHorizontal: 14, marginVertical: 6 },
  jobIconWrap: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#0E0F12",
    alignItems: "center", justifyContent: "center", marginRight: 12 },
  jobIcon: { width: 40, height: 40 },
  iconFallback: { backgroundColor: "#23262D", borderRadius: 6 },
  jobName: { color: "#F2F3F5", fontSize: 15, fontWeight: "bold", lineHeight: 22 },
  jobPath: { color: "#8A8F99", fontSize: 12, lineHeight: 18, marginTop: 2 },
  chev: { color: "#6B7079", fontSize: 22, marginLeft: 8 },

  // detail modal
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#16181D", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, maxHeight: "88%" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#2A2E36",
    alignSelf: "center", marginBottom: 14 },
  modalTitle: { color: "#F2F3F5", fontSize: 18, fontWeight: "bold", lineHeight: 26 },
  modalSub: { color: "#8A8F99", fontSize: 13, lineHeight: 19, marginTop: 2 },

  tierHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 10, paddingBottom: 6 },
  tierTitle: { color: "#E8B339", fontSize: 15, fontWeight: "bold", lineHeight: 22 },
  tierCount: { color: "#6B7079", fontSize: 12, fontWeight: "bold" },

  // skill row
  skillRow: { flexDirection: "row", backgroundColor: "#0E0F12", borderRadius: 10,
    padding: 10, marginBottom: 6 },
  skillIconWrap: { width: 40, height: 40, borderRadius: 8, backgroundColor: "#16181D",
    alignItems: "center", justifyContent: "center", marginRight: 10 },
  skillIcon: { width: 32, height: 32 },
  skillTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  skillName: { color: "#F2F3F5", fontSize: 14, fontWeight: "bold", flex: 1, marginRight: 8, lineHeight: 21 },
  kindBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  activeBadge: { backgroundColor: "#4F8EE6" },
  passiveBadge: { backgroundColor: "#5DBB63" },
  kindBadgeText: { color: "#0E0F12", fontSize: 10, fontWeight: "bold", lineHeight: 15 },
  skillMeta: { color: "#8A8F99", fontSize: 12, lineHeight: 18 },
  skillDesc: { color: "#C7CBD1", fontSize: 13, lineHeight: 19, marginTop: 3 },

  closeBtn: { marginTop: 14, backgroundColor: "#23262D", borderRadius: 10,
    paddingVertical: 12, alignItems: "center" },
  closeText: { color: "#F2F3F5", fontSize: 15, fontWeight: "bold" },
});
