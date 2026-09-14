import { invariant } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const [index, styles] = await Promise.all([
  read("./index.html"),
  read("./styles-base.css"),
]);

invariant((index.match(/id="settingsIconGlyph"/g) || []).length === 1,
  "Settings must have exactly one canonical SVG symbol definition.");
invariant((index.match(/href="#settingsIconGlyph"/g) || []).length === 2,
  "Settings and Advanced Settings must both reference the same canonical icon symbol.");
invariant(index.includes('class="navEmoji navSettingsIcon settingsIcon"'),
  "The Settings navigation button must use the shared Settings icon class.");
invariant(index.includes('class="settingsIcon advancedSettingsIcon"'),
  "Advanced Settings must use the shared Settings icon class.");
invariant(!index.includes("&#9881;") && !index.includes("⚙"),
  "Legacy Unicode Settings glyphs must be removed.");
invariant(!index.includes("M19.4 15a1.7"),
  "The legacy duplicated Settings gear path must be removed.");
invariant(index.includes('M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5'),
  "The canonical Settings icon must retain the redesigned symmetric gear geometry.");

const groupStart = styles.indexOf(".navDatabaseIcon,");
const sharedStyle = styles.slice(groupStart, groupStart + 300);
invariant(groupStart >= 0
  && sharedStyle.includes(".settingsIcon {")
  && sharedStyle.includes("fill: none;")
  && sharedStyle.includes("stroke: currentColor;")
  && sharedStyle.includes("stroke-width: 2;")
  && sharedStyle.includes("stroke-linecap: round;")
  && sharedStyle.includes("stroke-linejoin: round;"),
  "The shared Settings icon must use the same currentColor stroke language as the other site icons.");
invariant(styles.includes(".advancedSettingsIcon {")
  && styles.includes("flex: 0 0 16px;")
  && styles.includes("width: 16px;")
  && styles.includes("height: 16px;"),
  "Advanced Settings must size the shared icon without changing its button geometry.");
invariant(!styles.includes(".advancedSettingsButton span {"),
  "The obsolete Unicode-glyph styling rule must be removed.");
invariant(styles.includes(".iconSprite {") && styles.includes("pointer-events: none;"),
  "The canonical SVG symbol sprite must not affect layout or interaction.");

console.log("Shared Settings icon ownership and styling validation passed.");
