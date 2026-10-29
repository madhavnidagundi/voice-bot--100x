import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const keys = [process.env.GNANI_API_KEY, process.env.OPENROUTER_API_KEY].filter(Boolean);
let scanned = 0;
async function scan(path) {
  let entries;
  try { entries = await readdir(path, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  for (const entry of entries) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) await scan(file);
    else {
      const content = await readFile(file, "utf8"); scanned++;
      if (keys.some(key => content.includes(key)) || /sk-or-v1-[a-f0-9]{50,}|vach_[A-Za-z0-9_-]{80,}/.test(content)) {
        throw new Error(`Possible API key in deployable client/source file: ${file}`);
      }
    }
  }
}
for (const path of ["src", "public", ".next/static"]) await scan(path);
console.log(`PASS: ${scanned} source/public/browser-asset files checked; no API keys detected.`);
