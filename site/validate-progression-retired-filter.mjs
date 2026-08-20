import { readFile } from "node:fs/promises";

const source = String(await readFile(new URL("./api/_data-page.js", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

invariant(
  source.includes('return `((${activityCondition}) OR coalesce(retirement_years, -1) = 0)`;'),
  "Progression must keep retired players in the source set when the retired filter is disabled.",
);

invariant(
  source.includes('if (String(query.hideRetired || "") === "1") {\n    conditions.push("coalesce(retirement_years, -1) <> 0");\n  }'),
  "The Hide retired players filter must still remove retired rows when enabled.",
);

console.log("Progression retired-player filter validation passed.");
