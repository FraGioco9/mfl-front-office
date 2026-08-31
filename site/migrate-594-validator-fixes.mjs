import { readFile, writeFile } from "node:fs/promises";

const validateUrl = new URL("./validate.mjs", import.meta.url);
let source = await readFile(validateUrl, "utf8");
const before = 'includes(buildCore, "modules/app-core-runtime.js", "The core build must write the generated shared runtime artifact.");';
const after = 'includes(buildCore, \'runtime: "app-core-runtime.js"\', "The core build must write the generated shared runtime artifact.");';
if (!source.includes(before)) throw new Error("Source-owned core runtime build assertion was not found.");
source = source.replace(before, after);
await writeFile(validateUrl, source, "utf8");
