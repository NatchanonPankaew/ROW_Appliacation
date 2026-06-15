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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
