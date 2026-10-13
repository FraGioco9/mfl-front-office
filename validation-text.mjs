import { readFileSync } from "node:fs";
import { readFile as readFileAsync } from "node:fs/promises";

const asyncCache = new Map();
const syncCache = new Map();

export function normalizeValidationText(value) {
  return String(value).replace(/\r\n?/g, "\n");
}

function resolveTextUrl(path, baseUrl) {
  if (path instanceof URL) return path;
  return new URL(String(path), baseUrl || import.meta.url);
}

export async function readValidationText(path, baseUrl = import.meta.url) {
  const url = resolveTextUrl(path, baseUrl);
  const key = url.href;
  if (!asyncCache.has(key)) {
    asyncCache.set(key, readFileAsync(url, "utf8").then(normalizeValidationText));
  }
  return asyncCache.get(key);
}

export function readValidationTextSync(path, baseUrl = import.meta.url) {
  const url = resolveTextUrl(path, baseUrl);
  const key = url.href;
  if (!syncCache.has(key)) {
    syncCache.set(key, normalizeValidationText(readFileSync(url, "utf8")));
  }
  return syncCache.get(key);
}

export function clearValidationTextCache() {
  asyncCache.clear();
  syncCache.clear();
}

// Follow the script actually wired to each step so existing behavior assertions
// keep testing the same implementation after it moves out of YAML.
export async function readWorkflowSource(url) {
  const source = await readValidationText(url);
  const pattern = /^( +)run: bash "\$GITHUB_WORKSPACE\/(?:builder\/)?(scripts\/workflows\/[a-z0-9-]+\.sh)"$/gm;
  let result = "", cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const body = await readValidationText(new URL(match[2], import.meta.url));
    result += source.slice(cursor, match.index) + `${match[1]}run: |\n` + body.replace(/^#![^\n]+\n/, "").trimEnd().split("\n").map((line) => `${match[1]}  ${line}`).join("\n");
    cursor = match.index + match[0].length;
  }
  return result + source.slice(cursor);
}
