import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const original = await readFile(resolve(here, "browser-routing-regression.mjs"), "utf8");
const temporary = resolve(here, ".browser-evaluation-rate-route-commit.tmp.mjs");

function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length - 1, 1,
    "Evaluation route readiness regression anchor drifted: " + before.slice(0, 110));
  return source.replace(before, after);
}

let instrumented = replaceOnce(original,
  '  async function navigateBackToScenario(setPage, timeline) {',
  '  let __evalRouteCommitProbe = null;\n  async function navigateBackToScenario(setPage, timeline) {');

const navigation = '      const evaluationNavigation = setPage("evaluation", true, { plain: true });';
instrumented = replaceOnce(instrumented, navigation, [
  '      const __rateStart = performance.now();',
  '      let __rateEvents = 0;',
  '      const __onRateEvent = () => { __rateEvents += 1; };',
  '      window.addEventListener("mfl:evaluation-rate-settled", __onRateEvent);',
  navigation,
].join("\n"));

const afterNavigation = '      await evaluationNavigation;\n      window.__mflEnsureRouteCore = originalEnsureRouteCore;';
instrumented = replaceOnce(instrumented, afterNavigation, [
  '      await evaluationNavigation;',
  '      window.removeEventListener("mfl:evaluation-rate-settled", __onRateEvent);',
  '      __evalRouteCommitProbe = {',
  '        durationMs: Math.round(performance.now() - __rateStart),',
  '        eventCount: __rateEvents,',
  '        rateSettled: document.documentElement.dataset.mflEvaluationRateSettled === "true",',
  '        rateSource: document.documentElement.dataset.mflDiscountRateSource || "",',
  '      };',
  '      assert(__evalRouteCommitProbe.eventCount === 1,',
  '        "Player SPA navigation must receive exactly one REAL rate-ready event: " + JSON.stringify(__evalRouteCommitProbe));',
  '      assert(__evalRouteCommitProbe.rateSettled && __evalRouteCommitProbe.rateSource === "supabase-live-request",',
  '        "Evaluation must resolve the rate from real runtime/data-client without fabricated ready events: " + JSON.stringify(__evalRouteCommitProbe));',
  '      assert(__evalRouteCommitProbe.durationMs < 5_000,',
  '        "Evaluation SPA readiness fell back to the 15s timeout: " + JSON.stringify(__evalRouteCommitProbe));',
  '      window.__mflEnsureRouteCore = originalEnsureRouteCore;',
].join("\n"));

const finish = '    finish("passed", scenario + ": direct refresh and SPA navigation converged with canonical timing and no runtime errors.");';
instrumented = replaceOnce(instrumented, finish,
  '    finish("passed", scenario + ": direct refresh and SPA navigation converged with canonical timing and no runtime errors. TEST04B_EVAL_COMMIT=" + JSON.stringify(__evalRouteCommitProbe));');

await writeFile(temporary, instrumented, "utf8");
try {
  const result = await new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [temporary], {
      cwd: resolve(here, ".."),
      env: { ...process.env, MFL_BROWSER_SCENARIOS: "player" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", part => { output += String(part); });
    child.stderr.on("data", part => { output += String(part); });
    child.once("error", rejectRun);
    child.once("close", code => {
      if (code !== 0) return rejectRun(new Error("Evaluation SPA readiness regression failed (exit " + code + ")\n" + output.slice(-14_000)));
      const line = output.split("\n").find(entry => entry.includes("TEST04B_EVAL_COMMIT="));
      assert(line, "No Evaluation readiness measurement received:\n" + output.slice(-6_000));
      resolveRun(JSON.parse(line.slice(line.indexOf("TEST04B_EVAL_COMMIT=") + "TEST04B_EVAL_COMMIT=".length)));
    });
  });
  assert(result.eventCount === 1 && result.rateSettled && result.durationMs < 5_000);
  console.log("TEST04B_EVAL_COMMIT_PASS " + JSON.stringify(result));
} finally {
  await rm(temporary, { force: true });
}
