import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [indexHtml, responsive] = await Promise.all([
  read("./index.html"),
  read("./responsive.css"),
]);

includes(indexHtml, 'name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"', "The document viewport must support phone widths and safe areas.");
includes(indexHtml, '<link rel="stylesheet" href="/responsive.css" data-mfl-responsive-layout="true">', "Responsive layout must keep one explicit stylesheet owner.");
includes(responsive, "/* Canonical responsive layout owner.", "Responsive behavior must remain centralized in responsive.css.");
includes(responsive, "@media (max-width: 900px)", "Tablet and mobile layout must share the canonical 900px breakpoint.");
includes(responsive, "--mobile-nav-height: 60px;", "Mobile navigation must reserve enough height for touch-sized controls.");
includes(responsive, "height: 44px;", "Mobile controls must retain a 44px touch target.");
includes(responsive, "overflow-x: auto;", "Wide tables and horizontal control rows must remain pan-scrollable instead of shrinking their content.");
includes(responsive, "env(safe-area-inset-bottom)", "Mobile layout must account for device safe areas.");
includes(responsive, "font-size: 16px;", "Mobile form controls must avoid browser zoom-on-focus behavior.");
includes(responsive, "@media (max-width: 520px)", "Phone layouts must have a dedicated compact breakpoint.");
includes(responsive, ".controlsBar,\n  #databaseStatsPage .databaseStatsCustomFilter", "Dense table controls must collapse to one column on phones.");
includes(responsive, "@media (max-width: 380px)", "Very narrow phones must have an additional layout safeguard.");
includes(responsive, "@media (hover: none) and (pointer: coarse)", "Touch-only devices must keep a dedicated interaction contract.");
includes(responsive, ".playerAttributeViewButton,\n  .pager button {\n    min-height: 44px;", "Touch navigation and pager controls must remain finger-sized.");
excludes(responsive, "!important", "Responsive layout must not rely on !important overrides.");

console.log("Responsive layout validation passed: mobile geometry, touch targets, safe areas, and horizontal data scrolling stay single-owned.");
