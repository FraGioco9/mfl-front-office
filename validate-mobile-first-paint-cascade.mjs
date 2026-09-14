import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [indexSource, projectionSource, sharedTableUiSource] = await Promise.all([
  read("./index.html"),
  read("./sync-release-projections.mjs"),
  read("./shared-table-ui-runtime.js"),
]);

const responsiveLink = '<link rel="stylesheet" href="/styles-runtime.css" data-mfl-responsive-layout="true">';
const cascadeStart = "<!-- BEGIN GENERATED MOBILE TABLE FIRST PAINT CASCADE -->";
const cascadeEnd = "<!-- END GENERATED MOBILE TABLE FIRST PAINT CASCADE -->";
const responsiveIndex = indexSource.indexOf(responsiveLink);
const cascadeStartIndex = indexSource.indexOf(cascadeStart);
const cascadeEndIndex = indexSource.indexOf(cascadeEnd);
const headEndIndex = indexSource.indexOf("</head>");

invariant(responsiveIndex >= 0, "Responsive CSS must remain present in the document head.");
invariant(cascadeStartIndex > responsiveIndex, "Mobile first-paint styling must be moved after responsive.css before rendering.");
invariant(cascadeEndIndex > cascadeStartIndex, "Mobile first-paint cascade projection must be complete.");
invariant(headEndIndex > cascadeEndIndex, "Mobile first-paint cascade handoff must finish before the document body can paint.");
invariant(
  indexSource.includes('const style = document.getElementById("mflInitialMobileTableStyle");')
    && indexSource.includes("if (style instanceof HTMLStyleElement) document.head.appendChild(style);"),
  "The pre-body cascade handoff must move the existing mobile first-paint style to the final head position.",
);

invariant(
  projectionSource.includes("function mobileTableFirstPaintCascadeProjectionSource()")
    && projectionSource.includes("normalizeIndexMobileTableFirstPaintCascadeProjection")
    && projectionSource.includes('href="\\/styles-runtime\\.css" data-mfl-responsive-layout="true"'),
  "Release projection generation must own the pre-body mobile cascade handoff after responsive.css.",
);

invariant(
  sharedTableUiSource.includes('const MOBILE_STYLE_ID = "mflInitialMobileTableStyle";')
    && sharedTableUiSource.includes("document.head.appendChild(style);"),
  "Hydration must continue reusing the same mobile style owner and final cascade position.",
);

console.log("Mobile first-paint cascade validation passed.");
