import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, useWindowDimensions } from "react-native";
import {
  SafeAreaProvider, useSafeAreaInsets,
} from "react-native-safe-area-context";
import BrowseScreen from "./src/screens/BrowseScreen";
import CharacterScreen from "./src/screens/CharacterScreen";
import SkillsScreen from "./src/screens/SkillsScreen";
import SupportScreen from "./src/screens/SupportScreen";
import GemSetScreen from "./src/screens/GemSetScreen";
import MapScreen from "./src/screens/MapScreen";
import { Kind } from "./src/api/roworlddb";

// "support" (YouTube + donate) and "gemset" (enchant planner) are app-only
// tabs, not dataset Kinds.
type TabKey = Kind | "support" | "gemset";

const TABS: { key: TabKey; label: string }[] = [
  { key: "character", label: "Character" },
  { key: "cards", label: "Cards" },
  { key: "equipment", label: "Equip" },
  { key: "affix", label: "Affix" },
  { key: "gems", label: "Gems" },
  { key: "gemset", label: "Set Gems" },
  { key: "skills", label: "Skills" },
  { key: "monsters", label: "Monster" },
  { key: "pets", label: "Pets" },
  { key: "shop", label: "Shop" },
  { key: "maps", label: "Maps" },
  { key: "apocalypse", label: "Apoc" },
  { key: "runes", label: "Runes" },
  { key: "support", label: "Support" },
];

function Main() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 640;                 // PC / tablet: center a phone-width column
  const [tab, setTab] = useState<TabKey>("cards");
  const [showSupport, setShowSupport] = useState(true); // greet with the Support popup
  const [views, setViews] = useState<number | null>(null);
  const active = TABS.find((t) => t.key === tab)!;

  // page-view counter (Worker /api/views, KV-backed) — count once per load
  useEffect(() => {
    const url = (process.env.EXPO_PUBLIC_DATA_HOST ?? "") + "/api/views";
    fetch(url).then((r) => r.json()).then((d) => setViews(d.count)).catch(() => {});
  }, []);

  return (
    <View style={[styles.root, isWide && styles.rootWide]}>
      <View style={[styles.shell, isWide && styles.shellWide]}>
      {/* launch popup: follow YouTube + donate */}
      <Modal visible={showSupport} transparent animationType="fade"
        onRequestClose={() => setShowSupport(false)}>
        <View style={[styles.popupBg, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={[styles.popupCard, isWide && { maxWidth: 520, alignSelf: "center", width: "100%" }]}>
            <View style={styles.popupHead}>
              <Text style={styles.popupTitle}>ยินดีต้อนรับ 🎉</Text>
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => setShowSupport(false)}>
                <Text style={styles.popupClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}><SupportScreen /></View>
            <TouchableOpacity style={styles.popupEnter} onPress={() => setShowSupport(false)}>
              <Text style={styles.popupEnterText}>เข้าสู่แอป</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>RoworldDB - {active.label}</Text>
        {views != null && (
          <View style={styles.viewsBadge}>
            <Text style={styles.viewsText}>👁 {views.toLocaleString()} ครั้ง</Text>
          </View>
        )}
      </View>
      <View style={styles.screen}>
        {tab === "character" ? (
          <CharacterScreen />
        ) : tab === "skills" ? (
          <SkillsScreen />
        ) : tab === "support" ? (
          <SupportScreen />
        ) : tab === "gemset" ? (
          <GemSetScreen />
        ) : tab === "maps" ? (
          <MapScreen />
        ) : (
          <BrowseScreen key={tab} kind={tab} />
        )}
      </View>
      <View style={[styles.tabBar, { paddingBottom: insets.bottom + 6 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 8 }}>
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <TouchableOpacity key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
                {on && <View style={styles.dot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      </View>
    </View>
  );
}

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#E8F2FD" },
  rootWide: { backgroundColor: "#D7E6F7" },          // soft sky letterbox on PC
  shell: { flex: 1, width: "100%", backgroundColor: "#E8F2FD" },
  shellWide: { maxWidth: 1200, alignSelf: "center" }, // room for the 2-pane layout on PC
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 6, backgroundColor: "#E8F2FD" },
  title: { color: "#41506B", fontSize: 20, fontWeight: "800", letterSpacing: 0.3, flexShrink: 1 },
  viewsBadge: { backgroundColor: "#FFFFFF", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: "#DCE6F4", marginLeft: 8 },
  viewsText: { color: "#5566C7", fontSize: 12, fontWeight: "700" },
  screen: { flex: 1 },
  tabBar: { backgroundColor: "#FFFFFF", paddingTop: 8, borderTopWidth: 1, borderTopColor: "#DCE6F4" },
  tab: { alignItems: "center", paddingHorizontal: 14 },
  tabText: { color: "#8A97AD", fontSize: 13, fontWeight: "700" },
  tabTextOn: { color: "#5566C7" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#6E83E8", marginTop: 3 },

  popupBg: { flex: 1, backgroundColor: "rgba(40,60,100,0.5)", justifyContent: "center", padding: 14 },
  popupCard: { flex: 1, maxHeight: "92%", backgroundColor: "#E8F2FD", borderRadius: 18,
    borderWidth: 1, borderColor: "#DCE6F4", overflow: "hidden" },
  popupHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  popupTitle: { color: "#5566C7", fontSize: 18, fontWeight: "800" },
  popupClose: { color: "#8A97AD", fontSize: 18, fontWeight: "800" },
  popupEnter: { backgroundColor: "#6E83E8", margin: 12, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  popupEnterText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
