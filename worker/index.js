// Gate the self-hosted dataset (/data) and images (/media) so they can only be
// loaded by our own site — deters hotlinking / casual scraping of the dataset.
//
// The web app fetches these same-origin, which browsers tag with
// `Sec-Fetch-Site: same-origin` (a header page JS cannot forge). Direct hits
// (curl, another site hotlinking, opening the URL in a new tab) lack that, so
// they get a 403. This is a deterrent, not hard DRM — a determined client can
// still spoof headers.
//
// NOTE: native (Android/iOS) builds load from EXPO_PUBLIC_DATA_HOST cross-origin
// and would be blocked. If you ship native, send a shared secret header from the
// app and allow it here (see ALLOW_TOKEN below).
const ALLOW_TOKEN = "mimir-7sK2pZ9q-app"; // native sends this as `x-app-key` (EXPO_PUBLIC_APP_KEY)

function allowed(request, url) {
  if (ALLOW_TOKEN && request.headers.get("x-app-key") === ALLOW_TOKEN) return true;
  const site = request.headers.get("Sec-Fetch-Site");
  if (site === "same-origin" || site === "same-site") return true;
  const host = url.host;
  const ref = request.headers.get("Referer") || "";
  const origin = request.headers.get("Origin") || "";
  return ref.includes(host) || origin.includes(host);
}

const CORS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
};

// Must match src/api/googleSync.ts's CLIENT_ID — public by design (OAuth web
// client ids are meant to ship in frontend JS), so hardcoded here too rather
// than threaded through wrangler.jsonc vars.
const GOOGLE_CLIENT_ID = "216272524109-64polq30f6gqg2oi5cdm7ke2e19v653o.apps.googleusercontent.com";

// Verifies a Google Identity Services ID token by asking Google directly
// (simplest correct option in a Worker — no JWKS fetch/cache/JWT-verify code
// to maintain) and checks it was issued for *our* OAuth client, not someone
// else's. Returns the token payload (has .sub, the stable per-Google-account
// id we key synced data on) or null if it doesn't check out.
async function verifyGoogleIdToken(idToken) {
  if (!idToken) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken));
    if (!res.ok) return null;
    const payload = await res.json();
    if (payload.aud !== GOOGLE_CLIENT_ID) return null;
    return payload;
  } catch {
    // A network blip reaching Google shouldn't surface as a bare 500 —
    // treat it the same as a bad/expired token (401), which the client
    // already handles as "not signed in" rather than a hard crash.
    return null;
  }
}

// Signed-in players' Maps preferences (collected points, icon size, which
// layers are shown/hidden, "hide collected" toggle), keyed by their Google
// account id (KV binding: MAPS_SYNC). Web-only for now.
async function handleMapsSync(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: { ...CORS, "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "authorization,content-type" },
    });
  }
  const idToken = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const payload = await verifyGoogleIdToken(idToken);
  if (!payload) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });
  const uid = payload.sub;

  if (request.method === "GET") {
    // A KV read failure (e.g. daily put()/get() quota on the free tier — the
    // same limit that once took down /api/views, see the try/catch there)
    // used to throw uncaught here, returning a raw 500 instead of JSON. The
    // client's pullMapsSync() already treats a non-ok response as "nothing
    // synced yet" (res.ok check, falls back to {}), so degrading to that same
    // empty record on a KV error is safe — it just means this pull is a
    // no-op merge instead of the app crashing.
    let stored = null;
    try {
      stored = await env.MAPS_SYNC.get(uid);
    } catch {}
    return new Response(stored || JSON.stringify({ collected: {}, iconScale: null, visible: null, hideCollected: null, updatedAt: 0 }), { headers: CORS });
  }
  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return new Response(JSON.stringify({ error: "bad body" }), { status: 400, headers: CORS });
    const record = {
      collected: body.collected && typeof body.collected === "object" ? body.collected : {},
      iconScale: typeof body.iconScale === "number" ? body.iconScale : null,
      visible: body.visible && typeof body.visible === "object" ? body.visible : null,
      hideCollected: typeof body.hideCollected === "boolean" ? body.hideCollected : null,
      updatedAt: Date.now(),
    };
    try {
      await env.MAPS_SYNC.put(uid, JSON.stringify(record));
    } catch {
      // Progress is always safe in the player's own localStorage regardless
      // (see MapScreen's toggleCollected) — this only means it didn't also
      // reach the cloud copy this round. 503 (not a bare throw) so the
      // client's res.ok check correctly shows the sync-error indicator
      // instead of either crashing or silently claiming success.
      return new Response(JSON.stringify({ error: "storage unavailable" }), { status: 503, headers: CORS });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  }
  return new Response("Method not allowed", { status: 405, headers: CORS });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // simple page-view counter backed by Workers KV (binding: VIEWS). Best
    // effort — free-tier KV has a daily put() quota (1000/day), and this
    // writes on every single page view, so it can run out on a busy day.
    // Degrade to serving the last known count instead of throwing (which
    // otherwise took down every page load, not just this counter, once the
    // quota was hit — that's the bug this try/catch exists to prevent).
    if (url.pathname === "/api/views") {
      let count = 0;
      try {
        count = parseInt((await env.VIEWS.get("count")) || "0", 10) || 0;
      } catch {}
      // GET = read + increment (once per page load); HEAD/other = read only
      if (request.method === "GET") {
        count += 1;
        try {
          await env.VIEWS.put("count", String(count));
        } catch {
          count -= 1; // put() failed (e.g. quota) — report the last stored count, not a phantom increment
        }
      }
      return new Response(JSON.stringify({ count }), { headers: CORS });
    }
    if (url.pathname === "/api/sync/maps") {
      return handleMapsSync(request, env);
    }
    // Gate the JSON dataset only. Images (/media) stay open so native <Image>
    // (which can't attach the app-key header) can still load them.
    const guarded = url.pathname.startsWith("/data/");
    if (guarded && !allowed(request, url)) {
      return new Response("Forbidden", {
        status: 403,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
