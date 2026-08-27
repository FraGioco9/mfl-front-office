import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [markup, motion, icons] = await Promise.all([
  read("./index.html"),
  read("./motion.css"),
  read("./theme-icons.css"),
]);

invariant(
  motion.includes('@import url("/theme-icons.css");'),
  "Recreated theme icons must load through the canonical shared-control stylesheet graph.",
);
invariant(
  markup.includes('class="themeMoonSymbol"') && markup.includes('class="themeSunSymbol"'),
  "Theme control must preserve the existing first-paint moon/sun state hooks.",
);
invariant(
  markup.includes('#themeButton .themeSunSymbol {')
    && markup.includes('html[data-theme="dark"] #themeButton .themeMoonSymbol {')
    && markup.includes('html[data-theme="dark"] #themeButton .themeSunSymbol {'),
  "Theme icon visibility must remain synchronized from first paint.",
);

for (const required of [
  '#themeButton :is(.themeMoonSymbol, .themeSunSymbol) {',
  'font-size: 0;',
  'width: 22px;',
  'height: 22px;',
  '#themeButton .themeMoonSymbol::before {',
  '#themeButton .themeSunSymbol::before {',
  "M18.8 17.2A8 8 0 1 1 10.2 3.8a7.1 7.1 0 0 0 8.6 13.4Z",
  "M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6",
  "stroke-linecap='round'",
  "stroke-linejoin='round'",
]) {
  invariant(icons.includes(required), `Recreated theme icon presentation is missing ${required}`);
}

invariant(!icons.includes("mask-image"), "Theme icons must not use CSS masks.");
invariant(!icons.includes("!important"), "Theme icons must not use CSS priority overrides.");

console.log("Recreated theme icon validation passed.");
