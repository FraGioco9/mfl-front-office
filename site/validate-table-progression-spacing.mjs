import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [appCoreSource, tableRuntime] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-table-runtime.js"),
]);

const explicitProgressionSpacing = 'progressionElement.textContent = `${statColumn === "overall" ? "\\u00A0" : " "}(${progression > 0 ? "+" : ""}${progression})`;';

for (const [name, source] of [
  ["canonical app-core", appCoreSource],
  ["generated Table runtime", tableRuntime],
]) {
  invariant(
    source.includes(explicitProgressionSpacing),
    `${name} must preserve the normal stat space and give Overall an explicit non-breaking space before progression.`,
  );
  invariant(
    !source.includes('progressionElement.textContent = `(${progression > 0 ? "+" : ""}${progression})`;'),
    `${name} must not collapse progression directly against the base stat value.`,
  );
}

invariant(
  appCoreSource.includes('contentHost.className = "tableOverallCellContent";')
    && appCoreSource.includes('progressionElement.className = progression > 0 ? "progressionValue positive" : "progressionValue negative";')
    && appCoreSource.includes("contentHost.appendChild(progressionElement);"),
  "Overall spacing must be fixed inside the existing shared renderer without replacing its rarity/styling lifecycle.",
);

console.log("Overall and stat progression spacing validation passed.");
