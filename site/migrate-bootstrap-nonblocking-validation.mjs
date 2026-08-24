import { readFile, writeFile } from "node:fs/promises";

const validatorPath = new URL("./validate-bootstrap-ownership.mjs", import.meta.url);
const before = `includes(\n  bootstrapCore,\n  'const wrappedWithInteractionBusy = (callback, reason = "interaction-loading") => {',\n  "The shared busy bridge must retain explicit reason ownership.",\n);`;
const after = `includes(\n  bootstrapCore,\n  "const wrappedWithInteractionBusy = (callback, reason = ROUTE_LOADING_REASON) => {",\n  "Legacy uncached route/data loads must default to the non-blocking route-loading lifecycle.",\n);\nincludes(\n  bootstrapCore,\n  'window.__mflWithInteractionBusy = (callback) => run(callback, "interaction-loading");',\n  "The explicit operation-busy helper must retain exclusive interaction-loading ownership.",\n);`;

let source = await readFile(validatorPath, "utf8");
if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error("Could not find the obsolete shared busy bridge assertion.");
  source = source.replace(before, after);
  await writeFile(validatorPath, source);
}

console.log("Migrated Bootstrap non-blocking loading validation.");
