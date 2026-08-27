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
  markup.includes('d="M19.6 17.9A8.6 8.6 0 1 1 10.2 3.7 7.2 7.2 0 0 0 19.6 17.9Z"'),
  "Dark-mode control must use the reference-inspired crescent geometry.",
);
invariant(
  markup.includes('<circle cx="12" cy="12" r="5.4"></circle>')
    && markup.includes('d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6M4.8 4.8l1.8 1.8M17.4 17.4l1.8 1.8M4.8 19.2l1.8-1.8M17.4 6.6l1.8-1.8"'),
  "Light-mode control must use the reference-inspired sun geometry.",
);

for (const required of [
  "#themeButton .themeModeIcon {",
  "width: 22px;",
  "height: 22px;",
  "#themeButton .themeMoonSymbol path {",
  "fill: currentColor;",
  "stroke: currentColor;",
  "stroke-width: 3;",
  "stroke-linejoin: miter;",
  "#themeButton .themeSunSymbol circle {",
  "stroke: none;",
  "#themeButton .themeSunSymbol path {",
  "stroke-width: 2.1;",
  "stroke-linecap: round;",
  "stroke-linejoin: round;",
]) {
  invariant(styles.includes(required), `Theme button icon presentation is missing ${required}`);
}

invariant(
  styles.includes("#themeButton .themeMoonSymbol path {\n  fill: currentColor;\n  stroke: currentColor;\n  stroke-width: 3;\n  stroke-linejoin: miter;\n}")
    && styles.includes("#themeButton .themeSunSymbol circle {\n  fill: currentColor;\n  stroke: none;\n}"),
  "Reference theme icons must visibly use the broad filled crescent and filled sun-center treatment.",
);
invariant(!styles.includes("mask-image"), "Theme icons must not rely on CSS mask replacement of legacy glyphs.");
invariant(!styles.includes("!important"), "Theme button icons must not use CSS priority overrides.");

console.log("Theme button icon validation passed.");
