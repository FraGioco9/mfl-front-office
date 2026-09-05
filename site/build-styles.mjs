import { readFile, writeFile } from "node:fs/promises";

import { createStyleBundle } from "./style-bundle.mjs";

const read = (name) => readFile(new URL(`./${name}`, import.meta.url), "utf8");
const bundle = await createStyleBundle(read);
await writeFile(new URL("./styles-runtime.css", import.meta.url), bundle, "utf8");

const indexUrl = new URL("./index.html", import.meta.url);
const index = await readFile(indexUrl, "utf8");
const sourceLink = '<link rel="stylesheet" href="/styles.css">';
const runtimeLink = '<link rel="stylesheet" href="/styles-runtime.css">';
const sourceLinkCount = String(index).split(sourceLink).length - 1;
const runtimeLinkCount = String(index).split(runtimeLink).length - 1;
if (sourceLinkCount > 1 || runtimeLinkCount > 1 || (sourceLinkCount === 0 && runtimeLinkCount === 0)) {
  throw new Error("index.html must contain exactly one canonical primary stylesheet link.");
}
if (sourceLinkCount === 1) {
  await writeFile(indexUrl, String(index).replace(sourceLink, runtimeLink), "utf8");
}
