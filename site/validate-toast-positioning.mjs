import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n?/g, "\n");

const layoutCenter = read("./modules/core-sources/shared-layout-center.js");
const toastCore = read("./modules/core-sources/shared-toast-core.js");
const selectionStack = read("./selection-stack-runtime.js");
const stylesBase = read("./styles-base.css");
const loading = read("./loading.css");
const responsive = read("./responsive.css");
const session = read("./modules/core-sources/shared-session.js");

assert.ok(
  layoutCenter.startsWith("function syncLayoutCenter() {")
    && !layoutCenter.includes("getBoundingClientRect")
    && !layoutCenter.includes("MutationObserver")
    && !layoutCenter.includes('setProperty("--toast-center-x"')
    && !layoutCenter.includes('setProperty("--selection-center-x"'),
  "Shared layout compatibility must not force geometry reads or own toast/selection horizontal positioning.",
);
assert.ok(
  !toastCore.includes("syncLayoutCenter()"),
  "Canonical showToast must not synchronously read or synchronize layout before presentation.",
);
assert.ok(
  stylesBase.includes("left: var(--pinned-sidebar-width);")
    && stylesBase.includes("right: 0;")
    && stylesBase.includes("margin-inline: auto;")
    && stylesBase.includes("body:not(.pinnedSidebarVisible) .toastMessage {\n  left: 0;")
    && stylesBase.includes("transform: translateY(14px);")
    && stylesBase.includes("transform: translateY(0);")
    && !stylesBase.includes("--toast-center-x"),
  "Toast horizontal centering must be CSS-owned from the canonical pinned-sidebar geometry without a runtime center variable.",
);
assert.ok(
  !selectionStack.includes('setProperty("--toast-center-x"')
    && !selectionStack.includes('removeProperty("--toast-center-x"'),
  "The lazy selection-stack runtime must not own, overwrite, or clear global toast horizontal positioning.",
);
assert.ok(
  selectionStack.includes('document.documentElement.style.setProperty("--mfl-toast-bottom", `${desiredToastBottom()}px`);'),
  "Selection-stack may retain only the intentional vertical collision offset for selection actions.",
);
assert.ok(
  selectionStack.includes('function selectionLayoutActive(selectedCount = applicationSelectionCount()) {')
    && selectionStack.includes('if (!selectionLayoutActive(selectedCount)) {')
    && selectionStack.includes('document.documentElement.style.getPropertyValue("--mfl-toast-bottom") !== "88px"')
    && selectionStack.indexOf('if (!selectionLayoutActive(selectedCount)) {')
      < selectionStack.indexOf("syncSelectionBarPosition();"),
  "Inactive selection-stack synchronization must return before any selection/footer geometry reads while preserving the default toast bottom.",
);
assert.ok(
  loading.includes("bottom: var(--mfl-toast-bottom, 88px);")
    && !loading.includes("--toast-center-x"),
  "Loading/stacking CSS may own toast vertical placement but must not duplicate its horizontal anchor.",
);

for (const block of responsive.match(/\.toastMessage\s*\{[^}]*\}/g) || []) {
  assert.ok(
    !/(?:^|\s)(?:left|right|margin-left)\s*:|--toast-center-x|translateX\s*\(/m.test(block),
    `Responsive toast rules must not introduce a second horizontal position owner: ${block}`,
  );
}

assert.ok(
  session.includes('const toastMessage = String(options.toastMessage || "Dapper opt-in removed.");')
    && session.includes("showToast(toastMessage);"),
  "Dapper opt-out and invalid-session feedback must continue through the canonical shared showToast path.",
);

console.log("Toast positioning foundation validation passed: CSS owns main-content horizontal centering and selection-stack retains only its dedicated selection positioning.");
