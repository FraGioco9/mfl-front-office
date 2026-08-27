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
    && markup.includes('class="themeMoonSymbol"')
    && markup.includes('class="themeSunSymbol"'),
  "Theme button must preserve its canonical control and first-paint icon state hooks.",
);
invariant(
  markup.includes('#themeButton .themeSunSymbol {')
    && markup.includes('html[data-theme="dark"] #themeButton .themeMoonSymbol {')
    && markup.includes('html[data-theme="dark"] #themeButton .themeSunSymbol {'),
  "Theme icon visibility must remain synchronized from first paint via the active theme.",
);

for (const required of [
  '#themeButton :is(.themeMoonSymbol, .themeSunSymbol) {',
  "font-size: 0;",
  "line-height: 0;",
  '#themeButton :is(.themeMoonSymbol, .themeSunSymbol)::before {',
  'content: "";',
  "display: inline-block;",
  "width: 22px;",
  "height: 22px;",
  "background-color: currentColor;",
  "mask-repeat: no-repeat;",
  "mask-position: center;",
  "mask-size: 22px 22px;",
]) {
  invariant(styles.includes(required), `Theme button icon presentation is missing ${required}`);
}

invariant(
  styles.includes("M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z")
    && styles.includes("stroke-width='2.1'")
    && styles.includes("stroke-linecap='round'")
    && styles.includes("stroke-linejoin='round'"),
  "Dark-mode control must use the canonical rounded outline crescent vector.",
);
invariant(
  styles.includes("%3Ccircle cx='12' cy='12' r='4' fill='none' stroke='black' stroke-width='2.1'/%3E")
    && styles.includes("M12 2v2.2M12 19.8V22")
    && styles.includes("M2 12h2.2M19.8 12H22"),
  "Light-mode control must use the canonical rounded outline sun vector.",
);
invariant(!styles.includes("!important"), "Theme button icons must not use CSS priority overrides.");

console.log("Theme button icon validation passed.");
