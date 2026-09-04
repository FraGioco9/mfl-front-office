import fs from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const responsive = await fs.readFile(resolve(siteRoot, "responsive.css"), "utf8");

function includes(expected, message) {
  if (!responsive.includes(expected)) throw new Error(message);
}

includes(
  ".changelogPage h2 {\n    margin-bottom: 4px;\n    font-size: 22px;",
  "The <=900px Changelog heading must scale down from desktop geometry.",
);
includes(
  ".changelogMinorToggle {\n    gap: 8px;\n    min-height: 40px;\n    padding: 8px 10px;",
  "The <=900px Changelog release rows must compact spacing and height together.",
);
includes(
  ".changelogPatchList li {\n    grid-template-columns: 76px minmax(0, 1fr);\n    gap: 7px;\n    min-height: 31px;",
  "The <=900px Changelog patch rows must use the tablet-scale geometry.",
);
includes(
  ".changelogPage h2 {\n    margin-bottom: 3px;\n    font-size: 19px;",
  "The <=520px Changelog heading must apply the phone scaling step.",
);
includes(
  ".changelogMinorToggle {\n    gap: 6px;\n    min-height: 36px;\n    padding: 6px 8px;",
  "The <=520px Changelog release rows must compact proportionally.",
);
includes(
  ".changelogPatchList li {\n    grid-template-columns: 64px minmax(0, 1fr);\n    gap: 5px;\n    min-height: 27px;",
  "The <=520px Changelog patch rows must use the phone-scale columns and spacing.",
);
includes(
  ".changelogMinorToggle {\n    grid-template-columns: minmax(0, 1fr) auto;\n    gap: 4px;\n    min-height: 34px;",
  "The <=380px Changelog release row must use the tiny-phone compact layout.",
);
includes(
  ".changelogPatchList li {\n    grid-template-columns: 1fr;\n    gap: 1px;\n    min-height: 0;",
  "The <=380px Changelog patch row must stack without preserving desktop row height.",
);
includes(
  ".changelogPatchList span,\n  .changelogPatchList p {\n    min-height: 0;\n    font-size: 10px;",
  "The <=380px Changelog patch typography must scale with the stacked row geometry.",
);

console.log("Changelog geometry scales progressively at 900px, 520px, and 380px without changing desktop ownership.");
