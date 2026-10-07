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
      await new Promise(resolve => setTimeout(resolve, 550));
      const results = await window.axe.run(document, {
        runOnly: { type: "rule", values: ["color-contrast"] },
        iframes: false,
      });
      const legacyDivisionSelectors = [
        ".playerContractDivision",
        ".contractDivisionLabel",
        ".clubSearchDivision",
        ".clubPageTitleDivision",
        ".myClubDivision",
        "#clubIdentityDivision",
        "#plannerTeamDivision",
      ];
      const isLegacyDivisionNode = node => node.target.some(part =>
        legacyDivisionSelectors.some(selector => String(part).includes(selector))
      );
      const rgbToHex = value => {
        const parts = String(value || "").match(/\\d+/g);
        if (!parts || parts.length < 3) return "";
        return "#" + parts.slice(0, 3).map(part => Number(part).toString(16).padStart(2, "0")).join("");
      };
      const probe = document.createElement("span");
      probe.style.position = "fixed";
      probe.style.pointerEvents = "none";
      probe.style.backgroundColor = "var(--primary)";
      document.body.appendChild(probe);
      const primaryBackground = getComputedStyle(probe).backgroundColor;
      const primaryHex = rgbToHex(primaryBackground);
      probe.remove();
      const filledPrimaryTextMismatches = Array.from(document.querySelectorAll("button, a"))
        .filter(element => {
          const style = getComputedStyle(element);
          return style.backgroundColor === primaryBackground && style.color !== "rgb(255, 255, 255)";
        })
        .map(element => ({
          selector: element.id ? "#" + element.id : String(element.className || element.tagName),
          background: getComputedStyle(element).backgroundColor,
          color: getComputedStyle(element).color,
        }));
      const approvedPrimaryControlSelectors = [
        "#sidebar .navButton.active",
        ".viewButton.active",
        ".filtersViewButton.active",
        ".mflStatsFilterButton.active",
        ".mflStatsDistributionModeButton.active",
        ".playerAttributeViewButton.active",
        ".settingsToggleButton.active",
        ".settingsEmailActionButton.primary",
        ".playerEvaluateButton",
        ".playerExternalButton",
      ];
      const approvedPrimaryControlSelector = approvedPrimaryControlSelectors.join(",");
      const isApprovedDarkPrimaryControlNode = node => {
        if (theme !== "dark") return false;
        const targetSelector = node.target.map(part => String(part)).join(" ");
        let target = null;
        try {
          target = document.querySelector(targetSelector);
        } catch {
          return false;
        }
        const control = target?.closest?.(approvedPrimaryControlSelector);
        if (!(control instanceof HTMLElement)) return false;
        const controlStyle = getComputedStyle(control);
        if (controlStyle.backgroundColor !== primaryBackground || controlStyle.color !== "rgb(255, 255, 255)") return false;
        return node.any.some(check => {
          const data = check.data || {};
          return String(data.fgColor || "").toLowerCase() === "#ffffff"
            && String(data.bgColor || "").toLowerCase() === primaryHex;
        });
      };
      const filteredViolations = results.violations
        .map(violation => ({
          ...violation,
          nodes: violation.nodes.filter(node => !isLegacyDivisionNode(node) && !isApprovedDarkPrimaryControlNode(node)),
        }))
        .filter(violation => violation.nodes.length > 0);
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
        violations: filteredViolations.map(sample),
        filledPrimaryTextMismatches,
        incomplete: results.incomplete.length,
        passed: results.passes.length,
      };
    })()`);
    assert.equal(report.activeTheme, theme, "Theme switch did not settle");
    assert.deepEqual(
      report.filledPrimaryTextMismatches,
      [],
      "Primary-filled buttons must keep white text in " + theme + " theme: " + JSON.stringify(report.filledPrimaryTextMismatches),
    );
    reports.push(report);
    console.log("A11Y-03 " + route + " " + theme + " " + JSON.stringify(report));
  }
  const failing = reports.flatMap(report => report.violations.map(v => ({
    route, theme: report.theme, ...v,
  })));
  assert.deepEqual(failing, [], "A11Y-03 contrast failures: " + JSON.stringify(failing));
  return baseline;
}
