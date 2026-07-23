// GitHub Pages project sites serve from https://<user>.github.io/<repo>/, not
// domain root, but Expo's static web export always emits root-absolute asset
// paths — src="/_expo/..." in index.html, and "/assets/<hash>.png" string
// literals baked into the JS bundle for any locally require()'d image (e.g.
// the Support screen's donate-qr/yt-cover images). Rewrite both so every
// root-absolute path gets the repo subpath prefixed. /data and /media fetches
// are handled separately via EXPO_PUBLIC_DATA_HOST at build time, so those
// don't need patching here.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const base = process.argv[2];
if (!base || !base.startsWith("/")) {
  console.error("Usage: node scripts/rewrite-pages-base.mjs /repo-name");
  process.exit(1);
}

const distDir = new URL("../dist/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

async function patchHtmlAttrs(path) {
  const html = await readFile(path, "utf8");
  const count = (html.match(/(src|href)="\/(?!\/)/g) || []).length;
  const rewritten = html.replace(/(src|href)="\/(?!\/)([^"]*)"/g, (_m, attr, rest) => `${attr}="${base}/${rest}"`);
  await writeFile(path, rewritten);
  return count;
}

async function patchJsAssetPaths(path) {
  const js = await readFile(path, "utf8");
  const count = (js.match(/"\/assets\//g) || []).length;
  if (count === 0) return 0;
  const rewritten = js.split('"/assets/').join(`"${base}/assets/`);
  await writeFile(path, rewritten);
  return count;
}

const htmlCount = await patchHtmlAttrs(join(distDir, "index.html"));
console.log(`Rewrote ${htmlCount} root-absolute path(s) in index.html with base "${base}"`);

const jsDir = join(distDir, "_expo", "static", "js", "web");
let jsTotal = 0;
for (const f of await readdir(jsDir)) {
  if (f.endsWith(".js")) jsTotal += await patchJsAssetPaths(join(jsDir, f));
}
console.log(`Rewrote ${jsTotal} "/assets/" reference(s) across JS bundle(s) with base "${base}"`);
