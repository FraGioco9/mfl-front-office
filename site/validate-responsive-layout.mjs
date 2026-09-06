import { validateResponsiveChrome } from "./validation/responsive-chrome.mjs";
import { validateResponsiveTables } from "./validation/responsive-tables.mjs";
import { validateResponsivePlayer } from "./validation/responsive-player.mjs";
import { validateResponsiveEvaluation } from "./validation/responsive-evaluation.mjs";
import { validateResponsiveStatic } from "./validation/responsive-static.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [indexHtml, responsive, stylesBase, controls, scrollbars, sharedTableUi, staticUi, appCore, bootstrap] = await Promise.all([
  read("./index.html"),
  read("./responsive.css"),
  read("./styles-base.css"),
  read("./controls.css"),
  read("./scrollbars.css"),
  read("./shared-table-ui-runtime.js"),
  read("./static-ui-runtime.js"),
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
  read("./bootstrap.js"),
]);

const context = { indexHtml, responsive, stylesBase, controls, scrollbars, sharedTableUi, staticUi, appCore, bootstrap };
validateResponsiveChrome(context);
validateResponsiveTables(context);
validateResponsivePlayer(context);
validateResponsiveEvaluation(context);
validateResponsiveStatic(context);
console.log("Responsive chrome, tables, Player, Evaluation, and static-route contracts passed.");
