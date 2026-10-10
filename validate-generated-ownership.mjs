import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = path => readValidationText(path, import.meta.url);
const [pkg, fragmentWriter, buildStyles, buildCore, prepare, legacyAssets, gitignore, docs] = await Promise.all([
  read("./package.json"),
  read("./build-fragments.mjs"),
  read("./build-styles.mjs"),
  read("./build-app-core.mjs"),
  read("./prepare-next-runtime.mjs"),
  read("./legacy-public-assets.cjs"),
  read("./.gitignore"),
  read("./docs/generated-ownership.md"),
]);

invariant(
  fragmentWriter.includes("export async function writeHtml()")
    && fragmentWriter.includes('new URL("./index.html", import.meta.url)')
    && fragmentWriter.includes('new URL("./html-sources/", import.meta.url)'),
  "HTML must retain the canonical fragment writer and index.html output.",
);
invariant(
  fragmentWriter.includes("export async function writeResponsive()")
    && fragmentWriter.includes('new URL("./responsive.css", import.meta.url)')
    && fragmentWriter.includes('new URL("./responsive-sources/", import.meta.url)')
    && fragmentWriter.includes("if (invokedPath === import.meta.url)"),
  "Responsive must retain the canonical writer, output and side-effect-free import guard.",
);
invariant(
  buildStyles.includes('import { writeResponsive } from "./build-fragments.mjs";')
    && buildStyles.includes("await writeResponsive();")
    && buildStyles.indexOf("await writeResponsive();") < buildStyles.indexOf("createStyleBundle(read)"),
  "CSS must await the responsive writer before bundling.",
);
invariant(buildStyles.includes('writeFile(new URL("./styles-runtime.css"'), "styles-runtime.css must retain build-styles ownership.");
invariant(buildCore.includes("for (const entry of coreSourceManifest)") && buildCore.includes("writeFileIfChanged(runtimePath"), "app-core runtimes must remain manifest-generated.");

const packageJson = JSON.parse(pkg);
invariant(
  packageJson.scripts?.["verify:generated"]?.includes("styles-runtime.css")
    && packageJson.scripts?.["verify:generated"]?.includes("index.html")
    && packageJson.scripts?.["verify:generated"]?.includes("responsive.css")
    && packageJson.scripts?.["verify:generated"]?.includes("modules/app-core*-runtime.js"),
  "Generated artifacts must remain guarded by verify:generated.",
);

invariant(
  gitignore.split(/\r?\n/).includes("public/")
    && prepare.includes("listLegacyPublicAssetPaths(root)")
    && legacyAssets.includes('name.endsWith("-runtime.js")')
    && legacyAssets.includes('join("modules", entry.name)'),
  "Next public compatibility output must remain untracked and projected from canonical/generated owners.",
);

for (const required of ["index.html", "responsive.css", "styles-runtime.css", "app-core*-runtime.js"]) {
  invariant(docs.includes(required), `ARCH-06 map must document generated artifact: ${required}.`);
}
invariant(
  docs.includes("Removal gate")
    && docs.includes("NO CHANGE / no deletion"),
  "ARCH-06 must keep generated compatibility artifacts until every removal gate is satisfied.",
);

console.log("ARCH-06 generated ownership graph and removal-gate validation passed.");
