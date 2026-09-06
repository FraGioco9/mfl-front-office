import { readdir, readFile } from "node:fs/promises";

// Runtime code may update CSS variables and state classes, but must not inject priority overrides.
const siteRoot = new URL("./", import.meta.url);

async function sourceFiles(directory = siteRoot) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "validation") continue;
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) {
      files.push(...await sourceFiles(url));
      continue;
    }
    if (!/\.(?:js|mjs)$/.test(entry.name) || entry.name === "validate.mjs" || entry.name.startsWith("validate-")) continue;
    files.push(url);
  }
  return files;
}

for (const url of await sourceFiles()) {
  const source = await readFile(url, "utf8");
  const path = decodeURIComponent(url.pathname).split("/site/").at(-1) || url.pathname;
  if (source.includes("!important")) {
    throw new Error(`${path} must not inject !important styling; move presentation to canonical CSS ownership.`);
  }
  if (/\.style\.setProperty\([\s\S]{0,240}?["']important["']\s*\)/.test(source)) {
    throw new Error(`${path} must not write important inline style priority; use CSS variables/classes instead.`);
  }
}

console.log("Runtime style ownership validation passed without priority overrides.");
