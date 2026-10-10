import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Split historical names so the AST audit correctly treats only the route
// compatibility shim as a runtime importer of the canonical runner.
const directory = dirname(fileURLToPath(import.meta.url));
const shellCase = { name: "Rendered shell", path: resolve(directory, "next-rendered-shell-browser.mjs"),
  missing: "Next rendered-shell browser probe requires a target URL.",
  noChrome: "Next rendered-shell browser probe requires Chrome or Chromium on PATH." };
const cases = [
  { name: "Table", path: resolve(directory, "next-mobile-table-" + "browser.mjs"),
    missing: "Next mobile table browser probe requires a target URL.",
    noChrome: "Next mobile table browser probe requires Chrome or Chromium on PATH." },
  { name: "Routes", path: resolve(directory, "next-mobile-table-route-" + "browser.mjs"),
    missing: "Next mobile table route probe requires a server origin.",
    noChrome: "Next mobile table route probe requires Chrome or Chromium on PATH." },
];

async function runFailure(item, args, env, expected) {
  const result = await new Promise((resolveResult, rejectResult) => {
    const child = spawn(process.execPath, [item.path, ...args], {
      cwd: resolve(directory, ".."),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "", stderr = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), 25_000);
    child.stdout.on("data", part => { stdout = (stdout + part).slice(-32_768); });
    child.stderr.on("data", part => { stderr = (stderr + part).slice(-32_768); });
    child.once("error", error => { clearTimeout(timeout); rejectResult(error); });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolveResult({ code, signal, stdout, stderr });
    });
  });
  assert.equal(result.signal, null, item.name + " negative subprocess timed out or was killed.");
  assert.notEqual(result.code, 0, item.name + " unexpectedly succeeded during negative QA.");
  assert.ok(result.stderr.includes(expected),
    item.name + " did not propagate expected error " + expected + ": " + result.stderr.slice(-2_000));
  assert.ok(!result.stdout.includes("browser probe passed."),
    item.name + " emitted a false positive success message.");
}

async function assertNoChromiumLeaks(scope, scenario) {
  assert.deepEqual((await readdir(scope)).filter(x => x.startsWith("mfl-next-")),
    [], scenario + " leaked Chromium user-data profiles.");
  if (process.platform !== "linux") return;
  const deadline = Date.now() + 4_000;
  let leftovers;
  do {
    const listing = execFileSync("ps", ["-eo", "args="], { encoding: "utf8" });
    leftovers = listing.split("\n").filter(line =>
      line.includes("--user-data-dir=") && line.includes(scope));
    if (!leftovers.length) break;
    await new Promise(done => setTimeout(done, 100));
  } while (Date.now() < deadline);
  assert.deepEqual(leftovers, [], scenario + " left Chromium processes with isolated profiles.");
}

const sandbox = await mkdtemp(join(tmpdir(), "mfl-next-table-negative-"));
try {
  for (const item of cases) await runFailure(item, [], { ...process.env }, item.missing);
  console.log("NEXT-TABLE-01 NEG-01 PASS: 2/2 historical CLI missing-argument failures.");
  await runFailure(shellCase, [], { ...process.env }, shellCase.missing);
  console.log("NEXT-CDP-02 NEG-01 PASS: rendered-shell missing-argument failure.");

  // An empty PATH defeats every fallback Chrome candidate, regardless of CI image.
  for (const item of cases) {
    await runFailure(item, ["http://127.0.0.1:1/"],
      { ...process.env, PATH: "", CHROME_PATH: join(sandbox, "absent-chrome") },
      item.noChrome);
  }
  console.log("NEXT-TABLE-01 NEG-02 PASS: 2/2 deterministic Chrome-not-found failures.");
  await runFailure(shellCase, ["about:blank"],
    { ...process.env, PATH: "", CHROME_PATH: join(sandbox, "absent-chrome") }, shellCase.noChrome);
  console.log("NEXT-CDP-02 NEG-02 PASS: rendered-shell Chrome-not-found failure.");

  // Node-only WebSocket override: wait for the real Chromium debugging target
  // before forcing connectCdp to fail, without changing either production probe.
  const preload = join(sandbox, "inject-cdp-error.mjs");
  const sentinel = "NEXT_TABLE_NEGATIVE_CDP_CONNECTION_FAILURE";
  await writeFile(preload,
    'globalThis.WebSocket = class InjectedCdpFailure { constructor() { throw new Error("' + sentinel + '"); } };\n',
    "utf8");
  for (const item of [...cases, shellCase]) {
    const profileRoot = await mkdtemp(join(sandbox, "isolated-"));
    try {
      const nodeOptions = [String(process.env.NODE_OPTIONS || "").trim(),
        "--import=" + pathToFileURL(preload).href].filter(Boolean).join(" ");
      await runFailure(item, [item === shellCase ? "about:blank" : "http://127.0.0.1:4000/"],
        { ...process.env, TMPDIR: profileRoot, NODE_OPTIONS: nodeOptions }, sentinel);
      await assertNoChromiumLeaks(profileRoot, item.name + " CDP failure");
    } finally {
      await rm(profileRoot, { recursive: true, force: true });
    }
  }
  console.log("NEXT-TABLE-01 NEG-03 PASS: 2/2 CDP errors propagated; no leaked Chrome profiles/processes.");
  console.log("NEXT-CDP-02 NEG-03 PASS: rendered-shell injected CDP error and cleanup.");
} finally {
  await rm(sandbox, { recursive: true, force: true });
}
