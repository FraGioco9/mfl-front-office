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
const cssSources = new Map();

for (const sourcePath of canonicalCssSources) {
  const source = await readFile(new URL(`./${sourcePath}`, import.meta.url), "utf8");
  cssSources.set(sourcePath, source);
  if (source.includes("!important")) {
    throw new Error(`${sourcePath} must not use !important; fix CSS ownership or cascade order instead.`);
  }
}

// scrollbars.css is the only scrollbar-style owner. Other files may control overflow
// or scrollbar-gutter for layout, but must not define another visual scrollbar.
const scrollbarStyleTokens = ["::-webkit-scrollbar", "scrollbar-width:", "scrollbar-color:"];
for (const [sourcePath, source] of cssSources) {
  if (sourcePath === "scrollbars.css") continue;
  if (scrollbarStyleTokens.some((token) => source.includes(token))) {
    throw new Error(`${sourcePath} must not define scrollbar visuals; keep all scrollbar styling in scrollbars.css.`);
  }
}

const scrollbarSource = cssSources.get("scrollbars.css") || "";
const standardsFallback = `@supports not selector(::-webkit-scrollbar) {
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--mfl-scrollbar-thumb) transparent;
  }
}`;
if (!scrollbarSource.includes(standardsFallback)) {
  throw new Error("Standards-based scrollbar styling must be limited to browsers without WebKit scrollbar pseudo-elements.");
}
// Chromium 121+ gives scrollbar-width/scrollbar-color precedence over WebKit pseudo-elements;
// keeping these declarations out of WebKit-capable browsers preserves hidden native arrow buttons.
const outsideStandardsFallback = scrollbarSource.replace(standardsFallback, "");
if (outsideStandardsFallback.includes("scrollbar-width:") || outsideStandardsFallback.includes("scrollbar-color:")) {
  throw new Error("Do not let standards scrollbar properties override WebKit thumb-only styling in Chromium/Safari.");
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
  || !scrollbarSource.includes("height: 0;")
  || !scrollbarSource.includes("max-width: 0;")
  || !scrollbarSource.includes("max-height: 0;")) {
  throw new Error("WebKit scrollbar buttons/arrows must stay globally hidden with zero-size button boxes.");
}
if (!scrollbarSource.includes("@supports selector(select::picker(select)::-webkit-scrollbar) {")
  || !scrollbarSource.includes("select::picker(select)::-webkit-scrollbar-thumb {")
  || !scrollbarSource.includes("select::picker(select)::-webkit-scrollbar-button {")
  || !scrollbarSource.includes("select::picker(select)::-webkit-scrollbar-track,")) {
  throw new Error("Customizable select dropdown pickers must use the same canonical thumb-only scrollbar.");
}
if (scrollbarSource.includes("--mfl-scrollbar-arrow") || scrollbarSource.includes("mask-image:")) {
  throw new Error("Scrollbar arrow styling must not be reintroduced; only the thumb should be visible.");
}

console.log("Canonical CSS priority and thumb-only scrollbar validation passed.");
