import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [controls, stylesBase, core, index] = await Promise.all([
  read("./controls.css"),
  read("./styles-base.css"),
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./index.html"),
]);

const genericHoverStart = stylesBase.indexOf("button:hover:not(:disabled) {");
const genericHoverEnd = stylesBase.indexOf("\n}", genericHoverStart);
const genericHover = genericHoverStart >= 0 && genericHoverEnd > genericHoverStart
  ? stylesBase.slice(genericHoverStart, genericHoverEnd + 2)
  : "";
invariant(
  genericHover.includes("border-color: var(--primary-hover);")
    && genericHover.includes("background: var(--primary-hover);"),
  "The generic button hover used by accountButton must remain the primary-hover contract.",
);

const popupBaseStart = controls.indexOf(".popupCloseButton,\n.popupAddButton,\n.popupMinusButton {");
const popupBaseEnd = controls.indexOf("\n}", popupBaseStart);
const popupBase = popupBaseStart >= 0 && popupBaseEnd > popupBaseStart
  ? controls.slice(popupBaseStart, popupBaseEnd + 2)
  : "";
invariant(
  popupBase.includes("position: relative;")
    && popupBase.includes("font-size: 0;")
    && !popupBase.includes("transition:"),
  "Shared +/- glyph geometry must not impose a separate hover transition on Evaluation controls.",
);

const popupHoverStart = controls.indexOf(".popupCloseButton:hover:not(:disabled),");
const popupHoverEnd = controls.indexOf("\n}", popupHoverStart);
const popupHover = popupHoverStart >= 0 && popupHoverEnd > popupHoverStart
  ? controls.slice(popupHoverStart, popupHoverEnd + 2)
  : "";
invariant(
  popupHover.includes(".trainingStatControls button:hover:not(:disabled)")
    && !popupHover.includes(".popupAddButton:hover:not(:disabled)")
    && !popupHover.includes(".popupMinusButton:hover:not(:disabled)"),
  "Evaluation +/- controls must not be captured by the row-hover popup state; Player Training keeps that scoped behavior.",
);

invariant(
  controls.includes(".popupCloseButton {\n  transition: background var(--mfl-motion-fast) ease, border-color var(--mfl-motion-fast) ease, color var(--mfl-motion-fast) ease;\n}")
    && controls.includes(".trainingStatControls button {\n  transition: background var(--mfl-motion-fast) ease, border-color var(--mfl-motion-fast) ease, color var(--mfl-motion-fast) ease;\n}"),
  "Existing close-button and Player Training motion must remain unchanged.",
);

const overallControlStart = core.indexOf("function evaluationOverallControl(value, season) {");
const overallControlEnd = core.indexOf("function evaluationSummaryPosition(", overallControlStart);
const overallControl = overallControlStart >= 0 && overallControlEnd > overallControlStart
  ? core.slice(overallControlStart, overallControlEnd)
  : "";
invariant(
  overallControl.includes("popupMinusButton")
    && overallControl.includes("popupAddButton")
    && overallControl.includes("data-evaluation-overall-season")
    && overallControl.includes("data-evaluation-overall-delta")
    && overallControl.includes("evaluationOverallControl"),
  "Evaluation Overall must keep using the shared +/- glyph buttons without introducing a page-specific control class.",
);

invariant(
  index.includes('id="accountButton"') && index.includes('class="compactButton"'),
  "accountButton must remain a normal button consuming the generic primary-hover contract.",
);

console.log("Evaluation +/- hover inherits accountButton primary-hover behavior while Player Training remains scoped.");
