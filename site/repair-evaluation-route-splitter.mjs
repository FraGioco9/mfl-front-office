// Temporary one-shot repair; remove before merge.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dirname, "modules/app-core-route-chunks.js");
const source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
const before = '["resetInvalidEvaluationLinkToPlainEvaluation"]';
const after = '["recoverInvalidEvaluationLink"]';
if (!source.includes(before)) throw new Error("Could not find the legacy Evaluation recovery helper in restored splitter.");
if (source.includes(after)) throw new Error("Source-owned Evaluation recovery helper is already present.");
await writeFile(path, source.replace(before, after));
console.log("Evaluation splitter now extracts the source-owned recovery helper.");
