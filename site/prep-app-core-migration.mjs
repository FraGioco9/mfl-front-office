import { readFile, writeFile } from "node:fs/promises";

const filePath = new URL("./modules/app-core-route-request-normalizer.js", import.meta.url);
let source = await readFile(filePath, "utf8");

const current = [
  "function replaceRequired(source, before, after, label) {",
  "  if (!source.includes(before)) {",
  "    throw new Error(`Could not normalize route request pattern: ${label}.`);",
  "  }",
  "  return source.replace(before, after);",
  "}",
].join("\n");

const migrationShape = [
  "function replaceRequired(source, before, after, label) {",
  "  const text = String(source || \"\");",
  "  if (!text.includes(before)) {",
  "    throw new Error(`Could not normalize route request pattern: ${label}.`);",
  "  }",
  "  return text.replace(before, after);",
  "}",
].join("\n");

if (!source.includes(current)) throw new Error("Route request migration helper source was not found.");
source = source.replace(current, migrationShape);
await writeFile(filePath, source, "utf8");
