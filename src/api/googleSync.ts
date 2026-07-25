// Google sign-in (web only) + syncing a signed-in player's Maps preferences
// (collected points, icon size, which layers are shown/hidden, "hide
// collected" toggle) against the Cloudflare Worker's /api/sync/maps
// endpoint (worker/index.js) — sign in on one device, everything's there
// on the next instead of living only in that one browser's storage.
//
// One-time setup this still depends on — see README-google-sync.md: a
// Cloudflare KV namespace bound as MAPS_SYNC. The client id below is public
// by design (OAuth web client ids are meant to ship in frontend JS; only the
// configured "Authorized JavaScript origins" and the consent screen actually
// gate anything) so it's hardcoded rather than threaded through per-deploy-
// target env vars.
import { Platform } from "react-native";

const HOST = process.env.EXPO_PUBLIC_DATA_HOST ?? "";
const CLIENT_ID = "216272524109-64polq30f6gqg2oi5cdm7ke2e19v653o.apps.googleusercontent.com";

export interface GoogleProfile { sub: string; email: string; name: string; picture?: string; }
export interface MapsSyncRecord {
  collected: Record<string, true>;
  iconScale: number | null;
  visible: Record<string, boolean> | null;
  hideCollected: boolean | null;
  updatedAt: number;
}
export interface MapsSyncPush {
  collected: Record<string, true>;
  iconScale: number;
  visible: Record<string, boolean>;
  hideCollected: boolean;
}

// Google Identity Services signs each session with a fresh, short-lived (~1hr)
// ID token rather than a long-lived session — kept in memory only (not
// persisted) since re-running init() below with auto_select re-obtains one
// silently on reload as long as the browser still has an active Google
// session, which covers "stay signed in" well enough for this use case.
let idToken: string | null = null;
let profile: GoogleProfile | null = null;

export function isGoogleSyncConfigured(): boolean {
  return Platform.OS === "web" && !!CLIENT_ID;
}

export function getSignedInProfile(): GoogleProfile | null {
  return profile;
}

// This module only ever runs on web (every export checks isGoogleSyncConfigured()
// first) — window/document/atob exist there, but RN's TS lib config has no DOM,
// so go through `webGlobal` rather than pulling in @types/dom project-wide.
const webGlobal = globalThis as any;

function decodeIdToken(token: string): GoogleProfile {
  const payload = JSON.parse(webGlobal.atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  return { sub: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
}

let scriptPromise: Promise<void> | null = null;
function loadGsiScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (webGlobal.google?.accounts?.id) { resolve(); return; }
    const s = webGlobal.document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("failed to load Google Identity Services"));
    webGlobal.document.head.appendChild(s);
  });
  return scriptPromise;
}

// Renders the "Sign in with Google" button into the given DOM element (the
// underlying node of a RN Web <View> ref) and resolves with the signed-in
// profile once the player completes sign-in. auto_select lets a returning
// player with an active Google session get silently re-authenticated instead
// of having to click through the button every visit.
export async function renderGoogleSignIn(
  container: any,
  onSignedIn: (profile: GoogleProfile) => void
): Promise<void> {
  if (!isGoogleSyncConfigured() || !container) return;
  await loadGsiScript();
  const google = webGlobal.google;
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    auto_select: true,
    callback: (resp: { credential: string }) => {
      idToken = resp.credential;
      profile = decodeIdToken(resp.credential);
      onSignedIn(profile);
    },
  });
  google.accounts.id.renderButton(container, { theme: "outline", size: "medium", shape: "pill" });
  google.accounts.id.prompt(); // One Tap, for returning players
}

export function signOutGoogle(): void {
  idToken = null;
  profile = null;
  webGlobal.google?.accounts?.id?.disableAutoSelect?.();
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!idToken) throw new Error("not signed in");
  return fetch(HOST + path, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: "Bearer " + idToken, "content-type": "application/json" },
  });
}

export async function pullMapsSync(): Promise<MapsSyncRecord | null> {
  const res = await authedFetch("/api/sync/maps");
  if (!res.ok) return null;
  return res.json();
}

export async function pushMapsSync(data: MapsSyncPush): Promise<boolean> {
  const res = await authedFetch("/api/sync/maps", { method: "POST", body: JSON.stringify(data) });
  return res.ok;
}
