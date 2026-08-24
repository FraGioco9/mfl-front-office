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
await writeFile(path, source);
console.log("Fixed nested template literals in the operation-busy migration helper.");
