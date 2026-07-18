import React, { useMemo, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Modal, ScrollView, FlatList,
} from "react-native";
import { GEM_DEFS, GemDef, gemIconUrl, qualityInfo } from "../api/roworlddb";

/* ============================================================================
 * Set Gems — standalone enchant planner that mirrors the in-game 附魔 screen.
 * Real rules (from the game UI):
 *   - 7 enchantable pieces: weapon / armor / off-hand / cape / shoes / acc L+R
 *   - 3 sockets per piece; two-handed weapons have 4
 *   - a piece can hold only ONE stone of the same name (no duplicates per piece)
 *   - a SET is a specific stone recipe; it activates only on a 100% match and
 *     socketing stones outside the recipe breaks it
 * Per-level numbers / full recipe list aren't in any public dataset — the two
 * recipes below are the ones readable from the TW guide's screenshots.
 * ========================================================================== */

const SLOTS: { key: string; label: string }[] = [
  { key: "weapon", label: "อาวุธ" },
  { key: "armor", label: "เกราะ" },
  { key: "offhand", label: "มือรอง" },
  { key: "garment", label: "ผ้าคลุม" },
  { key: "shoes", label: "รองเท้า" },
  { key: "accL", label: "เครื่องประดับซ้าย" },
  { key: "accR", label: "เครื่องประดับขวา" },
];

// Known set recipes. The in-game set list is PER CLASS BUILD (the tag beside a
// set's name is the build it belongs to, e.g. 敏捷射手 = the Gunslinger auto
// build). No public source lists every class's recipes — entries here are
// transcribed from in-game screenshots; `slot` is the piece the set was seen
// on ("weapon" | "armor" | "offhand" | "garment" | "shoes" | "accL" | "accR").
// Add new lines as screenshots come in: name = Thai + (原文), effect = build
// tag shown beside the set, stones = the required gem item-ids in GEM_DEFS.
const RECIPES: { name: string; effect: string; slot: string; stones: number[] }[] = [
  { name: "ความเร็วระเบิด (爆發速度) · สายปืนออโต้", effect: "敏捷射手", slot: "weapon", stones: [14135019, 14135021, 14135032, 14135028] },
  { name: "ไม่ย่อท้อ (不屈) · สายปืนสไนป์", effect: "致命狙擊", slot: "weapon", stones: [14135019, 14135021, 14135034, 14135028] },
];

const gemById = (id?: number) => (id == null ? undefined : GEM_DEFS.find((g) => g.id === id));
const shortName = (g: GemDef) => g.th.replace(/^อัญมณี\s*/, "");

type PieceState = (number | undefined)[];          // socket index -> gem id

/* ---- stone picker for one socket ---- */
function StonePicker({ usedIds, onPick, onClear, hasStone, onClose }: {
  usedIds: number[]; onPick: (id: number) => void; onClear: () => void;
  hasStone: boolean; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const data = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().replace(/[็-๎]/g, "");
    const tokens = norm(q.trim()).split(/\s+/).filter(Boolean);
    return GEM_DEFS.filter((g) => {
      if (!tokens.length) return true;
      const t = norm([g.th, g.en, g.zh, ...g.thFx].join(" "));
      return tokens.every((tok) => t.includes(tok));
    });
  }, [q]);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.modalTitle}>เลือกเม็ดใส่รูนี้</Text>
            {hasStone && (
              <TouchableOpacity onPress={() => { onClear(); onClose(); }}>
                <Text style={styles.clearText}>ถอดเม็ดนี้</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.modalSub}>กติกาเกม: ในชิ้นเดียวกันห้ามใส่เม็ดชื่อซ้ำ — เม็ดที่ใช้แล้วจะกดไม่ได้</Text>
          <TextInput style={styles.search} placeholder="ค้นหาเม็ด เช่น จิตนักสู้ Sharp Magic"
            placeholderTextColor="#6B7079" value={q} onChangeText={setQ} />
          <FlatList
            data={data} keyExtractor={(g) => String(g.id)} style={{ marginTop: 8 }}
            initialNumToRender={14} keyboardShouldPersistTaps="handled"
            renderItem={({ item: g }) => {
              const used = usedIds.includes(g.id);
              const qi = qualityInfo(g.quality);
              return (
                <TouchableOpacity activeOpacity={0.7} disabled={used}
                  onPress={() => { onPick(g.id); onClose(); }}
                  style={[styles.pickRow, used && { opacity: 0.35 }, g.group === "tw" && !used && { opacity: 0.6 }]}>
                  <Image source={{ uri: gemIconUrl(g) }} style={styles.pickIcon} resizeMode="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickName, qi && { color: qi.color }]} numberOfLines={1}>
                      {g.th}{g.group === "tw" ? " (TW)" : ""}{used ? " — ใส่แล้วในชิ้นนี้" : ""}
                    </Text>
                    <Text style={styles.pickFx} numberOfLines={2}>{g.thFx[0]}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Text style={styles.closeText}>ปิด</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function GemSetScreen() {
  const [pieces, setPieces] = useState<Record<string, PieceState>>({});
  const [twoHanded, setTwoHanded] = useState(false);
  const [open, setOpen] = useState<{ slot: string; idx: number } | null>(null);

  const socketCount = (slotKey: string) => (slotKey === "weapon" && twoHanded ? 4 : 3);
  const pieceOf = (slotKey: string): PieceState => {
    const cur = pieces[slotKey] || [];
    return Array.from({ length: socketCount(slotKey) }, (_, i) => cur[i]);
  };
  const setSocket = (slotKey: string, idx: number, id?: number) =>
    setPieces((p) => {
      const next = pieceOf(slotKey).slice();
      next[idx] = id;
      return { ...p, [slotKey]: next };
    });
  const clearPiece = (slotKey: string) => setPieces((p) => ({ ...p, [slotKey]: [] }));

  // a piece completes a known recipe when its stones match the recipe exactly
  const matchedRecipe = (slotKey: string) => {
    const ids = pieceOf(slotKey).filter((v): v is number => v != null).sort();
    return RECIPES.find((r) =>
      r.stones.length === ids.length && r.stones.slice().sort().every((v, i) => v === ids[i]));
  };

  const applyRecipe = (slotKey: string, stones: number[]) =>
    setPieces((p) => ({ ...p, [slotKey]: stones.slice() }));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 28 }}>
        <Text style={styles.pageHint}>
          จัดเม็ดให้อุปกรณ์ทีละชิ้นตามกติกาจริง: ชิ้นละ 3 รู (อาวุธสองมือ 4 รู) · ห้ามเม็ดชื่อซ้ำในชิ้นเดียว ·
          เซ็ตจะทำงานเมื่อใส่ตรงสูตร 100%
        </Text>

        {SLOTS.map((s) => {
          const piece = pieceOf(s.key);
          const filled = piece.filter((v) => v != null).length;
          const recipe = matchedRecipe(s.key);
          return (
            <View key={s.key} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{s.label}</Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {s.key === "weapon" && (
                    <TouchableOpacity style={[styles.twBtn, twoHanded && styles.twBtnOn]}
                      onPress={() => setTwoHanded((v) => !v)}>
                      <Text style={[styles.twBtnText, twoHanded && { color: "#FFFFFF" }]}>สองมือ (4 รู)</Text>
                    </TouchableOpacity>
                  )}
                  {filled > 0 && (
                    <TouchableOpacity onPress={() => clearPiece(s.key)}>
                      <Text style={styles.clearText}>ล้าง</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.socketRow}>
                {piece.map((id, i) => {
                  const g = gemById(id);
                  return (
                    <TouchableOpacity key={i} style={[styles.socket, g && styles.socketFilled]}
                      onPress={() => setOpen({ slot: s.key, idx: i })}>
                      {g ? (
                        <>
                          <Image source={{ uri: gemIconUrl(g) }} style={styles.socketIcon} resizeMode="contain" />
                          <Text style={styles.socketName} numberOfLines={1}>{shortName(g)}</Text>
                        </>
                      ) : (
                        <Text style={styles.socketPlus}>＋</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {recipe ? (
                <View style={styles.recipeDone}>
                  <Text style={styles.recipeDoneText}>✓ เซ็ตครบสูตร: {recipe.name} — {recipe.effect}</Text>
                </View>
              ) : filled > 0 ? (
                <Text style={styles.pieceNote}>{filled}/{piece.length} รู — ใส่ให้ตรงสูตรเซ็ตในเกมเพื่อเปิดโบนัส</Text>
              ) : null}

              {RECIPES.some((r) => r.slot === s.key) && (
                <View style={styles.recipeRow}>
                  <Text style={styles.recipeLabel}>สูตรที่ยืนยันแล้วของชิ้นนี้ (เกมแสดงเซ็ตแยกตามสายอาชีพ):</Text>
                  {RECIPES.filter((r) => r.slot === s.key).map((r) => {
                    const ok = piece.length === r.stones.length;
                    return (
                      <TouchableOpacity key={r.name} disabled={!ok}
                        style={[styles.recipeBtn, !ok && { opacity: 0.4 }]}
                        onPress={() => applyRecipe(s.key, r.stones)}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          {r.stones.map((id) => {
                            const g = gemById(id)!;
                            return <Image key={id} source={{ uri: gemIconUrl(g) }} style={styles.recipeIcon} resizeMode="contain" />;
                          })}
                          <Text style={styles.recipeBtnText} numberOfLines={1}>{r.name}{!ok ? ` · ต้อง ${r.stones.length} รู` : ""}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <Text style={styles.footNote}>
          เซ็ตในเกมผูกกับสายอาชีพ (ป้ายข้างชื่อเซ็ตคือสายที่ใช้ได้) แต่สูตรของแต่ละอาชีพยังไม่มีใครรวบรวมเป็นตาราง
          สาธารณะ — เปิดหน้าเอนแชนท์ในเกม (กระเป๋า → อุปกรณ์ → เอนแชนท์) ดูรายชื่อเม็ดของเซ็ตสายคุณ แล้วจัดตามได้เลย
          (รายละเอียดเม็ดแต่ละชนิดอยู่ในแท็บ Gems)
        </Text>
      </ScrollView>

      {open && (
        <StonePicker
          usedIds={pieceOf(open.slot).filter((v, i): v is number => v != null && i !== open.idx)}
          hasStone={pieceOf(open.slot)[open.idx] != null}
          onPick={(id) => setSocket(open.slot, open.idx, id)}
          onClear={() => setSocket(open.slot, open.idx, undefined)}
          onClose={() => setOpen(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8F2FD" },
  pageHint: { color: "#5A6781", fontSize: 12, lineHeight: 18, marginBottom: 10 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: "#DCE6F4",
    padding: 12, marginBottom: 12 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  cardTitle: { color: "#41506B", fontSize: 15, fontWeight: "800" },
  twBtn: { borderRadius: 999, borderWidth: 1, borderColor: "#C9D6EE", paddingHorizontal: 10,
    paddingVertical: 4, marginRight: 10, backgroundColor: "#FFFFFF" },
  twBtnOn: { backgroundColor: "#6E83E8", borderColor: "#6E83E8" },
  twBtnText: { color: "#5A6781", fontSize: 11, fontWeight: "bold" },
  clearText: { color: "#E0564E", fontSize: 12, fontWeight: "bold" },
  socketRow: { flexDirection: "row" },
  socket: { flex: 1, minHeight: 74, borderRadius: 12, borderWidth: 1.5, borderColor: "#C9D6EE",
    borderStyle: "dashed", backgroundColor: "#F1F6FC", alignItems: "center", justifyContent: "center",
    marginRight: 8, paddingVertical: 8, paddingHorizontal: 2 },
  socketFilled: { borderStyle: "solid", borderColor: "#A9BBE0", backgroundColor: "#EAF1FB" },
  socketPlus: { color: "#8A97AD", fontSize: 22, fontWeight: "300" },
  socketIcon: { width: 34, height: 34 },
  socketName: { color: "#41506B", fontSize: 9, fontWeight: "700", marginTop: 3 },
  recipeDone: { backgroundColor: "#FFF8E6", borderRadius: 8, borderWidth: 1, borderColor: "#E8B339",
    paddingVertical: 6, paddingHorizontal: 10, marginTop: 10 },
  recipeDoneText: { color: "#8A6D1F", fontSize: 12, fontWeight: "bold" },
  pieceNote: { color: "#8A97AD", fontSize: 11, marginTop: 8 },
  recipeRow: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#E6EDF7", paddingTop: 8 },
  recipeLabel: { color: "#8A97AD", fontSize: 11, fontWeight: "bold", marginBottom: 6 },
  recipeBtn: { backgroundColor: "#F1F6FC", borderRadius: 10, borderWidth: 1, borderColor: "#DCE6F4",
    paddingVertical: 6, paddingHorizontal: 8, marginBottom: 6 },
  recipeIcon: { width: 18, height: 18, marginRight: 3 },
  recipeBtnText: { color: "#41506B", fontSize: 12, fontWeight: "700", marginLeft: 6, flexShrink: 1 },
  footNote: { color: "#8A97AD", fontSize: 11, lineHeight: 17, marginTop: 4 },
  // picker modal
  modalBg: { flex: 1, backgroundColor: "rgba(40,60,100,0.45)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#F4F8FE", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24, maxHeight: "85%" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#C9D6EE",
    alignSelf: "center", marginBottom: 12 },
  modalTitle: { color: "#41506B", fontSize: 17, fontWeight: "800" },
  modalSub: { color: "#8A97AD", fontSize: 11, marginTop: 4 },
  search: { marginTop: 10, backgroundColor: "#FFFFFF", color: "#41506B", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, borderWidth: 1, borderColor: "#DCE6F4" },
  pickRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10,
    padding: 10, marginBottom: 6, borderWidth: 1, borderColor: "#DCE6F4" },
  pickIcon: { width: 32, height: 32, marginRight: 10 },
  pickName: { color: "#41506B", fontSize: 13, fontWeight: "bold" },
  pickFx: { color: "#8A97AD", fontSize: 11, marginTop: 1 },
  closeBtn: { marginTop: 10, backgroundColor: "#6E83E8", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  closeText: { color: "#FFFFFF", fontSize: 15, fontWeight: "bold" },
});
