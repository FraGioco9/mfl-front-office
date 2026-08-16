import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [indexHtml, staticUi, entry] = await Promise.all([
  read("./index.html"),
  read("./static-ui-runtime.js"),
  read("./modules/app-entry.js"),
]);

includes(indexHtml, "window.__mflTableViewConfig = TABLE_VIEW_CONFIG;", "First-paint table view configuration must be exposed to runtime chrome ownership.");
for (const canonicalConfig of [
  'database: Object.freeze({ order: ["attributes", "contracts", "stats"], fallback: "attributes" })',
  'mfl: Object.freeze({ order: ["attributes", "stats"], fallback: "attributes" })',
  'progression: Object.freeze({ order: ["current", "all"], fallback: "current" })',
  'agents: Object.freeze({ order: ["attributes", "contracts", "next", "current", "all"], fallback: "attributes" })',
  'watchlist: Object.freeze({ order: ["attributes", "next", "contracts", "current", "all"], fallback: "current" })',
  'myplayers: Object.freeze({ order: ["attributes", "next", "contracts", "current", "all"], fallback: "attributes" })',
  'club: Object.freeze({ order: ["attributes", "contracts", "current", "all"], fallback: "attributes" })',
]) {
  includes(indexHtml, canonicalConfig, `First paint must retain canonical view configuration ${canonicalConfig}.`);
}

includes(entry, '"/static-ui-runtime.js"', "Static route chrome must load universally before the application core.");
includes(staticUi, "window.__mflTableViewConfig", "Runtime route chrome must reuse the first-paint view configuration instead of defining another order.");
includes(staticUi, 'footer.textContent = `MFL Front Office v${version}`;', "Static route chrome must keep the footer synchronized to the bootstrap release.");
includes(staticUi, 'document.addEventListener("click", onClick, true);', "Page and view active state must update in the capture phase before asynchronous navigation work.");
includes(staticUi, 'button.classList.toggle("active", buttonPage === page', "Sidebar destination state must switch immediately.");
includes(staticUi, 'button.classList.toggle("active", String(button.dataset.view || "") === view);', "View destination state must switch immediately.");
includes(staticUi, 'document.documentElement.setAttribute(PENDING_PAGE_ATTRIBUTE, state.page);', "Pending page chrome must preserve the destination view set while data loads.");
includes(staticUi, 'button.style.order = String(config.order.indexOf(buttonView) + 1);', "Runtime view ordering must follow the first-paint configuration.");
includes(staticUi, 'if (event.key !== "Escape") return;', "Escape must have a global focus cleanup owner.");
includes(staticUi, "active.blur();", "Escape must remove the active element focus ring.");
includes(staticUi, "selection.removeAllRanges();", "Escape must clear highlighted page text.");
includes(staticUi, 'bodyPageObserver.observe(document.body, { attributes: true, attributeFilter: ["data-page"] });', "Static chrome may observe only the canonical body page state.");
excludes(staticUi, "subtree: true", "Static route chrome must not become a broad DOM repair observer.");
excludes(staticUi, "childList: true", "Static route chrome must not rebuild page content from DOM mutations.");

console.log("Static route chrome, first-paint view, active-state, footer, and Escape validation passed.");
