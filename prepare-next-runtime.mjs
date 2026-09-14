import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const publicRoot = join(root, "public");
const PUBLIC_JSON = new Set(["release-history-overrides.json", "release.json", "ui-behavior-foundations.json"]);

function rootAsset(name) {
  if (name === "index.html" || name === "bootstrap.js" || name === "bootstrap-core.js") return true;
  if (name.endsWith("-runtime.js")) return true;
  if (PUBLIC_JSON.has(name)) return true;
  return [".css", ".svg", ".png", ".webp", ".ico", ".woff", ".woff2"].includes(extname(name).toLowerCase());
}

async function copyFile(relativePath) {
  const source = resolve(root, relativePath);
  const destination = resolve(publicRoot, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
}

const rootEntries = await readdir(root, { withFileTypes: true });
await rm(publicRoot, { recursive: true, force: true });
await mkdir(publicRoot, { recursive: true });
for (const entry of rootEntries) {
  if (entry.isFile() && rootAsset(entry.name)) await copyFile(entry.name);
}

for (const entry of await readdir(join(root, "modules"), { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (entry.name === "app-entry.js" || /^app-core(?:-[a-z0-9-]+)?-runtime\.js$/i.test(entry.name)) {
    await copyFile(join("modules", entry.name));
  }
}

if (process.env.MFL_BUILD_VERBOSE === "1") console.log("Prepared Next.js public compatibility assets.");
