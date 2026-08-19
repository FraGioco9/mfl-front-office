import { readFile, writeFile } from "node:fs/promises";

const validationPath = new URL("./validate.mjs", import.meta.url);
let source = await readFile(validationPath, "utf8");

function replaceRequired(before, after, label) {
  if (!source.includes(before)) throw new Error(`Validation migration pattern missing: ${label}`);
  source = source.replace(before, after);
}

replaceRequired(
  'includes(tableWidth, "canonical: true", "Table widths must remain globally single-owned.");',
  [
    'includes(tableWidth, "window.__mflUniformWidth = Object.freeze", "Table widths must expose one immutable ownership marker.");',
    'includes(tableWidth, \'source: "styles.css"\', "Static CSS must remain the canonical table-width geometry owner.");',
  ].join("\n"),
  "Uniform Width ownership",
);

await writeFile(validationPath, source, "utf8");
