import { readFile } from "node:fs/promises";

const canonicalStylesheets = [
  "styles.css",
  "scrollbars.css",
  "dropdowns.css",
  "controls.css",
  "footer.css",
  "loading.css",
];

for (const stylesheet of canonicalStylesheets) {
  const source = await readFile(new URL(`./${stylesheet}`, import.meta.url), "utf8");
  if (source.includes("!important")) {
    throw new Error(`${stylesheet} must not use !important; fix stylesheet ownership or cascade order instead.`);
  }
}

console.log("Canonical stylesheet priority validation passed.");
