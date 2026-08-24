import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./migrate-retire-global-operation-busy.mjs", import.meta.url);
let source = await readFile(path, "utf8");
source = source.replace(
  '  excludes(bootstrapCore, retiredBusyOwner, `Global operation-busy ownership must stay removed through ${retiredBusyOwner}.`);',
  '  excludes(bootstrapCore, retiredBusyOwner, "Global operation-busy ownership must stay removed through " + retiredBusyOwner + ".");',
);
source = source.replace(
  '  includes(appCoreSource, localMutationOwner, `Persistent mutations must retain local working-state ownership through ${localMutationOwner}`);',
  '  includes(appCoreSource, localMutationOwner, "Persistent mutations must retain local working-state ownership through " + localMutationOwner);',
);
source = source.replace('  ["bootstrap-core.js", bootstrapCore],\n', "");
source = source.replace(
  'console.log("Retired global operation busy blocking while preserving route/data loading and local mutation feedback.");',
  'if (bootstrapCore.includes(\'const BUSY_CLASS = "mflInteractionBusy";\') || bootstrapCore.includes("OPERATION_BUSY_REASONS") || bootstrapCore.includes("bindInteractionBlockers")) {\n  throw new Error("bootstrap-core.js still contains retired global operation-busy machinery.");\n}\n\nconsole.log("Retired global operation busy blocking while preserving route/data loading and local mutation feedback.");',
);
await writeFile(path, source);
console.log("Fixed operation-busy migration syntax and narrowed compatibility verification.");
