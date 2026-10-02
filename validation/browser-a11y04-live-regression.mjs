import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const folder = dirname(fileURLToPath(import.meta.url));
const source = await readFile(resolve(folder, "browser-routing-regression.mjs"), "utf8");
const temporary = resolve(folder, ".browser-a11y04.tmp.mjs");
const marker = '    await cdp.send("Runtime.enable");\n    return await waitForBrowserRegression(cdp);\n';
assert.ok(source.includes(marker), "A11Y-04 requires the canonical Chromium routing regression hook.");
const injected = source.replace(marker, `    await cdp.send("Runtime.enable");
    const baseline = await waitForBrowserRegression(cdp);
    return await (await import("./browser-a11y04-live-helper.mjs")).auditLiveAnnouncements(cdp, url, baseline);
`);

try {
  for (const scenario of ["database", "planner"]) {
    await writeFile(temporary, injected, "utf8");
    const code = await new Promise((done, reject) => {
      const child = spawn(process.execPath, [temporary], {
        cwd: resolve(folder, ".."), stdio: "inherit",
        env: {
          ...process.env,
          MFL_BROWSER_SCENARIOS: scenario,
          MFL_PLANNER_BROWSER_FOCUSED: scenario === "planner" ? "1" : "0",
          MFL_PLANNER_BROWSER_PHASE: "shell",
        },
      });
      child.once("error", reject);
      child.once("close", done);
    });
    assert.equal(code, 0, "A11Y-04 failed hydrated browser scenario: " + scenario);
  }
} finally {
  await rm(temporary, {force:true});
}
console.log("A11Y-04 browser live-announcement matrix passed.");
