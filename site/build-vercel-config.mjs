import { readFile, writeFile } from "node:fs/promises";
import { serializeVercelConfig } from "./vercel-config-source.mjs";

async function writeFileIfChanged(path, content) {
  let current = null;
  try {
    current = await readFile(new URL(path, import.meta.url), "utf8");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  if (current === content) return false;
  await writeFile(new URL(path, import.meta.url), content, "utf8");
  return true;
}

const changes = await Promise.all([
  writeFileIfChanged("./vercel.json", serializeVercelConfig()),
  writeFileIfChanged("./vercel.production.json", serializeVercelConfig({ production: true })),
]);

if (process.env.MFL_BUILD_VERBOSE === "1") {
  console.log(`${changes[0] ? "Generated" : "Unchanged"} vercel.json.`);
  console.log(`${changes[1] ? "Generated" : "Unchanged"} vercel.production.json.`);
}
