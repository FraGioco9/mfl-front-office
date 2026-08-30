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
const mobileHiddenStandardsFallback = `.views,
    .quickFilters,
    .filtersDialog .filterBuilder {
      scrollbar-width: none;
    }`;
const playerTableHiddenStandardsFallback = `.playerTableScroller {
      scrollbar-width: none;
    }`;
if (!scrollbarSource.includes(mobileHiddenStandardsFallback)
  || !scrollbarSource.includes(playerTableHiddenStandardsFallback)) {
  throw new Error("Mobile section-view, quick-filter, player-table, and Filters-body scrollers must hide standards-based scrollbars from the canonical scrollbar owner.");
}
// Chromium 121+ gives scrollbar-width/scrollbar-color precedence over WebKit pseudo-elements;
// keeping these declarations out of WebKit-capable browsers preserves hidden native arrow buttons.
const outsideStandardsFallback = scrollbarSource
  .replace(standardsFallback, "")
  .replace(mobileHiddenStandardsFallback, "")
  .replace(playerTableHiddenStandardsFallback, "");
if (outsideStandardsFallback.includes("scrollbar-width:") || outsideStandardsFallback.includes("scrollbar-color:")) {
  throw new Error("Do not let standards scrollbar properties override WebKit thumb-only styling in Chromium/Safari.");
}
if (!scrollbarSource.includes("--mfl-scrollbar-track-end-inset: 4px;")) {
  throw new Error("Scrollbar tracks must keep the canonical 4px top/bottom thumb inset.");
}
if (!scrollbarSource.includes(`html body > #appShell > main {
  overflow-y: scroll;
  scrollbar-gutter: stable;
}`)) {
  throw new Error("The main scroller must always reserve stable scrollbar space.");
}
const modalScrollLock = `:root:has(body > .modalBackdrop:not([hidden])) body > #appShell > main {
  overflow-y: hidden;
}`;
if (!scrollbarSource.includes(modalScrollLock)) {
  throw new Error("Visible modal backdrops must lock main scrolling without releasing its stable scrollbar gutter.");
}
if (!scrollbarSource.includes("*::-webkit-scrollbar-track,")
  || !scrollbarSource.includes("*::-webkit-scrollbar-track-piece,")
  || !scrollbarSource.includes("*::-webkit-scrollbar-corner {")
  || !scrollbarSource.includes("background: transparent;")) {
  throw new Error("WebKit scrollbar tracks and corners must stay globally transparent.");
}
if (!scrollbarSource.includes("*::-webkit-scrollbar-track:vertical {")
  || !scrollbarSource.includes("margin-top: var(--mfl-scrollbar-track-end-inset);")
  || !scrollbarSource.includes("margin-bottom: var(--mfl-scrollbar-track-end-inset);")) {
  throw new Error("Vertical scrollbar thumbs must not reach the top or bottom edge of the track.");
}
if (!scrollbarSource.includes("*::-webkit-scrollbar-button {")
  || !scrollbarSource.includes("display: none;")
  || !scrollbarSource.includes("width: 0;")
  || !scrollbarSource.includes("height: 0;")
  || !scrollbarSource.includes("max-width: 0;")
  || !scrollbarSource.includes("max-height: 0;")) {
  throw new Error("WebKit scrollbar buttons/arrows must stay globally hidden with zero-size button boxes.");
}
const mobileHiddenWebkitScrollbar = `.views::-webkit-scrollbar,
  .quickFilters::-webkit-scrollbar,
  .filtersDialog .filterBuilder::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }`;
const playerTableHiddenWebkitScrollbar = `.playerTableScroller::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }`;
if (!scrollbarSource.includes("@media (max-width: 900px)")
  || !scrollbarSource.includes(mobileHiddenWebkitScrollbar)
  || !scrollbarSource.includes(playerTableHiddenWebkitScrollbar)
  || !scrollbarSource.includes(`.views,
  .quickFilters,
  .filtersDialog .filterBuilder {
    -ms-overflow-style: none;
  }`)
  || !scrollbarSource.includes(`.playerTableScroller {
    -ms-overflow-style: none;
  }`)) {
  throw new Error("Mobile section-view, quick-filter, player-table, and Filters-body scrollers must hide every native scrollbar through scrollbars.css.");
}
const modalThumbSelector = ":root:has(body > .modalBackdrop:not([hidden])) body > #appShell > main::-webkit-scrollbar-thumb";
if (!scrollbarSource.includes(modalThumbSelector)) {
  throw new Error("The main scrollbar thumb must stay visually transparent while a modal is visible.");
}
if (!scrollbarSource.includes("@supports selector(select::picker(select)::-webkit-scrollbar) {")
  || !scrollbarSource.includes("select::picker(select)::-webkit-scrollbar-thumb {")
  || !scrollbarSource.includes("select::picker(select)::-webkit-scrollbar-button {")
  || !scrollbarSource.includes("select::picker(select)::-webkit-scrollbar-track,")
  || !scrollbarSource.includes("select::picker(select)::-webkit-scrollbar-track:vertical {")) {
  throw new Error("Customizable select dropdown pickers must use the same canonical thumb-only scrollbar and track inset.");
}
if (scrollbarSource.includes("--mfl-scrollbar-arrow") || scrollbarSource.includes("mask-image:")) {
  throw new Error("Scrollbar arrow styling must not be reintroduced; only the thumb should be visible.");
}

console.log("Canonical CSS priority, thumb-only scrollbar, and hidden mobile section-view/quick-filter/player-table/Filters-body scrollbar validation passed.");
