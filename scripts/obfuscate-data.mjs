// Scramble the exported dataset so the raw response isn't readable in DevTools.
// Runs after `expo export` (see package.json build:web) over dist/data/**/*.json:
// XOR each byte with a repeating key and prepend a 4-byte magic header. The app
// (src/api/roworlddb.ts -> deobfuscate) detects the header and reverses it.
//
// Deterrent only: the key also lives in the JS bundle. Images (/media) are not
// touched — the browser renders them itself, so they can't be de-obfuscated.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const KEY = "rw#7sK2!pZ9q";                 // must match OBF_KEY in roworlddb.ts
const MAGIC = Buffer.from([0x52, 0x4f, 0x57, 0x31]); // "ROW1"
const ROOT = "dist/data";

async function walk(dir) {
  const out = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return out; }                      // dir missing (e.g. data not synced)
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

const files = await walk(ROOT);
let done = 0;
for (const f of files) {
  const raw = await readFile(f);
  if (raw.length >= 4 && raw.subarray(0, 4).equals(MAGIC)) continue; // already done
  const out = Buffer.alloc(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw[i] ^ KEY.charCodeAt(i % KEY.length);
  await writeFile(f, Buffer.concat([MAGIC, out]));
  done++;
}
console.log(`obfuscated ${done}/${files.length} json files under ${ROOT}`);
