# Google sign-in sync setup (Maps progress)

The code for this is already in place (`src/api/googleSync.ts`, wired into
`src/screens/MapScreen.tsx`, backend in `worker/index.js`). It stays silently
disabled — no button shown, nothing breaks — until you do this one-time setup.

Web only for now (Cloudflare + GitHub Pages), as agreed. Native would need
separate OAuth clients per platform and a new native build.

## 1. Create a Google OAuth Web client

1. Go to https://console.cloud.google.com/apis/credentials (create a project first if you don't have one).
2. **Create Credentials → OAuth client ID → Application type: Web application**.
3. **Authorized JavaScript origins** — add both of your deployed URLs:
   - `https://row-appliacation.natpoppy26.workers.dev` (Cloudflare)
   - `https://natchanonpankaew.github.io` (GitHub Pages — origin only, no path)
4. You'll also be asked to configure the **OAuth consent screen** the first
   time — External user type, app name, your email as support/developer
   contact is enough for testing. Publish it (or keep it in Testing mode and
   add your own Google account as a test user) so sign-in actually works.
5. Copy the generated **Client ID** — looks like `123...-abc....apps.googleusercontent.com`.
   The **Client Secret** is not needed — ID-token sign-in doesn't use it.

## 2. Create the Cloudflare KV namespace

In the project root:

```
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

This wasn't pre-added with a placeholder on purpose — Cloudflare validates
that every KV namespace id in this file actually exists *at deploy time*,
for the whole site, not just this feature. A fake id here would fail every
deploy (Cloudflare auto-deploys on every push to `main`), so it's left out
until you have the real one.

## 3. Fill in the client ID in two places

**a) `wrangler.jsonc`** (backend — verifies tokens were issued for this app):

```jsonc
"vars": {
  "GOOGLE_CLIENT_ID": "123...-abc....apps.googleusercontent.com"
}
```

**b) Build-time env var** (frontend — initializes the sign-in button):

- **Cloudflare Workers Build**: dashboard → your `row-appliacation` project →
  Settings → Build → Environment variables → add
  `EXPO_PUBLIC_GOOGLE_CLIENT_ID` = the same client ID.
- **GitHub Pages**: add a repo variable (Settings → Secrets and variables →
  Actions → Variables) named `GOOGLE_CLIENT_ID`, then in
  `.github/workflows/deploy-pages.yml` add it alongside the existing
  `EXPO_PUBLIC_DATA_HOST` env line:
  ```yaml
  EXPO_PUBLIC_GOOGLE_CLIENT_ID: ${{ vars.GOOGLE_CLIENT_ID }}
  ```

## 4. Deploy

Push to `main` as usual (or `npx wrangler deploy` locally if you want to test
the Worker/KV change alone first). Once both env vars are live, a "Sign in
with Google" button appears at the top of the Maps tab automatically — no
further code changes needed.

## What syncs

Only Maps preferences: collected points, icon-size, which layers are shown/
hidden, and the "hide collected points" toggle. Nothing else in the app is
linked to the account. On sign-in, the app merges whatever's already saved
on the server with whatever's on that device (union of collected points —
nothing gets lost either direction; the other three preferences take the
server's value if it has one) and keeps pushing updates in the background
afterward.
