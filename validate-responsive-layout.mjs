import { validateResponsiveChrome } from "./validation/responsive-chrome.mjs";
import { validateResponsiveTables } from "./validation/responsive-tables.mjs";
import { validateResponsivePlayer } from "./validation/responsive-player.mjs";
import { validateResponsiveEvaluation } from "./validation/responsive-evaluation.mjs";
import { excludes, includes } from "./validation/assertions.mjs";
import { readCombinedCanonicalCoreSource } from "./validate-core-sources.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [indexHtml, responsive, stylesBase, controls, scrollbars, sharedTableUi, staticUi, controlInteractions, playerInteractions, bootstrap] = await Promise.all([
  read("./index.html"),
  read("./responsive.css"),
  read("./styles-base.css"),
  read("./controls.css"),
  read("./scrollbars.css"),
  read("./shared-table-ui-runtime.js"),
  read("./static-ui-runtime.js"),
  read("./control-interactions-runtime.js"),
  read("./player-interactions-runtime.js"),
  read("./bootstrap.js"),
]);
const appCore = readCombinedCanonicalCoreSource();

const context = { indexHtml, responsive, stylesBase, controls, scrollbars, sharedTableUi, staticUi, controlInteractions, playerInteractions, appCore, bootstrap };
validateResponsiveChrome(context);
validateResponsiveTables(context);
validateResponsivePlayer(context);
validateResponsiveEvaluation(context);
includes(stylesBase, ".advancedSettingValue {\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;", "Advanced Settings value boxes must vertically center their content while preserving right alignment.");
includes(stylesBase, ".advancedSettingChevron {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  align-self: center;\n  line-height: 1;", "Advanced Settings chevrons must be vertically centered in their header boxes.");
includes(indexHtml, 'id="settingsIconGlyph" viewBox="0 0 24 24"', "Settings must expose one canonical shared SVG symbol.");
includes(indexHtml, 'class="navEmoji navSettingsIcon settingsIcon"', "Settings navigation must use the shared Settings icon.");
includes(indexHtml, 'class="settingsIcon advancedSettingsIcon"', "Advanced Settings must use the same shared Settings icon.");
includes(indexHtml, 'M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5', "Settings must keep the redesigned symmetric gear geometry.");
excludes(responsive, '[data-initial-page="settings"] #sidebar .navButton[data-page="settings"]', "Mobile first paint must not expose a selected Settings destination in the mobile navigation.");
includes(responsive, "body > #appShell > main {\n    --mfl-footer-page-floor: max(560px, calc(100dvh - var(--mobile-nav-overlay-clearance)));\n    padding: var(--mfl-page-inset-block-start) var(--mfl-page-gutter-inline) var(--mfl-page-inset-block-end);", "Mobile page content must use the shared scaled footer floor and token-owned page padding.");
includes(responsive, "#advancedSettingsModal .advancedSettingsFooter {\n    display: grid;\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n    gap: 6px;\n    padding: 6px 8px;", "Advanced Settings must keep Reset, Discard, and Apply on one compact phone footer row.");
console.log("Responsive chrome, tables, Player, Evaluation, and static-route contracts passed.");
