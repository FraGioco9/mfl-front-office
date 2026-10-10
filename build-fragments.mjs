import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Ordered lexical fragments deliberately preserve parser timing and CSS cascade bytes.
export async function assembleFragments(directory, extension) {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", directory), "utf8"));
  if (!Array.isArray(manifest) || !manifest.length || new Set(manifest).size !== manifest.length) {
    throw new Error(`Invalid or duplicate fragment manifest: ${directory}`);
  }
  const files = (await readdir(directory)).filter((name) => name.endsWith(extension)).sort();
  if (JSON.stringify(files) !== JSON.stringify([...manifest].sort())) {
    throw new Error(`Every ${extension} fragment must have exactly one manifest owner: ${directory}`);
  }
  return (await Promise.all(manifest.map(async (name) => {
    if (!/^[a-z0-9-]+\.[a-z.]+$/.test(name)) throw new Error(`Unsafe fragment path: ${name}`);
    const source = (await readFile(new URL(name, directory), "utf8")).replace(/\r\n?/g, "\n");
    if (!source) throw new Error(`Empty fragment: ${name}`);
    return source;
  }))).join("");
}

export async function writeGeneratedFragmentFile(path, source) {
  let current;
  try { current = await readFile(path, "utf8"); } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (current !== source) await writeFile(path, source, "utf8");
}

export async function writeHtml() {
  await writeGeneratedFragmentFile(
    new URL("./index.html", import.meta.url),
    await assembleFragments(new URL("./html-sources/", import.meta.url), ".html"),
  );
}

export async function writeResponsive() {
  await writeGeneratedFragmentFile(
    new URL("./responsive.css", import.meta.url),
    await assembleFragments(new URL("./responsive-sources/", import.meta.url), ".css.inc"),
  );
}

// ESM consumers may import the writer without implicitly generating files.
const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const mode = process.argv[2];
  if (mode === "html") await writeHtml();
  else if (mode === "responsive") await writeResponsive();
  else throw new Error("Usage: node build-fragments.mjs <html|responsive>");
}
