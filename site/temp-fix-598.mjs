import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(siteRoot, "..");
const branch = "fix/598-mobile-evaluation-popups";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`Missing ${label} anchor.`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`Ambiguous ${label} anchor.`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

const responsivePath = resolve(siteRoot, "responsive.css");
const validatorPath = resolve(siteRoot, "validate-evaluation-mobile-first-paint.mjs");
const packagePath = resolve(siteRoot, "package.json");

let responsive = readFileSync(responsivePath, "utf8");
let validator = readFileSync(validatorPath, "utf8");

const existingPhoneModal = `  #evaluationLoadModal {
    padding: 8px;
  }

  #evaluationLoadModal .evaluationLoadDialog {
    width: min(100%, 420px);
    max-width: 420px;
    height: min(420px, calc(100dvh - 16px));
    border-radius: 8px;
  }

  #evaluationLoadModal .filtersHeader {
    min-height: 42px;
    padding: 7px 9px;
  }

  #evaluationLoadModal .filtersHeader h2 {
    font-size: 15px;
  }`;

const sharedPhoneModal = `  #advancedSettingsModal,
  #evaluationLoadModal {
    padding:
      max(8px, env(safe-area-inset-top))
      max(8px, env(safe-area-inset-right))
      max(8px, env(safe-area-inset-bottom))
      max(8px, env(safe-area-inset-left));
  }

  #advancedSettingsModal .advancedSettingsDialog,
  #evaluationLoadModal .evaluationLoadDialog {
    width: min(100%, 420px);
    max-width: 420px;
    max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    border-radius: 8px;
  }

  #evaluationLoadModal .evaluationLoadDialog {
    height: min(420px, calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));
  }

  #advancedSettingsModal .filtersHeader,
  #evaluationLoadModal .filtersHeader {
    min-height: 42px;
    padding: 7px 9px;
  }

  #advancedSettingsModal .filtersHeader h2,
  #evaluationLoadModal .filtersHeader h2 {
    font-size: 15px;
  }

  #advancedSettingsModal .advancedSettingsBody {
    gap: 8px;
    padding: 8px 10px 10px;
  }

  #advancedSettingsModal .advancedSettingsSection {
    gap: 6px;
  }

  #advancedSettingsModal .advancedSettingsSection h3 {
    font-size: 13px;
  }

  #advancedSettingsModal .advancedSettingHeader,
  #advancedSettingsModal .advancedLateSeasonRewardSetting {
    align-items: center;
    flex-direction: row;
    gap: 8px;
  }

  #advancedSettingsModal .advancedSettingHeader {
    min-height: 36px;
  }

  #advancedSettingsModal .advancedSettingHeaderControl,
  #advancedSettingsModal .advancedRewardRateControlGroup {
    justify-content: flex-end;
    width: auto;
    margin-left: auto;
    gap: 6px;
  }

  #advancedSettingsModal .advancedMflUsdResetButton,
  #advancedSettingsModal .advancedRewardRateResetButton {
    height: 32px;
    min-height: 32px;
  }

  #advancedSettingsModal .advancedMflUsdControl {
    grid-template-columns: 20px 92px;
    gap: 4px;
  }

  #advancedSettingsModal .advancedMflUsdInput {
    height: 36px;
    padding: 3px 8px;
  }

  #advancedSettingsModal .advancedMflUsdStepper button,
  #advancedSettingsModal .advancedRewardRateStepper button {
    width: 20px;
    height: 17px;
    min-height: 17px;
  }

  #advancedSettingsModal .advancedSettingValue {
    width: 92px;
    min-width: 92px;
    padding: 3px 8px;
    font-size: 13px;
  }

  #advancedSettingsModal .advancedLateSeasonRewardsGrid {
    gap: 4px;
  }

  #advancedSettingsModal .advancedLateSeasonRewardSetting {
    min-height: 36px;
  }

  #advancedSettingsModal .advancedPercentControl {
    grid-template-columns: 20px 74px auto;
    gap: 4px;
  }

  #advancedSettingsModal .advancedRewardRateInput {
    height: 36px;
    padding: 3px 7px;
  }

  #advancedSettingsModal .advancedSettingsFooter {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    padding: 6px 8px;
  }

  #advancedSettingsModal .advancedSettingsFooter button {
    width: 100%;
    min-width: 0;
    height: 36px;
    min-height: 36px;
  }`;

responsive = replaceOnce(responsive, existingPhoneModal, sharedPhoneModal, "small-phone Evaluation popup");

const tinyLoadResult = `  #evaluationLoadModal .evaluationLoadResult {
    grid-template-columns: minmax(0, 1fr) 64px auto;
    gap: 4px;
    padding-inline: 6px;
  }`;

const tinySharedPopups = `  #advancedSettingsModal,
  #evaluationLoadModal {
    padding:
      max(6px, env(safe-area-inset-top))
      max(6px, env(safe-area-inset-right))
      max(6px, env(safe-area-inset-bottom))
      max(6px, env(safe-area-inset-left));
  }

  #advancedSettingsModal .advancedSettingsDialog,
  #evaluationLoadModal .evaluationLoadDialog {
    max-height: calc(100dvh - 12px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  }

  #evaluationLoadModal .evaluationLoadDialog {
    height: min(390px, calc(100dvh - 12px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));
  }

  #advancedSettingsModal .filtersHeader,
  #evaluationLoadModal .filtersHeader {
    min-height: 40px;
    padding: 6px 8px;
  }

  #advancedSettingsModal .filtersHeader h2,
  #evaluationLoadModal .filtersHeader h2 {
    font-size: 14px;
  }

  #advancedSettingsModal .advancedSettingsBody {
    gap: 6px;
    padding: 6px 8px 8px;
  }

  #advancedSettingsModal .advancedSettingsSection {
    gap: 5px;
  }

  #advancedSettingsModal .advancedSettingsSection h3 {
    font-size: 12px;
  }

  #advancedSettingsModal .advancedSettingHeader,
  #advancedSettingsModal .advancedLateSeasonRewardSetting {
    gap: 6px;
  }

  #advancedSettingsModal .advancedMflUsdControl {
    grid-template-columns: 20px 82px;
    gap: 3px;
  }

  #advancedSettingsModal .advancedSettingValue {
    width: 82px;
    min-width: 82px;
    font-size: 12px;
  }

  #advancedSettingsModal .advancedPercentControl {
    grid-template-columns: 20px 66px auto;
    gap: 3px;
  }

  #advancedSettingsModal .advancedSettingsFooter {
    gap: 4px;
    padding: 5px 6px;
  }

  #evaluationLoadModal .evaluationLoadList {
    grid-auto-rows: 48px;
    padding: 5px 6px 8px;
  }

  #evaluationLoadModal .evaluationLoadResult {
    grid-template-columns: minmax(0, 1fr) 64px auto;
    gap: 4px;
    min-height: 48px;
    padding-inline: 6px;
  }`;

responsive = replaceOnce(responsive, tinyLoadResult, tinySharedPopups, "tiny-phone Evaluation popup");

const oldLoadInvariant = `invariant(
  responsive.includes("#evaluationLoadModal .evaluationLoadDialog {\\n    width: min(100%, 420px);\\n    max-width: 420px;\\n    height: min(420px, calc(100dvh - 16px));")
    && responsive.includes("#evaluationLoadModal .evaluationLoadResult {\\n    grid-template-columns: minmax(0, 1fr) 72px auto;\\n    gap: 6px;\\n    min-height: 52px;"),
  "Load Evaluation must use compact small-phone modal and result-row geometry.",
);
invariant(
  responsive.includes("#evaluationLoadModal .evaluationLoadResult {\\n    grid-template-columns: minmax(0, 1fr) 64px auto;\\n    gap: 4px;\\n    padding-inline: 6px;\\n  }"),
  "Load Evaluation results must stay compact instead of stacking at very narrow phone widths.",
);`;

const newPopupInvariant = `invariant(
  responsive.includes("#advancedSettingsModal,\\n  #evaluationLoadModal {\\n    padding:\\n      max(8px, env(safe-area-inset-top))")
    && responsive.includes("#advancedSettingsModal .advancedSettingsDialog,\\n  #evaluationLoadModal .evaluationLoadDialog {\\n    width: min(100%, 420px);\\n    max-width: 420px;\\n    max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));")
    && responsive.includes("#evaluationLoadModal .evaluationLoadDialog {\\n    height: min(420px, calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));\\n  }")
    && responsive.includes("#evaluationLoadModal .evaluationLoadResult {\\n    grid-template-columns: minmax(0, 1fr) 72px auto;\\n    gap: 6px;\\n    min-height: 52px;"),
  "Load Evaluation and Advanced Settings must share one safe-area-aware small-phone modal frame while Load Evaluation keeps compact result rows.",
);
invariant(
  responsive.includes("#advancedSettingsModal .advancedSettingHeader,\\n  #advancedSettingsModal .advancedLateSeasonRewardSetting {\\n    align-items: center;\\n    flex-direction: row;\\n    gap: 8px;")
    && responsive.includes("#advancedSettingsModal .advancedSettingHeaderControl,\\n  #advancedSettingsModal .advancedRewardRateControlGroup {\\n    justify-content: flex-end;\\n    width: auto;\\n    margin-left: auto;\\n    gap: 6px;")
    && responsive.includes("#advancedSettingsModal .advancedSettingsFooter {\\n    display: grid;\\n    grid-template-columns: repeat(3, minmax(0, 1fr));\\n    gap: 6px;\\n    padding: 6px 8px;")
    && responsive.includes("#advancedSettingsModal .advancedSettingsFooter button {\\n    width: 100%;\\n    min-width: 0;\\n    height: 36px;\\n    min-height: 36px;"),
  "Advanced Settings must stay vertically compact on phones without stacking section controls or its three footer actions.",
);
invariant(
  responsive.includes("#advancedSettingsModal,\\n  #evaluationLoadModal {\\n    padding:\\n      max(6px, env(safe-area-inset-top))")
    && responsive.includes("#advancedSettingsModal .advancedSettingsDialog,\\n  #evaluationLoadModal .evaluationLoadDialog {\\n    max-height: calc(100dvh - 12px - env(safe-area-inset-top) - env(safe-area-inset-bottom));")
    && responsive.includes("#evaluationLoadModal .evaluationLoadDialog {\\n    height: min(390px, calc(100dvh - 12px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));\\n  }")
    && responsive.includes("#evaluationLoadModal .evaluationLoadList {\\n    grid-auto-rows: 48px;\\n    padding: 5px 6px 8px;\\n  }")
    && responsive.includes("#evaluationLoadModal .evaluationLoadResult {\\n    grid-template-columns: minmax(0, 1fr) 64px auto;\\n    gap: 4px;\\n    min-height: 48px;\\n    padding-inline: 6px;\\n  }"),
  "Both Evaluation popups must scale again at the tiny-phone breakpoint while Load Evaluation results remain one-line and touchable.",
);`;

validator = replaceOnce(validator, oldLoadInvariant, newPopupInvariant, "Evaluation popup validator");

writeFileSync(responsivePath, responsive);
writeFileSync(validatorPath, validator);

const cleanPackage = execFileSync("git", ["show", "origin/main:site/package.json"], {
  cwd: repoRoot,
  encoding: "utf8",
});
writeFileSync(packagePath, cleanPackage);
unlinkSync(resolve(siteRoot, "temp-fix-598.mjs"));

execFileSync("git", ["config", "user.name", "FraGioco9"], { cwd: repoRoot });
execFileSync("git", ["config", "user.email", "giocolifrancesco@gmail.com"], { cwd: repoRoot });
execFileSync("git", ["add", "site/responsive.css", "site/validate-evaluation-mobile-first-paint.mjs", "site/package.json", "site/temp-fix-598.mjs"], { cwd: repoRoot });
execFileSync("git", ["commit", "-m", "Scale Evaluation popups on small phones (#598)"], { cwd: repoRoot, stdio: "inherit" });
execFileSync("git", ["push", "origin", `HEAD:${branch}`], { cwd: repoRoot, stdio: "inherit" });
