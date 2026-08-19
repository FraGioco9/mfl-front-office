import { access, readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [stylesBase, styles, controls, footer, entry, staticUi, discountTooltipUi, desktopTableUi, coreBuild] = await Promise.all([
  read("./styles-base.css"),
  read("./styles.css"),
  read("./controls.css"),
  read("./footer.css"),
  read("./modules/app-entry.js"),
  read("./static-ui-runtime.js"),
  read("./evaluation-discount-rate-ui-runtime.js"),
  read("./desktop-table-style-runtime.js"),
  read("./build-app-core.mjs"),
]);

invariant(
  styles.includes('@import url("/controls.css");'),
  "styles.css must load the canonical shared-control stylesheet.",
);
invariant(
  styles.includes('@import url("/footer.css");'),
  "styles.css must load the canonical footer stylesheet.",
);
invariant(
  styles.indexOf('@import url("/controls.css");') > styles.indexOf('@import url("/dropdowns.css");'),
  "controls.css must load after dropdowns.css so shared control state has deterministic ownership.",
);
invariant(
  styles.indexOf('@import url("/footer.css");') > styles.indexOf('@import url("/controls.css");'),
  "footer.css must load after shared controls so footer ownership is deterministic.",
);

for (const required of [
  ".playerAttributeViewButton",
  "#sidebar .navButton.active",
  ".trainingStatControls button:hover:not(:disabled)",
  ".popupCloseButton,",
  ".filtersDialog [data-filter-value]",
  "#evaluationSearchInput",
  ".globalSearchControl #playerSearchInput",
  "#pageSizeSelect",
  ".evaluationSearchClearButton",
  ".playerSearchClearButton",
  ".modalBackdrop .filtersHeader > .popupCloseButton",
  "html.mflInteractionBusy #pageSizeSelect",
]) {
  invariant(controls.includes(required), `controls.css is missing canonical shared rule: ${required}`);
}

for (const required of [
  '.siteFooter a[href="/changelog"]',
  '.siteFooter a[data-page="changelog"]',
  "font-size: 14px;",
  "cursor: pointer;",
  "pointer-events: auto;",
]) {
  invariant(footer.includes(required), `footer.css is missing canonical footer rule: ${required}`);
}

invariant(!controls.includes("!important"), "controls.css must not introduce !important overrides.");
invariant(!footer.includes("!important"), "footer.css must not introduce !important overrides.");

for (const duplicate of [
  "--mfl-popup-close-size:",
  "#sidebar .navButton.active",
  ".modalBackdrop .filtersHeader > .popupCloseButton",
  ".trainingStatControls .popupAddButton::before",
  "html.mflInteractionBusy #pageSizeSelect",
]) {
  invariant(!styles.includes(duplicate), `styles.css must not duplicate shared-control ownership through ${duplicate}`);
}

for (const historicalOwner of [
  "/* v1.150.13",
  "/* v1.150.15",
  "/* v1.150.16",
  "/* v1.150.17",
  "/* v1.150.18",
  "/* v1.150.19",
  "/* v1.150.20",
  "/* v1.150.21",
  "/* v1.119.2",
  "/* v1.119.3",
  "/* v1.119.4",
  "/* v1.119.5",
  "/* v1.119.6",
  "/* v1.119.7",
  "/* v1.119.12",
  "/* v1.119.13",
  "/* v1.119.15",
  "/* v1.119.17",
  "/* v1.119.25",
  "html body .siteFooter.siteFooter",
  '.siteFooter a[data-page="changelog"] {\n  font-size: 0 !important;',
  ".trainingStatControls button:hover:not(:disabled) {",
  ".evaluationSearch .field::after {\n  content: \"x\";",
]) {
  invariant(
    !stylesBase.includes(historicalOwner),
    `styles-base.css must not regain historical shared-control/footer ownership through ${historicalOwner}.`,
  );
}

for (const removedRuntime of [
  "/table-view-runtime.js",
  "/table-navigation-chrome-runtime.js",
]) {
  invariant(!entry.includes(removedRuntime), `${removedRuntime} must not return to the table startup runtime list.`);
}

invariant(
  staticUi.includes("const TOOLTIP_HEIGHT = 6;"),
  "Tooltip Height must remain the single 6px global tooltip distance.",
);
invariant(
  staticUi.includes("window.__mflTooltipHeight = TOOLTIP_HEIGHT;"),
  "Tooltip Height must be exposed to every specialized tooltip owner.",
);
invariant(
  staticUi.includes('target.closest("[data-tooltip], [data-note-tooltip], [title]")'),
  "The global tooltip owner must include data-tooltip, data-note-tooltip, and native title tooltips.",
);
invariant(
  staticUi.includes('target.getAttribute("data-note-tooltip")'),
  "The global tooltip source reader must recognize specialized note-tooltip attributes.",
);
invariant(
  staticUi.includes("anchor.top - tooltip.height - TOOLTIP_HEIGHT"),
  "Generic tooltips must consume Tooltip Height from the real generator rectangle.",
);
invariant(
  staticUi.includes("anchor.bottom + TOOLTIP_HEIGHT"),
  "Generic tooltip viewport fallback must preserve Tooltip Height below its generator.",
);
invariant(
  staticUi.includes('document.addEventListener("focus", onTooltipFocusIn, true);'),
  "The global tooltip owner must capture keyboard focus before target-local tooltip listeners.",
);
invariant(
  staticUi.includes('document.addEventListener("blur", onTooltipFocusOut, true);'),
  "The global tooltip owner must capture keyboard blur before target-local tooltip listeners.",
);
invariant(
  !staticUi.includes('document.addEventListener("focusin", onTooltipFocusIn, true);'),
  "Tooltip focus ownership must not fall back to the later focusin phase.",
);
invariant(
  discountTooltipUi.includes("Number(window.__mflTooltipHeight)"),
  "The Evaluation discount tooltip must consume Tooltip Height.",
);
invariant(
  !discountTooltipUi.includes("__mflTooltipSettings?.gap"),
  "The Evaluation discount tooltip must not retain its former local gap contract.",
);
invariant(
  desktopTableUi.includes('title.dataset.noteTooltip = "Click to copy wallet address";'),
  "Agent copy tooltips must use the specialized tooltip attribute without data-tooltip duplication.",
);
invariant(
  !desktopTableUi.includes('title.dataset.tooltip = "Click to copy wallet address";'),
  "Agent copy tooltips must not retain duplicate generic tooltip ownership.",
);

for (const required of [
  "function normalizeTooltipHeightOwnership(source)",
  "Number(window.__mflTooltipHeight)",
  "iconRect.top - tooltipRect.height - tooltipHeight",
  "iconRect.bottom + tooltipHeight",
  'button.dataset.noteTooltip = "Click to copy";',
  'button.addEventListener("focus", () => showPlayerNoteTooltip(button));',
  "markerElement.dataset.noteTooltip = marker.label;",
  'data-note-tooltip=\"Click to copy\" aria-label=\"Click to copy player ID\"',
  "if (playerAgentLink.dataset.noteTooltip) {",
  "link.dataset.noteTooltip = tooltip;",
]) {
  invariant(coreBuild.includes(required), `Generated application-core tooltips are missing Tooltip Height ownership through ${required}.`);
}
invariant(
  coreBuild.includes("legacyManualTooltipTokens"),
  "The core build must reject duplicate manual tooltip attributes after generation.",
);
invariant(
  coreBuild.includes('artifact.includes("__mflTooltipSettings?.gap") || artifact.includes("anchorHeight = 14")'),
  "The core build must reject legacy tooltip spacing ownership after generation.",
);
invariant(
  coreBuild.includes("Generated application core does not position manual tooltips from the real generator rectangle."),
  "The build must verify that the real generator rectangle owns manual tooltip positioning.",
);

for (const path of ["./table-view-runtime.js", "./table-navigation-chrome-runtime.js"]) {
  let exists = true;
  try {
    await access(new URL(path, import.meta.url));
  } catch {
    exists = false;
  }
  invariant(!exists, `${path} must remain deleted; its behavior is canonical static CSS or no-op.`);
}

console.log("Canonical shared-control, footer, Tooltip Height, and static table chrome ownership validation passed.");
