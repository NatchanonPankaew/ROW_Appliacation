import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Linking, Platform,
} from "react-native";

// --- channel + donate config -------------------------------------------------
const YT_CHANNEL_URL = "https://www.youtube.com/@NatyayCh";
const YT_HANDLE = "@NatyayCh";

// Donate via PromptPay. The QR image is bundled so it works offline on every
// platform; replace assets/donate-qr.png with your own QR to change the account.
const DONATE_QR = require("../../assets/donate-qr.png");
// YouTube channel cover — replace assets/yt-cover.png with the real banner image.
const YT_COVER = require("../../assets/yt-cover.png");
const DONATE_NAME = "นาย ณัฐชนนท์ ปานแก้ว";
const DONATE_ACCOUNT = "xxx-x-x2284-x";

function openUrl(url: string) {
  if (Platform.OS === "web") {
    (globalThis as any).window?.open(url, "_blank", "noopener,noreferrer");
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

export default function SupportScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ---- YouTube ---- */}
      <View style={styles.card}>
        <TouchableOpacity activeOpacity={0.9} style={styles.coverWrap} onPress={() => openUrl(YT_CHANNEL_URL)}>
          <Image source={YT_COVER} style={styles.cover} resizeMode="cover" />
          <View style={styles.coverPlay}><Text style={styles.coverPlayText}>▶</Text></View>
        </TouchableOpacity>
        <Text style={styles.cardTitle}>ติดตามช่อง YouTube</Text>
        <Text style={styles.cardHandle}>{YT_HANDLE}</Text>
        <Text style={styles.cardDesc}>
          กดติดตามเพื่อไม่พลาดคลิปใหม่ ๆ เกี่ยวกับ Ragnarok World (ROW) และอัปเดตของแอป
        </Text>
        <TouchableOpacity
          style={styles.ytBtn}
          activeOpacity={0.85}
          onPress={() => openUrl(YT_CHANNEL_URL)}
        >
          <Text style={styles.ytBtnText}>เปิด YouTube · ติดตาม</Text>
        </TouchableOpacity>
      </View>

      {/* ---- Donate ---- */}
      <View style={styles.card}>
        <View style={styles.iconBadgeDonate}>
          <Text style={styles.iconBadgeText}>❤</Text>
        </View>
        <Text style={styles.cardTitle}>สนับสนุน (Donate)</Text>
        <Text style={styles.cardDesc}>
          สแกน QR PromptPay ด้านล่างเพื่อสนับสนุนการพัฒนาแอป ขอบคุณมากครับ 🙏
        </Text>

        <View style={styles.qrWrap}>
          <Image source={DONATE_QR} style={styles.qr} resizeMode="contain" />
        </View>

        <Text style={styles.donateLabel}>ชื่อบัญชี</Text>
        <Text style={styles.donateValue}>{DONATE_NAME}</Text>
        <Text style={styles.donateLabel}>เลขบัญชี</Text>
        <Text style={styles.donateValue}>{DONATE_ACCOUNT}</Text>
      </View>

      <Text style={styles.footer}>ขอบคุณที่สนับสนุน RoworldDB ❤</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0F12" },
  content: { padding: 16, paddingBottom: 32 },

  card: {
    backgroundColor: "#16181D",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  iconBadgeYt: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#FF0000",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  iconBadgeDonate: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#E8B339",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  iconBadgeText: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },

  coverWrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: 12, overflow: "hidden",
    marginBottom: 12, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  cover: { width: "100%", height: "100%" },
  coverPlay: { position: "absolute", width: 54, height: 54, borderRadius: 27,
    backgroundColor: "rgba(255,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  coverPlayText: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginLeft: 3 },

  cardTitle: { color: "#F2F3F5", fontSize: 18, fontWeight: "800", lineHeight: 26 },
  cardHandle: { color: "#E8B339", fontSize: 14, fontWeight: "700", marginTop: 2 },
  cardDesc: {
    color: "#C7CBD1", fontSize: 14, lineHeight: 21, marginTop: 8,
    textAlign: "center",
  },

  ytBtn: {
    backgroundColor: "#FF0000", borderRadius: 12, paddingVertical: 12,
    paddingHorizontal: 28, marginTop: 16, alignSelf: "stretch", alignItems: "center",
  },
  ytBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },

  qrWrap: {
    backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, marginTop: 16,
  },
  qr: { width: 220, height: 220 },

  donateLabel: { color: "#8A8F99", fontSize: 12, fontWeight: "700", marginTop: 12 },
  donateValue: { color: "#F2F3F5", fontSize: 15, fontWeight: "700", marginTop: 2 },

  footer: { color: "#6B7079", fontSize: 13, textAlign: "center", marginTop: 8 },
});
