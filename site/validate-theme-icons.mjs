import { access, readFile } from "node:fs/promises";

const markup = String(await readFile(new URL("./index.html", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const motion = String(await readFile(new URL("./motion.css", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

invariant(!markup.includes("&#127769;") && !markup.includes("&#9728;") && !markup.includes("🌙") && !markup.includes("☀️"), "Legacy emoji theme icons must be removed from canonical markup.");
invariant(!markup.includes('<span class="themeMoonSymbol"') && !markup.includes('<span class="themeSunSymbol"'), "Legacy span-based theme icon nodes must be removed from canonical markup.");
invariant(markup.includes('<svg class="themeMoonSymbol themeModeIcon" width="22" height="22" viewBox="0 0 24 24"') && markup.includes('d="M18.8 17.2A8 8 0 1 1 10.2 3.8a7.1 7.1 0 0 0 8.6 13.4Z"'), "Theme button must contain the recreated outlined crescent SVG directly in canonical markup.");
invariant(markup.includes('<svg class="themeSunSymbol themeModeIcon" width="22" height="22" viewBox="0 0 24 24"') && markup.includes('<circle cx="12" cy="12" r="5.2"></circle>') && markup.includes('d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6M4.8 4.8l1.8 1.8M17.4 17.4l1.8 1.8M4.8 19.2l1.8-1.8M17.4 6.6l1.8-1.8"'), "Theme button must contain the recreated outlined sun SVG directly in canonical markup.");
invariant(markup.includes('stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"'), "Theme SVGs must use the shared rounded currentColor outline treatment.");
invariant(markup.includes('#themeButton .themeSunSymbol {\n        display: none;\n      }') && markup.includes('html[data-theme="dark"] #themeButton .themeMoonSymbol {\n        display: none;\n      }') && markup.includes('html[data-theme="dark"] #themeButton .themeSunSymbol {\n        display: inline;\n      }'), "Existing first-paint theme visibility ownership must remain intact.");
invariant(!motion.includes('theme-icons.css'), "Theme icons must not rely on a replacement stylesheet after direct inline SVG ownership.");
let replacementStylesheetExists = true;
try { await access(new URL("./theme-icons.css", import.meta.url)); } catch { replacementStylesheetExists = false; }
invariant(!replacementStylesheetExists, "The previous theme icon replacement stylesheet must be removed.");

console.log("Direct inline theme icon validation passed.");
