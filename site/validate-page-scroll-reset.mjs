import { readFile } from "node:fs/promises";

const source = String(await readFile(new URL("./static-ui-runtime.js", import.meta.url), "utf8"));
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const routeStart = source.indexOf("function syncRouteChrome(urlLike = window.location.href) {");
const routeEnd = routeStart >= 0 ? source.indexOf("\n  function tooltipTargetFrom", routeStart) : -1;
invariant(routeStart >= 0 && routeEnd > routeStart, "Static route chrome owner must exist.");
const routeSource = source.slice(routeStart, routeEnd);

const pageChangedIndex = routeSource.indexOf("const pageChanged = Boolean(previousPage && previousPage !== state.page);");
const resetIndex = routeSource.indexOf("if (pageChanged) resetMainPageScroll();");
const shellIndex = routeSource.indexOf("showRouteShell(state, { resetFilters });");
invariant(
  pageChangedIndex >= 0 && resetIndex > pageChangedIndex && shellIndex > resetIndex,
  "A committed page change must synchronously reset vertical scroll before the destination shell is revealed.",
);

invariant(
  source.includes('function resetMainPageScroll() {\n    const main = document.querySelector("body > #appShell > main");\n    if (main instanceof HTMLElement) main.scrollTop = 0;\n  }'),
  "Page navigation must reset the canonical main scrolling surface directly.",
);
invariant(
  !routeSource.includes("if (pageChanged || viewChanged) resetMainPageScroll();")
    && !routeSource.includes("if (viewChanged) resetMainPageScroll();"),
  "Same-page view switches must preserve their vertical scroll position.",
);

console.log("Page scroll reset validation passed: page changes return main to the top before reveal while view switches preserve vertical position.");
