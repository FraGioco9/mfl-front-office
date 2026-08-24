import { readFile, writeFile } from "node:fs/promises";

const responsivePath = new URL("./responsive.css", import.meta.url);
let source = await readFile(responsivePath, "utf8");
const before = "\n    .selectionBar {\n    width: min(520px, calc(100vw - 24px - env(safe-area-inset-left) - env(safe-area-inset-right)));";
const after = "\n  .selectionBar {\n    width: min(520px, calc(100vw - 24px - env(safe-area-inset-left) - env(safe-area-inset-right)));";
if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error("Could not find the shifted mobile selection-bar rule.");
  source = source.replace(before, after);
  await writeFile(responsivePath, source);
}
console.log("Cleaned responsive source after Loading-toast removal.");
