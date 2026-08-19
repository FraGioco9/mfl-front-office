import { access, readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [stylesBase, styles, controls, footer, entry, staticUi, discountTooltipUi, coreNormalizer] = await Promise.all([
  read("./styles-base.css"),
  read("./styles.css"),
  read("./controls.css"),
  read("./footer.css"),
  read("./modules/app-entry.js"),
  read("./static-ui-runtime.js"),
  read("./evaluation-discount-rate-ui-runtime.js"),
  read("./modules/app-core-normalizer.js"),
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

invariant(
  staticUi.includes("gap: 6,"),
  "The global tooltip contract must keep a 6px generator gap.",
);
invariant(
  staticUi.includes("window.__mflTooltipSettings = TOOLTIP_SETTINGS;"),
  "The canonical tooltip settings must remain exposed to specialized tooltip owners.",
);
invariant(
  discountTooltipUi.includes("Number(window.__mflTooltipSettings?.gap) || 6"),
  "The Evaluation discount tooltip must consume the global tooltip gap.",
);
const normalizedTooltipGapUses = coreNormalizer.split("Number(window.__mflTooltipSettings?.gap) || 6").length - 1;
invariant(
  normalizedTooltipGapUses >= 2,
  "Evaluation action and player-note tooltips must consume the global tooltip gap through core normalization.",
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

console.log("Canonical shared-control, footer, tooltip, and static table chrome ownership validation passed.");
