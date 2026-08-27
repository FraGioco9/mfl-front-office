import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [markup, motion, styles, moonAsset, sunAsset] = await Promise.all([
  read("./index.html"),
  read("./motion.css"),
  read("./theme-button.css"),
  read("./theme-moon-reference.svg"),
  read("./theme-sun-reference.svg"),
]);

invariant(
  motion.includes('@import url("/theme-button.css");'),
  "Theme button icon styles must load through the canonical shared-control stylesheet graph.",
);
invariant(
  markup.includes('<button id="themeButton" class="themeButton" type="button" aria-label="Toggle color mode" title="Toggle color mode">')
    && markup.includes('class="themeModeIcon themeMoonSymbol"')
    && markup.includes('class="themeModeIcon themeSunSymbol"'),
  "Theme button must preserve the canonical first-paint theme state hooks.",
);
invariant(
  !markup.includes("&#127769;")
    && !markup.includes("&#9728;")
    && !markup.includes("🌙")
    && !markup.includes("☀️"),
  "Legacy emoji theme icons must stay removed from canonical markup.",
);
invariant(
  markup.includes('#themeButton .themeSunSymbol {')
    && markup.includes('html[data-theme="dark"] #themeButton .themeMoonSymbol {')
    && markup.includes('html[data-theme="dark"] #themeButton .themeSunSymbol {'),
  "Theme icon visibility must remain synchronized from first paint via the active theme.",
);

for (const required of [
  "#themeButton .themeModeIcon {",
  "width: 22px;",
  "height: 22px;",
  "background-position: center;",
  "background-repeat: no-repeat;",
  "background-size: contain;",
  "#themeButton .themeModeIcon > * {\n  display: none;\n}",
  'background-image: url("/theme-moon-reference.svg");',
  'background-image: url("/theme-sun-reference.svg");',
  "filter: invert(1);",
]) {
  invariant(styles.includes(required), `Theme button recreated-asset presentation is missing ${required}`);
}

invariant(
  moonAsset.includes('viewBox="0 0 96 96"')
    && moonAsset.includes('fill="#141414"')
    && moonAsset.includes('M41 6L28 11L16 22L10 33'),
  "Moon asset must be the traced crescent recreated from the approved reference image.",
);
invariant(
  sunAsset.includes('viewBox="0 0 96 96"')
    && sunAsset.includes('fill="#141414"')
    && sunAsset.includes('M43 24L37 26L28 34L24 44')
    && sunAsset.includes('M46 5L46 17L48 18L50 16'),
  "Sun asset must be the traced sun recreated from the approved reference image.",
);
invariant(!styles.includes("mask-image"), "Theme icons must not rely on CSS mask replacement.");
invariant(!styles.includes("!important"), "Theme button icons must not use CSS priority overrides.");

console.log("Theme button recreated-reference icon validation passed.");
