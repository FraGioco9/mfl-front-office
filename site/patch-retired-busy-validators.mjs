import { readFile, writeFile } from "node:fs/promises";

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Found duplicate ${label}.`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

const validatePath = new URL("./validate.mjs", import.meta.url);
let validate = await readFile(validatePath, "utf8");
validate = replaceOnce(
  validate,
  'includes(bootstrapCore, "function createInteractionBusyController()", "bootstrap-core must own global startup interaction blocking.");\nincludes(bootstrapCore, "function bindInteractionBlockers()", "Busy interaction listeners must be attached only while busy.");\nincludes(bootstrapCore, "function unbindInteractionBlockers()", "Busy interaction listeners must be removable while idle.");',
  'includes(bootstrapCore, "function createInteractionBusyController()", "bootstrap-core must own the canonical route/data loading controller.");\nexcludes(bootstrapCore, "function bindInteractionBlockers()", "The retired whole-site busy blocker must not restore interaction listeners.");\nexcludes(bootstrapCore, "function unbindInteractionBlockers()", "The retired whole-site busy blocker must not restore idle listener cleanup.");',
  "umbrella busy interaction assertions",
);
await writeFile(validatePath, validate);

const zPath = new URL("./validate-z-index-ownership.mjs", import.meta.url);
let zIndex = await readFile(zPath, "utf8");
zIndex = replaceOnce(
  zIndex,
  'invariant(loading.includes("z-index: var(--mfl-z-busy-shield);"), "Interaction shield must consume the busy-shield level.");\n',
  'invariant(!loading.includes("z-index: var(--mfl-z-busy-shield);"), "The retired interaction shield must not consume a global stacking level.");\n',
  "busy shield stacking assertion",
);
await writeFile(zPath, zIndex);

const statsPath = new URL("./validate-stats-animation-owner.mjs", import.meta.url);
let stats = await readFile(statsPath, "utf8");
stats = stats.replace('console.log("Database Stats and MFL Stats keep one fill animation owner, stable histogram DOM, loading-safe animation timelines, and prepared local MFL filter derivation without synthetic loading.");\n', "");
await writeFile(statsPath, stats);

const modalPath = new URL("./validate-modal-entrance-lifecycle.mjs", import.meta.url);
let modal = await readFile(modalPath, "utf8");
modal = modal.replace('console.log("Source-owned modal first-open paint boundary and busy-state transition preservation validation passed.");\n', "");
await writeFile(modalPath, modal);

console.log("Updated umbrella/stacking validators for the retired global busy blocker and removed obsolete validation logs.");
