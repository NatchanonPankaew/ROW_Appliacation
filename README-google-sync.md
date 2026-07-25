# Google sign-in sync setup (Maps progress)

The code for this is already in place (`src/api/googleSync.ts`, wired into
`src/screens/MapScreen.tsx`, backend in `worker/index.js`).

Web only for now (Cloudflare + GitHub Pages), as agreed. Native would need
separate OAuth clients per platform and a new native build.

## Status

- ✅ Google OAuth Web client created, hardcoded into both
  `src/api/googleSync.ts` and `worker/index.js` (it's public by design —
  OAuth web client ids are meant to ship in frontend JS, so no env vars
  needed for this part).
- ⬜ Cloudflare KV namespace (`MAPS_SYNC`) — **not created yet**. Until this
  is done, the "Sign in with Google" button does appear and sign-in itself
  works, but syncing 500s (isolated to that one endpoint, nothing else on
  the site is affected).

## Remaining step: create the Cloudflare KV namespace

In the project root, authenticate wrangler with your Cloudflare account
first if you haven't (`npx wrangler login` — opens a browser):

```
npx wrangler login
npx wrangler kv namespace create MAPS_SYNC
```

This prints an `id`. Open `wrangler.jsonc` and add a second entry to
`kv_namespaces` (there's a comment marking where):

```jsonc
"kv_namespaces": [
  { "binding": "VIEWS", "id": "973ebd5b050e4b85b1063a10266bb34f" },
  { "binding": "MAPS_SYNC", "id": "<the id wrangler printed>" }
],
```

Then push to `main` as usual — Cloudflare auto-deploys, GitHub Pages
auto-deploys too. Once live, sync starts working immediately, no further
setup.

This wasn't pre-added with a placeholder on purpose — Cloudflare validates
that every KV namespace id in this file actually exists *at deploy time*,
for the whole site, not just this feature. A fake id here would fail every
deploy (Cloudflare auto-deploys on every push to `main`), so it's left out
until you have the real one.

## What syncs

Only Maps preferences: collected points, icon-size, which layers are shown/
hidden, and the "hide collected points" toggle. Nothing else in the app is
linked to the account. On sign-in, the app merges whatever's already saved
on the server with whatever's on that device (union of collected points —
nothing gets lost either direction; the other three preferences take the
server's value if it has one) and keeps pushing updates in the background
afterward.
