import fs from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const responsive = await fs.readFile(resolve(siteRoot, "responsive.css"), "utf8");

function includes(expected, message) {
  if (!responsive.includes(expected)) throw new Error(message);
}

function excludes(unexpected, message) {
  if (responsive.includes(unexpected)) throw new Error(message);
}

includes(
  "width: min(400px, calc(100vw - 16px - env(safe-area-inset-left) - env(safe-area-inset-right)));",
  "The <=520px selection bar must use the compact safe-area-aware width contract.",
);
includes(
  ".selectionSummary {\n    grid-template-rows: repeat(2, 16px);\n    min-width: 74px;",
  "The <=520px selection count and Clear action must use equal tracks around the bar centerline.",
);
includes(
  ".selectionBar span {\n    font-size: 12px;\n    line-height: 15px;",
  "The <=520px selection label must scale down with the bar.",
);
includes(
  ".selectionBar button:not(.textButton) {\n    width: auto;\n    min-width: 0;\n    height: 32px;",
  "The <=520px selection actions must stay compact instead of becoming full-width stacked controls.",
);
includes(
  "width: min(360px, calc(100vw - 12px - env(safe-area-inset-left) - env(safe-area-inset-right)));",
  "The <=380px selection bar must apply the second compact scaling step.",
);
includes(
  ".selectionSummary {\n    grid-template-rows: repeat(2, 15px);\n    min-width: 68px;",
  "The <=380px selection count and Clear action must stay symmetric around the bar centerline.",
);
includes(
  ".selectionBar button:not(.textButton) {\n    height: 30px;\n    min-height: 30px;\n    padding-inline: 6px;\n    font-size: 10px;",
  "The <=380px selection actions must scale proportionally with the bar.",
);
excludes(
  ".selectionActions {\n    display: grid;\n    grid-template-columns: 1fr;\n    width: 100%;",
  "Small-screen selection actions must not regress to the oversized one-button-per-row stack.",
);
excludes(
  ".selectionBar button:not(.textButton) {\n    width: 100%;",
  "Small-screen selection action buttons must not regress to full bar width.",
);

console.log("Mobile selection bar scales progressively and keeps selection summary tracks symmetric around its centerline.");
