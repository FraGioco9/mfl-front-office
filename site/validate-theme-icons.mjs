import { invariant } from "./validation/assertions.mjs";
import { access, readFile } from "node:fs/promises";

const [markup, motion, appCore, controlInteractions, controls, stylesBase] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./motion.css", import.meta.url), "utf8"),
  Promise.all([
    readFile(new URL("./modules/core-sources/shared.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/evaluation.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/mfl-stats.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/club.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/settings.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/player.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/table.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/wallet.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/watchlist.js", import.meta.url), "utf8"),
  ]).then((parts) => parts.join("\n")),
  readFile(new URL("./control-interactions-runtime.js", import.meta.url), "utf8"),
  readFile(new URL("./controls.css", import.meta.url), "utf8"),
  readFile(new URL("./styles-base.css", import.meta.url), "utf8"),
].map((promise) => promise.then((value) => String(value).replace(/\r\n?/g, "\n"))));

invariant(!markup.includes("&#127769;") && !markup.includes("&#9728;") && !markup.includes("🌙") && !markup.includes("☀️"), "Legacy emoji theme icons must be removed from canonical markup.");
invariant(!markup.includes('<span class="themeMoonSymbol"') && !markup.includes('<span class="themeSunSymbol"'), "Legacy span-based theme icon nodes must be removed from canonical markup.");
invariant(markup.includes('<svg class="themeMoonSymbol themeModeIcon" width="22" height="22" viewBox="0 0 24 24"') && markup.includes('d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"'), "Theme button must contain the recreated outlined crescent SVG directly in canonical markup.");
invariant(markup.includes('<svg class="themeSunSymbol themeModeIcon" width="22" height="22" viewBox="0 0 24 24"') && markup.includes('<circle cx="12" cy="12" r="5.2"></circle>') && markup.includes('d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6M4.8 4.8l1.8 1.8M17.4 17.4l1.8 1.8M4.8 19.2l1.8-1.8M17.4 6.6l1.8-1.8"'), "Theme button must contain the recreated outlined sun SVG directly in canonical markup.");
invariant(markup.includes('stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"'), "Theme SVGs must use the shared rounded currentColor outline treatment.");
invariant(markup.includes('#themeButton .themeMoonSymbol {\n        display: none;\n      }') && markup.includes('html[data-theme="dark"] #themeButton .themeSunSymbol {\n        display: none;\n      }') && markup.includes('html[data-theme="dark"] #themeButton .themeMoonSymbol {\n        display: inline;\n      }'), "First paint must show sun in Light mode and moon in Dark mode.");
invariant(!motion.includes('theme-icons.css'), "Theme icons must not rely on a replacement stylesheet after direct inline SVG ownership.");
let replacementStylesheetExists = true;
try { await access(new URL("./theme-icons.css", import.meta.url)); } catch { replacementStylesheetExists = false; }
invariant(!replacementStylesheetExists, "The previous theme icon replacement stylesheet must be removed.");
invariant(markup.includes('aria-label="Toggle color mode"') && !markup.includes('title="Toggle color mode"'), "Theme button must keep its accessible label without a native hover tooltip.");
invariant(!appCore.includes("themeButton.title ="), "Theme changes must not recreate Light/Night mode title tooltips.");
invariant(!controlInteractions.includes('target?.closest("#themeButton")'), "Theme toggle must not keep a tooltip-dismiss interaction special case after tooltip removal.");
invariant(controls.split(".themeButton,\n  .navButton,").length - 1 >= 2, "Theme button must participate in the shared inactive-control hover contract.");
invariant(stylesBase.includes(".themeButton {\n") && stylesBase.includes("transition: background 120ms ease, border-color 120ms ease;"), "Theme button must use the same hover transition timing as the other chrome buttons.");

console.log("Direct inline theme icon and shared hover validation passed.");
