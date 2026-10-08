import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Synthetic Chromium only: real Safari touch, wallet settings and post-deploy
// Vercel persistency remain part of issue #1034's single final release gate.
const directory = dirname(fileURLToPath(import.meta.url));
for (const viewport of ["desktop", "phone"]) {
  const code = await new Promise((done, fail) => {
    const child = spawn(process.execPath, [resolve(directory, "browser-routing-regression.mjs")], {
      cwd: resolve(directory, ".."),
      stdio: "inherit",
      env: {
        ...process.env,
        MFL_BROWSER_SCENARIOS: "database-linked-state,database-empty,watchlist-empty",
        MFL_UX04_BROWSER_FOCUSED: "1",
        MFL_UX04_BROWSER_VIEWPORT: viewport,
      },
    });
    child.once("error", fail);
    child.once("close", done);
  });
  assert.equal(code, 0, "Filter state linked/empty filter regression failed on " + viewport);
  console.log("Filter state linked/empty Chromium regression passed on " + viewport);
}
