import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [markup, motion, styles] = await Promise.all([
  read("./index.html"),
  read("./motion.css"),
  read("./theme-button.css"),
]);

invariant(
  motion.includes('@import url("/theme-button.css");'),
  "Theme button icon styles must load through the canonical shared-control stylesheet graph.",
);
invariant(
  markup.includes('<button id="themeButton" class="themeButton" type="button" aria-label="Toggle color mode" title="Toggle color mode">')
    && markup.includes('<svg class="themeModeIcon themeMoonSymbol" viewBox="0 0 24 24" aria-hidden="true">')
    && markup.includes('<svg class="themeModeIcon themeSunSymbol" viewBox="0 0 24 24" aria-hidden="true">'),
  "Theme button must own canonical inline SVG icons while preserving first-paint state hooks.",
);
invariant(
  !markup.includes("&#127769;")
    && !markup.includes("&#9728;")
    && !markup.includes("🌙")
    && !markup.includes("☀️"),
  "Legacy emoji theme icons must be removed completely from canonical markup.",
);
invariant(
  markup.includes('#themeButton .themeSunSymbol {')
    && markup.includes('html[data-theme="dark"] #themeButton .themeMoonSymbol {')
    && markup.includes('html[data-theme="dark"] #themeButton .themeSunSymbol {'),
  "Theme icon visibility must remain synchronized from first paint via the active theme.",
);
invariant(
  markup.includes('d="M20 15.2A8 8 0 0 1 8.8 4 8 8 0 1 0 20 15.2Z"'),
  "Dark-mode control must use the canonical outlined crescent geometry.",
);
invariant(
  markup.includes('<circle cx="12" cy="12" r="3.8"></circle>')
    && markup.includes('d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"'),
  "Light-mode control must use the canonical outlined sun geometry.",
);

for (const required of [
  "#themeButton .themeModeIcon {",
  "width: 22px;",
  "height: 22px;",
  "fill: none;",
  "stroke: currentColor;",
  "stroke-width: 2.1;",
  "stroke-linecap: round;",
  "stroke-linejoin: round;",
]) {
  invariant(styles.includes(required), `Theme button icon presentation is missing ${required}`);
}

invariant(!styles.includes("mask-image"), "Theme icons must not rely on CSS mask replacement of legacy glyphs.");
invariant(!styles.includes("!important"), "Theme button icons must not use CSS priority overrides.");

console.log("Theme button icon validation passed.");
