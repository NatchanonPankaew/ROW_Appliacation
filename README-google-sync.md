# Google sign-in sync setup (Maps progress)

The code for this is already in place (`src/api/googleSync.ts`, wired into
`src/screens/MapScreen.tsx`, backend in `worker/index.js`).

Web only for now (Cloudflare + GitHub Pages), as agreed. Native would need
separate OAuth clients per platform and a new native build.

## Status: done ✅

- Google OAuth Web client created, hardcoded into both
  `src/api/googleSync.ts` and `worker/index.js` (it's public by design —
  OAuth web client ids are meant to ship in frontend JS, so no env vars
  needed for this part).
- Cloudflare KV namespace `MAPS_SYNC` created and wired into
  `wrangler.jsonc`.

Setup is complete — once this deploys, the "Sign in with Google" button
shows on the Maps tab and syncing works end to end. Nothing further to do
unless you want native (Android/iOS) support later, which needs separate
OAuth clients per platform and a new native build.

## What syncs

Only Maps preferences: collected points, icon-size, which layers are shown/
hidden, and the "hide collected points" toggle. Nothing else in the app is
linked to the account. On sign-in, the app merges whatever's already saved
on the server with whatever's on that device (union of collected points —
nothing gets lost either direction; the other three preferences take the
server's value if it has one) and keeps pushing updates in the background
afterward.
