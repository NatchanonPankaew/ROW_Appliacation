import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { qualityInfo, Card } from "../api/roworlddb";

// fallback so the card still renders even when it has no quality
const NO_QUALITY = { label: "", color: "#2A2E36" };

function CardItem({ card, iconUrl }: { card: Card; iconUrl: string | null }) {
  const q = qualityInfo(card.quality) ?? NO_QUALITY;
  return (
    <View style={[styles.row, { borderLeftColor: q.color }]}>
      <View style={styles.iconWrap}>
        {iconUrl ? (
          <Image source={{ uri: iconUrl }} style={styles.icon} resizeMode="contain" />
        ) : (
          <View style={[styles.icon, styles.iconFallback]} />
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>{card.name}</Text>
          {!!q.label && (
            <View style={[styles.badge, { backgroundColor: q.color }]}>
              <Text style={styles.badgeText}>{q.label}</Text>
            </View>
          )}
        </View>
        {!!card.card_type_name && <Text style={styles.type}>{card.card_type_name}</Text>}
        {(card.effect_lines || [card.effect]).filter(Boolean).map((line, i) => (
          <Text key={i} style={styles.effect}>{line}</Text>
        ))}
      </View>
    </View>
  );
}

export default React.memo(CardItem);

const styles = StyleSheet.create({
  row: { flexDirection: "row", backgroundColor: "#16181D", borderRadius: 12,
    padding: 12, marginHorizontal: 14, marginVertical: 6, borderLeftWidth: 4 },
  iconWrap: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#0E0F12",
    alignItems: "center", justifyContent: "center", marginRight: 12 },
  icon: { width: 48, height: 48 },
  iconFallback: { backgroundColor: "#23262D", borderRadius: 6 },
  body: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  name: { color: "#F2F3F5", fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { color: "#0E0F12", fontSize: 10, fontWeight: "800" },
  type: { color: "#8A8F99", fontSize: 12, marginBottom: 4 },
  effect: { color: "#C7CBD1", fontSize: 13, lineHeight: 18 },
});
