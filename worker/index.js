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

// Verifies a Google Identity Services ID token by asking Google directly
// (simplest correct option in a Worker — no JWKS fetch/cache/JWT-verify code
// to maintain) and checks it was issued for *our* OAuth client, not someone
// else's. Returns the token payload (has .sub, the stable per-Google-account
// id we key synced data on) or null if it doesn't check out.
async function verifyGoogleIdToken(idToken, env) {
  if (!idToken) return null;
  const res = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken));
  if (!res.ok) return null;
  const payload = await res.json();
  if (!env.GOOGLE_CLIENT_ID || payload.aud !== env.GOOGLE_CLIENT_ID) return null;
  return payload;
}

// Signed-in players' Maps progress (collected points + icon size preference),
// keyed by their Google account id (KV binding: MAPS_SYNC). Web-only for now.
async function handleMapsSync(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: { ...CORS, "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "authorization,content-type" },
    });
  }
  const idToken = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const payload = await verifyGoogleIdToken(idToken, env);
  if (!payload) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });
  const uid = payload.sub;

  if (request.method === "GET") {
    const stored = await env.MAPS_SYNC.get(uid);
    return new Response(stored || JSON.stringify({ collected: {}, iconScale: null, updatedAt: 0 }), { headers: CORS });
  }
  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return new Response(JSON.stringify({ error: "bad body" }), { status: 400, headers: CORS });
    const record = {
      collected: body.collected && typeof body.collected === "object" ? body.collected : {},
      iconScale: typeof body.iconScale === "number" ? body.iconScale : null,
      updatedAt: Date.now(),
    };
    await env.MAPS_SYNC.put(uid, JSON.stringify(record));
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  }
  return new Response("Method not allowed", { status: 405, headers: CORS });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // simple page-view counter backed by Workers KV (binding: VIEWS)
    if (url.pathname === "/api/views") {
      let count = parseInt((await env.VIEWS.get("count")) || "0", 10) || 0;
      // GET = read + increment (once per page load); HEAD/other = read only
      if (request.method === "GET") {
        count += 1;
        await env.VIEWS.put("count", String(count));
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
