import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [entry, filterRuntime, nationalityRuntime] = await Promise.all([
  read("./modules/app-entry.js"),
  read("./filter-controls-runtime.js"),
  read("./nationality-filter-options-runtime.js"),
]);

invariant(
  filterRuntime.includes('if (bodyPage === "club") return true;'),
  "Filter controls must treat an active Club page as non-filterable.",
);
invariant(
  nationalityRuntime.includes('if (bodyPage === "club") return true;'),
  "Nationality filter options must treat an active Club page as non-filterable.",
);
invariant(
  entry.includes("runtimeWindow.__mflFilterControlsRuntime?.sync?.();"),
  "Table route runtime finalization must retain the shared filter sync for filterable pages.",
);

console.log("Club filter-free runtime guards remain intact while direct startup resolves Club before finalization.");
