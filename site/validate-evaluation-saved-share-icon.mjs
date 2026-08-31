import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const siteRoot = dirname(fileURLToPath(import.meta.url));
const canonicalCore = await Promise.all([
    readFile(join(siteRoot, "modules/core-sources/shared.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/evaluation.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/mfl-stats.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/club.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/settings.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/player.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/table.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/wallet.js"), "utf8"),
    readFile(join(siteRoot, "modules/core-sources/watchlist.js"), "utf8"),
  ]).then((parts) => parts.join("\n"));
const generatedEvaluation = await readFile(join(siteRoot, "modules/app-core-evaluation-runtime.js"), "utf8");
const baseStyles = await readFile(join(siteRoot, "styles-base.css"), "utf8");

const centeredShareSvg = 'shareButton.innerHTML = \'<svg viewBox="1.8 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.6 10.8 15.4 6.2"></path><path d="M8.6 13.2 15.4 17.8"></path></svg>\';';

for (const [label, source] of [["canonical Evaluation core", canonicalCore], ["generated Evaluation runtime", generatedEvaluation]]) {
  invariant(
    source.includes(centeredShareSvg),
    `${label} must optically center the saved-Evaluation share glyph at its SVG source.`,
  );
  invariant(
    !source.includes('shareButton.innerHTML = \'<svg viewBox="0 0 24 24"'),
    `${label} must not retain the right-heavy unadjusted share-glyph viewBox.`,
  );
}

const iconRuleStart = baseStyles.indexOf(".evaluationLoadIconButton {");
const iconRuleEnd = baseStyles.indexOf("}\n", iconRuleStart);
const iconRule = iconRuleStart >= 0 ? baseStyles.slice(iconRuleStart, iconRuleEnd + 2) : "";
invariant(iconRule.includes("display: inline-grid;"), "Saved-Evaluation action buttons must retain grid centering.");
invariant(iconRule.includes("place-items: center;"), "Saved-Evaluation action buttons must retain centered box alignment.");
invariant(
  !baseStyles.includes(".evaluationLoadShareButton svg"),
  "Saved-Evaluation share centering must stay in the SVG source rather than a CSS compensation override.",
);

console.log("Saved Evaluation share icon validation passed: the 28px action box remains centered and the right-heavy share glyph is optically centered at its SVG source.");
