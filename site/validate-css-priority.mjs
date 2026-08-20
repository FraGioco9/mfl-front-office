import { readFile } from "node:fs/promises";

const canonicalCssSources = [
  "styles.css",
  "styles-base.css",
  "scrollbars.css",
  "dropdowns.css",
  "controls.css",
  "footer.css",
  "loading.css",
  "responsive.css",
  "index.html",
];

for (const sourcePath of canonicalCssSources) {
  const source = await readFile(new URL(`./${sourcePath}`, import.meta.url), "utf8");
  if (source.includes("!important")) {
    throw new Error(`${sourcePath} must not use !important; fix CSS ownership or cascade order instead.`);
  }
}

console.log("Canonical CSS priority validation passed.");
