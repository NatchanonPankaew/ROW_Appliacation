# Mimir — build & deploy

The app runs from **one codebase** on three channels:

- **Web** — `react-native-web` via Expo (`npm run web`)
- **Android / iOS** — the existing native projects (`npm run android` / `npm run ios`)

The game dataset (JSON) and all referenced images are **self-hosted** — mirrored
from roworlddb.com into `public/` (committed to the repo) so the app never
depends on that site at runtime and has no CORS issues.

## Refresh the dataset (run whenever the game updates)

```bash
npm run sync:data     # downloads all JSON -> public/data/sea  (~76 MB)
npm run sync:images   # mirrors only referenced images -> public/media  (~48 MB, ~2.1k files)
```

`public/data` and `public/media` are committed to the repo (not git-ignored) —
run both scripts and commit whatever changed whenever the game data updates.
This means a deploy never has to reach roworlddb.com, and a script bug (like a
missing icon fallback) shows up as a reviewable diff instead of a silent gap
that only appears live.

## Run locally

```bash
npm run web    # http://localhost:8081 — data/images are already in public/
```

If you do need to refresh first, run `npm run sync:data && npm run sync:images`.

## Build the web bundle

```bash
npm run build:web     # -> ./dist  (Expo copies public/ into the output)
```

## Deploy to Cloudflare Pages

Connect this GitHub repo in the Cloudflare Pages dashboard and set:

| Setting | Value |
|---|---|
| Build command | `npm run build:web` |
| Build output directory | `dist` |
| Node version | `22` (env var `NODE_VERSION=22`) |

The dataset is already committed under `public/`, so the build no longer needs
to fetch anything from roworlddb.com — it just bundles what's in the repo.

Prefer the CLI instead of the dashboard? After `npm run build:web`:

```bash
npx wrangler pages deploy dist --project-name mimir
```

(needs `npx wrangler login` first — opens your browser to authorize.)

## Point the native apps at the deployed data

Native builds have no same-origin to load `/data` and `/media` from, so set the
deployed URL once:

```bash
cp .env.example .env
# then edit .env:
EXPO_PUBLIC_DATA_HOST=https://<your-project>.pages.dev
```

Web ignores this (it uses same-origin relative paths).
