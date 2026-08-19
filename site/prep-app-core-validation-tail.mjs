import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./validate-bootstrap-ownership.mjs", import.meta.url);
let source = await readFile(path, "utf8");

const oldRead = [
  "const [bootstrap, bootstrapCore, controlInteractions, appCoreBuildNormalizer] = await Promise.all([",
  '  read("./bootstrap.js"),',
  '  read("./bootstrap-core.js"),',
  '  read("./control-interactions-runtime.js"),',
  '  read("./modules/app-core-build-normalizer.js"),',
  "]);",
].join("\n");
const newRead = [
  "const [bootstrap, bootstrapCore, controlInteractions, appCoreSource] = await Promise.all([",
  '  read("./bootstrap.js"),',
  '  read("./bootstrap-core.js"),',
  '  read("./control-interactions-runtime.js"),',
  '  read("./modules/app-core.js"),',
  "]);",
].join("\n");
if (!source.includes(oldRead)) throw new Error("Bootstrap validator build-normalizer read was not found.");
source = source.replace(oldRead, newRead);

const transitionBlock = [
  "includes(",
  "  appCoreBuildNormalizer,",
  '  \'navigation.begin("page-transition")\',',
  '  "Generated page transitions must acquire the shared navigation lifecycle.",',
  ");",
  "includes(",
  "  appCoreBuildNormalizer,",
  '  \'navigation.begin("view-transition")\',',
  '  "Generated view transitions must acquire the shared navigation lifecycle.",',
  ");",
  "includes(",
  "  appCoreBuildNormalizer,",
  '  "return typeof loader === \\\"function\\\" ? await loader(transition) : transition;",',
  '  "Page transition navigation state must remain active until its owned loader settles.",',
  ");",
  "includes(",
  "  appCoreBuildNormalizer,",
  '  "if (navigationToken) navigation?.end?.(navigationToken);",',
  '  "Generated transitions must release shared navigation state in finally blocks.",',
  ");",
].join("\n");
const canonicalBlock = transitionBlock.replaceAll("appCoreBuildNormalizer", "appCoreSource");
if (!source.includes(transitionBlock)) throw new Error("Bootstrap validator generated-transition ownership block was not found.");
source = source.replace(transitionBlock, canonicalBlock);

await writeFile(path, source, "utf8");
