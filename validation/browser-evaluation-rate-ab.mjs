import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const original = await readFile(resolve(here, "browser-routing-regression.mjs"), "utf8");
const temporary = resolve(here, ".browser-evaluation-rate-ab.tmp.mjs");
const modeNames = ["baseline", "sync-on-route"];

function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length - 1, 1, "Evaluation A/B canonical anchor changed: " + before.slice(0, 110));
  return source.replace(before, after);
}

function forMode(mode) {
  let result = original;
  const header = '  async function navigateBackToScenario(setPage, timeline) {';
  result = replaceOnce(result, header,
    '  let __test04BEvalRateProbe = null;\n' + header);
  const navigation = '      const evaluationNavigation = setPage("evaluation", true, { plain: true });';
  result = replaceOnce(result, navigation, [
    '      const __test04bStart = performance.now();',
    '      let __test04bEvents = 0;',
    '      const __test04bEvent = () => { __test04bEvents += 1; };',
    '      window.addEventListener("mfl:evaluation-rate-settled", __test04bEvent);',
    '      let __test04bCancelled = false;',
    '      const __test04bSyncOnCommit = () => {',
    '        if (__test04bCancelled) return;',
    '        if (location.pathname === "/evaluation" && document.body.dataset.page === "evaluation") {',
    '          window.__mflEvaluationDiscountRateRuntime?.sync?.();',
    '        } else {',
    '          setTimeout(__test04bSyncOnCommit, 10);',
    '        }',
    '      };',
    '      if (' + JSON.stringify(mode) + ' === "sync-on-route") setTimeout(__test04bSyncOnCommit, 10);',
    navigation,
  ].join("\n"));
  const afterNavigation =
    '      await evaluationNavigation;\n      window.__mflEnsureRouteCore = originalEnsureRouteCore;';
  result = replaceOnce(result, afterNavigation, [
    '      await evaluationNavigation;',
    '      __test04bCancelled = true;',
    '      window.removeEventListener("mfl:evaluation-rate-settled", __test04bEvent);',
    '      __test04BEvalRateProbe = {',
    '        mode: ' + JSON.stringify(mode) + ',',
    '        durationMs: Math.round(performance.now() - __test04bStart),',
    '        eventCount: __test04bEvents,',
    '        rateSettled: document.documentElement.dataset.mflEvaluationRateSettled === "true",',
    '        rateSource: document.documentElement.dataset.mflDiscountRateSource || "",',
    '      };',
    '      assert(__test04BEvalRateProbe.eventCount === (' + JSON.stringify(mode) + ' === "baseline" ? 0 : 1),',
    '        "Evaluation rate event count deviates from A/B expectation: " + JSON.stringify(__test04BEvalRateProbe));',
    '      if (' + JSON.stringify(mode) + ' === "baseline") {',
    '        assert(__test04BEvalRateProbe.durationMs >= 14_000 && !__test04BEvalRateProbe.rateSettled,',
    '          "Unchanged Player SPA route did not reproduce readiness timeout: " + JSON.stringify(__test04BEvalRateProbe));',
    '      } else {',
    '        assert(__test04BEvalRateProbe.durationMs < 5_000 && __test04BEvalRateProbe.rateSettled,',
    '          "Real Discount Rate runtime did not settle from route sync: " + JSON.stringify(__test04BEvalRateProbe));',
    '      }',
    '      window.__mflEnsureRouteCore = originalEnsureRouteCore;',
  ].join("\n"));
  const finish =
    '    finish("passed", scenario + ": direct refresh and SPA navigation converged with canonical timing and no runtime errors.");';
  result = replaceOnce(result, finish,
    '    finish("passed", scenario + ": direct refresh and SPA navigation converged with canonical timing and no runtime errors. TEST04B_EVAL_AB=" + JSON.stringify(__test04BEvalRateProbe));');
  return result;
}

function runFixture(mode) {
  return new Promise((resolveRun, rejectRun) => {
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
      if (code !== 0) return rejectRun(new Error("TEST-04B A/B " + mode + " failed (exit " + code + ")\n" + output.slice(-14_000)));
      const marker = output.split("\n").find(line => line.includes("TEST04B_EVAL_AB="));
      assert(marker, "A/B " + mode + " did not emit a browser measurement:\n" + output.slice(-6_000));
      const parsed = JSON.parse(marker.slice(marker.indexOf("TEST04B_EVAL_AB=") + "TEST04B_EVAL_AB=".length));
      resolveRun(parsed);
    });
  });
}

try {
  const results = [];
  for (const mode of modeNames) {
    await writeFile(temporary, forMode(mode), "utf8");
    const result = await runFixture(mode);
    results.push(result);
    console.log("TEST04B_AB_RESULT " + JSON.stringify(result));
  }
  assert.equal(results[0].mode, "baseline");
  assert.equal(results[1].mode, "sync-on-route");
  assert(results[0].durationMs - results[1].durationMs > 10_000,
    "A/B did not demonstrate a >10s route readiness difference on the same CI runner.");
  console.log("TEST04B_AB_PASS " + JSON.stringify({ savedMs: results[0].durationMs - results[1].durationMs }));
} finally {
  await rm(temporary, { force: true });
}
