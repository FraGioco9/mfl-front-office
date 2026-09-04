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
