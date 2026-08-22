import { readFile } from "node:fs/promises";

// Keep both external stylesheets and render-blocking first-paint CSS free of priority overrides.
const canonicalCssSources = [
  "styles.css",
  "styles-base.css",
  "scrollbars.css",
  "dropdowns.css",
  "controls.css",
  "footer.css",
  "loading.css",
  "responsive.css",
  "index.html",
];

for (const sourcePath of canonicalCssSources) {
  const source = await readFile(new URL(`./${sourcePath}`, import.meta.url), "utf8");
  if (source.includes("!important")) {
    throw new Error(`${sourcePath} must not use !important; fix CSS ownership or cascade order instead.`);
  }
}

const scrollbarSource = await readFile(new URL("./scrollbars.css", import.meta.url), "utf8");
if (!scrollbarSource.includes("scrollbar-color: var(--mfl-scrollbar-thumb) transparent;")) {
  throw new Error("Global scrollbar tracks must stay transparent in standards-based scrollbar styling.");
}
if (!scrollbarSource.includes("*::-webkit-scrollbar-track,")
  || !scrollbarSource.includes("*::-webkit-scrollbar-track-piece,")
  || !scrollbarSource.includes("*::-webkit-scrollbar-corner {")
  || !scrollbarSource.includes("background: transparent;")) {
  throw new Error("WebKit scrollbar tracks and corners must stay globally transparent.");
}
if (!scrollbarSource.includes("*::-webkit-scrollbar-button {")
  || !scrollbarSource.includes("display: none;")
  || !scrollbarSource.includes("width: 0;")
  || !scrollbarSource.includes("height: 0;")) {
  throw new Error("WebKit scrollbar buttons/arrows must stay globally hidden.");
}
if (scrollbarSource.includes("--mfl-scrollbar-arrow") || scrollbarSource.includes("mask-image:")) {
  throw new Error("Scrollbar arrow styling must not be reintroduced; only the thumb should be visible.");
}

console.log("Canonical CSS priority and thumb-only scrollbar validation passed.");
