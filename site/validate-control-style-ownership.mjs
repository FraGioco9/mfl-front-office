import { access, readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [stylesBase, styles, controls, footer, entry, staticUi, discountTooltipUi, desktopTableUi, filterControls, coreBuild, coreSource] = await Promise.all([
  read("./styles-base.css"),
  read("./styles.css"),
  read("./controls.css"),
  read("./footer.css"),
  read("./modules/app-entry.js"),
  read("./static-ui-runtime.js"),
  read("./evaluation-discount-rate-ui-runtime.js"),
  read("./desktop-table-style-runtime.js"),
  read("./filter-controls-runtime.js"),
  read("./build-app-core.mjs"),
  read("./modules/app-core.js"),
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
  ".mflNumericStepperControl",
  ".mflIncrementStepper button",
  ".filtersDialog [data-filter-value]",
  "#evaluationSearchInput",
  ".globalSearchControl #playerSearchInput",
  "#pageSizeSelect",
  ".evaluationSearchClearButton",
  ".playerSearchClearButton",
  ".modalBackdrop .filtersHeader > .popupCloseButton",
  "html.mflDataLoading #pageSizeSelect",
]) {
  invariant(controls.includes(required), `controls.css is missing canonical shared rule: ${required}`);
}

for (const required of [
  "align-self: center;\n  flex: 0 0 var(--mfl-popup-close-size);",
  "inline-size: var(--mfl-popup-close-size);\n  block-size: var(--mfl-popup-close-size);",
  "min-inline-size: var(--mfl-popup-close-size);\n  max-inline-size: var(--mfl-popup-close-size);",
  "min-block-size: var(--mfl-popup-close-size);\n  max-block-size: var(--mfl-popup-close-size);",
  "aspect-ratio: 1 / 1;",
]) {
  invariant(controls.includes(required), `Filters header close button must remain a true square through ${required}`);
}

for (const required of [
  ".filtersDialog .filterBuilder,\n.filtersDialog .addFilterRow,\n.filtersDialog .filterRules,",
  ".filtersDialog .filterRule :is(.mflNumericStepperControl, .betweenValue, .dateValue, .dateRangeValue) {\n  min-width: 0;\n  max-width: 100%;\n  min-inline-size: 0;\n  max-inline-size: 100%;",
  ".filtersDialog .filterRule > * {\n  justify-self: stretch;\n}",
  "box-sizing: border-box;\n  width: 100%;\n  inline-size: 100%;\n  min-width: 0;\n  min-inline-size: 0;\n  max-width: 100%;\n  max-inline-size: 100%;",
]) {
  invariant(controls.includes(required), `Filters value controls must remain contained by the dialog through ${required}`);
}

for (const required of [
  "mflNumericStepperControl",
  "mflIncrementStepper",
  'button.textContent = delta > 0 ? "▲" : "▼";',
  "input.stepUp();",
  "input.stepDown();",
]) {
  invariant(filterControls.includes(required), `Numeric filter arrows are missing shared Advanced Settings behavior through ${required}`);
}
invariant(
  !filterControls.includes("popupAddButton") && !filterControls.includes("popupMinusButton"),
  "Numeric arrow unification must not replace or restyle the existing +/- controls.",
);

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
invariant(!controls.includes("mflInteractionBusy") && !controls.includes("aria-busy"), "Shared controls must not retain global operation-busy selectors after local mutation ownership replaces the site-wide blocker.");
invariant(!footer.includes("!important"), "footer.css must not introduce !important overrides.");

for (const duplicate of [
  "--mfl-popup-close-size:",
  "#sidebar .navButton.active",
  ".modalBackdrop .filtersHeader > .popupCloseButton",
  ".trainingStatControls .popupAddButton::before",
  "html.mflDataLoading #pageSizeSelect",
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
  "The global tooltip source reader must recognize note-tooltip attributes.",
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
  desktopTableUi.includes('addressTarget.dataset.noteTooltip = "Click to copy wallet address";'),
  "Agent copy tooltips must put the global tooltip attribute on the clickable wallet-address target.",
);
invariant(
  !desktopTableUi.includes('addressTarget.dataset.tooltip = "Click to copy wallet address";'),
  "Agent copy tooltips must not retain duplicate generic tooltip ownership.",
);
invariant(
  desktopTableUi.includes('window.__mflStaticUiRuntime?.hideTooltips?.({ immediate: true });'),
  "Agent wallet copying must dismiss its tooltip through the global tooltip owner.",
);
for (const localAgentTooltipOwner of [
  "showPlayerNoteTooltip(",
  "hidePlayerNoteTooltip(",
  'document.addEventListener("pointerover", onPointerOver, true);',
  'document.addEventListener("pointerout", onPointerOut, true);',
  'document.addEventListener("focusin", onFocusIn, true);',
  'document.addEventListener("focusout", onFocusOut, true);',
]) {
  invariant(
    !desktopTableUi.includes(localAgentTooltipOwner),
    `Agent wallet copy must not retain local tooltip ownership through ${localAgentTooltipOwner}`,
  );
}

invariant(
  !stylesBase.includes("#tableBody .copyPlayerIdButton[data-tooltip]::after"),
  "Table player-ID copy buttons must not retain a CSS pseudo-tooltip owner.",
);
invariant(
  !stylesBase.includes("#tableBody .playerIdText[data-tooltip]::after"),
  "Table player-ID text must not retain a CSS pseudo-tooltip owner.",
);
invariant(
  !stylesBase.includes(".copyPlayerIdButton[data-tooltip]::after"),
  "Player-ID copy buttons must not regain generic CSS pseudo-tooltip ownership.",
);
invariant(
  !stylesBase.includes(".playerIdText[data-tooltip]::after"),
  "Player-ID text must not regain generic CSS pseudo-tooltip ownership.",
);
invariant(
  !stylesBase.includes("#tableBody .copyPlayerIdButton {\n  width: 100%;\n  height: 38px;"),
  "Table player-ID generators must not retain the former forced 38px height.",
);

invariant(
  coreSource.includes('button.dataset.tooltip = "Click to copy";'),
  "Table player-ID copy buttons must expose their tooltip only to the global tooltip owner.",
);
invariant(
  !coreSource.includes("function tableTooltipTarget(event)"),
  "The table event runtime must not install a delegated tooltip target owner.",
);
invariant(
  !coreSource.includes("showPlayerNoteTooltip(tooltip)"),
  "The table event runtime must not position delegated tooltips locally.",
);
invariant(
  !coreSource.includes('tableBody?.addEventListener("pointerover", (event) => {'),
  "The table event runtime must not own tooltip pointerover handling.",
);
invariant(
  !coreSource.includes('tableBody?.addEventListener("focusin", (event) => {'),
  "The table event runtime must not own tooltip focus handling.",
);

for (const required of [
  "Number(window.__mflTooltipHeight)",
  "iconRect.top - tooltipRect.height - tooltipHeight",
  "iconRect.bottom + tooltipHeight",
]) {
  invariant(coreSource.includes(required), `Canonical app-core is missing Tooltip Height spacing through ${required}.`);
}
invariant(
  !coreBuild.includes("normalizeTooltipHeightOwnership"),
  "The build must not restore a post-split Tooltip Height rewrite layer.",
);
invariant(
  coreBuild.includes('source.includes("function tableTooltipTarget(event)") || source.includes("showPlayerNoteTooltip(tooltip)")'),
  "The core build must reject delegated table tooltip ownership after generation.",
);
for (const reroute of [
  'button.dataset.noteTooltip = "Click to copy";',
  "markerElement.dataset.noteTooltip = marker.label;",
  'data-note-tooltip="Click to copy" aria-label="Click to copy player ID"',
  "if (playerAgentLink.dataset.noteTooltip) {",
  "link.dataset.noteTooltip = tooltip;",
]) {
  invariant(!coreBuild.includes(reroute), `The core build must not reroute tooltip ownership through ${reroute}.`);
}
invariant(
  coreBuild.includes('source.includes("__mflTooltipSettings?.gap") || source.includes("anchorHeight = 14")'),
  "The core build must reject legacy specialized-tooltip spacing after generation.",
);
invariant(
  coreBuild.includes("Canonical application core does not position manual tooltips from the real generator rectangle."),
  "The build must verify that specialized manual tooltips use their real generator rectangle.",
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

console.log("Canonical shared-control, filter containment, increment-arrow, footer, Tooltip Height, and static table chrome ownership validation passed.");
