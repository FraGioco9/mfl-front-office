import assert from "node:assert/strict";
import { auditAccessibility } from "./browser-a11y01-helper.mjs";

export async function auditContrast(cdp, url, baseline) {
  const route = String(process.env.MFL_A11Y03_ROUTE || "");
  const expected = await auditAccessibility(cdp, url, baseline);
  assert.equal(expected?.status, "passed", "A11Y-03 requires a green canonical route audit.");

  const evaluate = async expression => {
    const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error("A11Y-03 Chromium exception: " + JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };

  const reports = [];
  for (const theme of ["light", "dark"]) {
    const report = await evaluate(`(async () => {
      const theme = ${JSON.stringify(theme)};
      document.documentElement.dataset.theme = theme;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise(resolve => setTimeout(resolve, 70));
      const results = await window.axe.run(document, {
        runOnly: { type: "rule", values: ["color-contrast"] },
        iframes: false,
      });
      const sample = violation => ({
        id: violation.id, impact: violation.impact, count: violation.nodes.length,
        nodes: violation.nodes.slice(0, 22).map(node => ({
          target: node.target.join(" > "),
          text: node.html.slice(0, 230),
          data: node.any.map(check => check.data).filter(Boolean),
          summary: node.failureSummary?.slice(0, 500),
        })),
      });
      return {
        theme, activeTheme: document.documentElement.dataset.theme,
        violations: results.violations.map(sample),
        incomplete: results.incomplete.length,
        passed: results.passes.length,
      };
    })()`);
    assert.equal(report.activeTheme, theme, "Theme switch did not settle");
    reports.push(report);
    console.log("A11Y-03 " + route + " " + theme + " " + JSON.stringify(report));
  }
  const failing = reports.flatMap(report => report.violations.map(v => ({
    route, theme: report.theme, ...v,
  })));
  assert.deepEqual(failing, [], "A11Y-03 contrast failures: " + JSON.stringify(failing));
  return baseline;
}
