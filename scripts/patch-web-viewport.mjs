// Mobile browsers resolve CSS `height: 100%`/`100vh` against the LARGEST
// possible viewport (address bar hidden), not the actually-visible one. Since
// the RN tree lays itself out to fill that reported height and Expo's web
// reset sets `body { overflow: hidden }` (no page scroll — RN's own flex
// layout is expected to fit exactly), anything below the real visible fold
// (here: the map's zoom controls + hint text) becomes permanently
// unreachable with no way to scroll to it. `100dvh` (dynamic viewport
// height) tracks the real visible area instead; unsupported browsers just
// ignore the second declaration and keep the `100%` fallback.
import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../dist/index.html", import.meta.url);
const html = await readFile(file, "utf8");

const marker = "html,\n      body {\n        height: 100%;\n      }";
if (!html.includes(marker)) {
  console.warn("patch-web-viewport: expected CSS block not found, skipping (Expo's reset template may have changed)");
  process.exit(0);
}

const patched = html.replace(
  marker,
  "html,\n      body {\n        height: 100%;\n        height: 100dvh;\n      }"
);
await writeFile(file, patched);
console.log("patch-web-viewport: added 100dvh fallback for mobile browser chrome resize");
