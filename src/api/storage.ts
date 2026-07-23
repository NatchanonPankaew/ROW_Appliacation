// Tiny cross-platform key/value JSON store. Web uses the browser's
// localStorage directly (fully synchronous, no native module needed); native
// lazily requires AsyncStorage so web bundles never pull in native code.
import { Platform } from "react-native";

let native: typeof import("@react-native-async-storage/async-storage").default | null = null;
function nativeStorage() {
  if (!native) native = require("@react-native-async-storage/async-storage").default;
  return native!;
}

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = Platform.OS === "web"
      ? (globalThis as any).localStorage?.getItem(key) ?? null
      : await nativeStorage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    const raw = JSON.stringify(value);
    if (Platform.OS === "web") (globalThis as any).localStorage?.setItem(key, raw);
    else await nativeStorage().setItem(key, raw);
  } catch {
    /* best-effort: a failed save just means progress isn't remembered */
  }
}
