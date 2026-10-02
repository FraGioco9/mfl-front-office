import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Real Chromium, synthetic wallet fixture only. This does not replace final
// Safari/iPhone touch, real Dapper wallet or deployed-production smoke tests.
const currentDir = dirname(fileURLToPath(import.meta.url));
for (const viewport of ["desktop", "phone"]) {
  const status = await new Promise((resolveStatus, rejectStatus) => {
    const child = spawn(process.execPath, [resolve(currentDir, "browser-routing-regression.mjs")], {
      cwd: resolve(currentDir, ".."),
      stdio: "inherit",
      env: {
        ...process.env,
        MFL_BROWSER_SCENARIOS: "planner",
        MFL_UX03_BROWSER_FOCUSED: "1",
        MFL_UX03_BROWSER_VIEWPORT: viewport,
      },
    });
    child.once("error", rejectStatus);
    child.once("close", resolveStatus);
  });
  assert.equal(status, 0, "UX-03 Saved Plans browser matrix failed on " + viewport);
  console.log("UX-03 Chromium Saved Plans regression passed on " + viewport);
}
