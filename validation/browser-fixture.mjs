import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const directory = fileURLToPath(new URL("./", import.meta.url));
const sourcePath = fileURLToPath(new URL("./browser-routing-regression.mjs", import.meta.url));
export const readBrowserSource = () => readFile(sourcePath, "utf8");
export function replaceBrowserScenarios(source, scenarios, message) {
  const pattern = /const regressionScenarios = Object\.freeze\(\[[\s\S]*?\n\]\);\n\nconst server =/u;
  assert.match(source, pattern, message);
  return source.replace(pattern, scenarios);
}
export async function withBrowserFixture(source, temporary, callback) {
  const path = resolve(directory, temporary);
  await writeFile(path, source, "utf8");
  try { return await callback(path); } finally { await rm(path, { force: true }); }
}
export async function runBrowserFixture(path, failure, env) {
  const status = await new Promise((done, fail) => {
    const child = spawn(process.execPath, [path], {
      cwd: resolve(directory, ".."), stdio: "inherit", ...(env ? { env } : {}),
    });
    child.once("error", fail);
    child.once("close", done);
  });
  assert.equal(status, 0, failure);
}
