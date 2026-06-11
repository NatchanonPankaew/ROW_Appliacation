import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import {
  SafeAreaProvider, useSafeAreaInsets,
} from "react-native-safe-area-context";
import BrowseScreen from "./src/screens/BrowseScreen";
import CharacterScreen from "./src/screens/CharacterScreen";
import { Kind } from "./src/api/roworlddb";

const TABS: { key: Kind; label: string }[] = [
  { key: "character", label: "Character" },
  { key: "cards", label: "Cards" },
  { key: "equipment", label: "Equip" },
  { key: "skills", label: "Skills" },
  { key: "monsters", label: "Monster" },
  { key: "pets", label: "Pets" },
  { key: "shop", label: "Shop" },
  { key: "maps", label: "Maps" },
  { key: "apocalypse", label: "Apoc" },
  { key: "runes", label: "Runes" },
];

function Main() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Kind>("cards");
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>RoworldDB - {active.label}</Text>
      </View>
      <View style={styles.screen}>
        {tab === "character" ? (
          <CharacterScreen />
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
  root: { flex: 1, backgroundColor: "#0E0F12" },
  header: { paddingHorizontal: 16, paddingBottom: 6, backgroundColor: "#0E0F12" },
  title: { color: "#F2F3F5", fontSize: 20, fontWeight: "800", letterSpacing: 0.3 },
  screen: { flex: 1 },
  tabBar: { backgroundColor: "#16181D", paddingTop: 8, borderTopWidth: 1, borderTopColor: "#23262D" },
  tab: { alignItems: "center", paddingHorizontal: 14 },
  tabText: { color: "#8A8F99", fontSize: 13, fontWeight: "700" },
  tabTextOn: { color: "#E8B339" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#E8B339", marginTop: 3 },
});
