// GitHub Pages project sites serve from https://<user>.github.io/<repo>/, not
// domain root, but Expo's static web export always emits root-absolute asset
// paths (src="/_expo/...", href="/favicon.ico"). Rewrite dist/index.html so
// every root-absolute src/href gets the repo subpath prefixed — the actual
// /data and /media fetches are handled separately via EXPO_PUBLIC_DATA_HOST
// (see metro build step), so only HTML-embedded asset refs need this.
import { readFile, writeFile } from "node:fs/promises";

const base = process.argv[2];
if (!base || !base.startsWith("/")) {
  console.error("Usage: node scripts/rewrite-pages-base.mjs /repo-name");
  process.exit(1);
}

const file = new URL("../dist/index.html", import.meta.url);
const html = await readFile(file, "utf8");

// src="/x" or href="/x" -> src="/base/x" (skip already-prefixed, protocol-relative "//", and full URLs)
const rewritten = html.replace(
  /(src|href)="\/(?!\/)([^"]*)"/g,
  (match, attr, rest) => `${attr}="${base}/${rest}"`
);

await writeFile(file, rewritten);
const count = (html.match(/(src|href)="\/(?!\/)/g) || []).length;
console.log(`Rewrote ${count} root-absolute path(s) in dist/index.html with base "${base}"`);
