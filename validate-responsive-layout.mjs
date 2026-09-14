import { validateResponsiveChrome } from "./validation/responsive-chrome.mjs";
import { validateResponsiveTables } from "./validation/responsive-tables.mjs";
import { validateResponsivePlayer } from "./validation/responsive-player.mjs";
import { validateResponsiveEvaluation } from "./validation/responsive-evaluation.mjs";
import { validateResponsiveStatic } from "./validation/responsive-static.mjs";
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
validateResponsiveStatic(context);
console.log("Responsive chrome, tables, Player, Evaluation, and static-route contracts passed.");
