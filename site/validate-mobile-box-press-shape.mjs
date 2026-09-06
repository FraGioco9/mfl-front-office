import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [motion, responsive, stylesBase, playerSource] = await Promise.all([
  read("./motion.css"),
  read("./responsive.css"),
  read("./styles-base.css"),
  read("./modules/core-sources/player.js"),
]);

invariant(
  responsive.includes("  button {\n    -webkit-tap-highlight-color: transparent;\n  }"),
  "Mobile button boxes must keep browser-native rectangular tap highlights disabled.",
);
invariant(
  responsive.includes("  button:active:not(:disabled) {\n    filter: brightness(0.9);\n  }"),
  "Mobile button boxes must keep rendered-element press feedback.",
);
invariant(
  responsive.includes(".menuRail .navButton")
    && responsive.includes("-webkit-tap-highlight-color: transparent;")
    && responsive.includes(".menuRail #sidebar .navButton:not(.active):active"),
  "Mobile navigation anchor boxes must keep their existing shape-aware press contract.",
);

invariant(
  motion.includes("@media (hover: none) and (pointer: coarse)"),
  "Non-button box press feedback must be limited to touch/coarse-pointer interactions.",
);
for (const token of [
  'input:not([type="hidden"]):not([type="range"])',
  "select,",
  "textarea,",
  ".playerExternalButton",
  "-webkit-tap-highlight-color: transparent;",
  "):active:not(:disabled) {\n    filter: brightness(0.9);",
]) {
  invariant(motion.includes(token), `Touch box press feedback is missing ${token}`);
}

invariant(
  playerSource.includes('const external = document.createElement("a");')
    && playerSource.includes('external.className = "playerExternalButton playerHeroPrimaryAction";'),
  "The player external action must remain a boxed anchor covered by the non-button touch contract.",
);
invariant(
  stylesBase.includes(".playerEvaluateButton,\n.playerExternalButton {\n  display: inline-flex;")
    && stylesBase.includes("border-radius: 6px;"),
  "The player external action must retain its canonical rounded box geometry.",
);

for (const forbidden of [
  "a[href]",
  ".playerNameLink",
  ".agentTableLink",
  "[role=\"button\"]",
  "::before",
  "::after",
  "!important",
]) {
  invariant(!motion.includes(forbidden), `Touch box press feedback must not broaden to ${forbidden}`);
}

console.log("Mobile press feedback follows rendered button, navigation, form-field, and boxed-link shapes without affecting ordinary text links.");
