import { createStyleBundle } from "./style-bundle.mjs";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [runtimeStyles, index, packageJson, vercelIgnore] = await Promise.all([
  read("./styles-runtime.css"),
  read("./index.html"),
  read("./package.json"),
  read("../.vercelignore"),
]);
const expected = await createStyleBundle((name) => read(`./${name}`));

invariant(runtimeStyles === expected, "styles-runtime.css must exactly match the recursively flattened canonical CSS source graph.");
invariant(!/@import\s/i.test(runtimeStyles), "Production styles-runtime.css must contain zero @import rules and require no nested stylesheet requests.");
invariant(
  index.includes('<link rel="stylesheet" href="/styles-runtime.css">')
    && !index.includes('<link rel="stylesheet" href="/styles.css">'),
  "Production HTML must serve the bundled primary stylesheet instead of the @import source entrypoint.",
);
invariant(
  packageJson.includes('"build:styles": "node build-styles.mjs"')
    && packageJson.includes('"build": "npm run build:config && npm run build:core && npm run build:styles"')
    && packageJson.includes("styles-runtime.css table-width-runtime.js"),
  "The normal build and generated verification paths must own styles-runtime.css.",
);
invariant(
  vercelIgnore.includes("site/build-styles.mjs") && vercelIgnore.includes("site/style-bundle.mjs"),
  "The stylesheet compiler and recursive bundling helper must remain build-only in the Vercel artifact.",
);

console.log("Generated production stylesheet validation passed with a fully flattened CSS dependency graph.");
