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
  layoutCenter.includes('const pageLayout = document.querySelector("main");')
    && layoutCenter.includes("const bounds = pageLayout.getBoundingClientRect();")
    && layoutCenter.includes('document.documentElement.style.setProperty("--toast-center-x", center);'),
  "The always-loaded shared layout-center foundation must own the toast horizontal anchor from the real main-content bounds.",
);
assert.ok(
  layoutCenter.includes('window.addEventListener("resize", syncLayoutCenter, { passive: true });')
    && layoutCenter.includes('attributeFilter: ["class", "data-page"],'),
  "Toast centering must resynchronize when viewport or sidebar/page layout state changes.",
);
assert.ok(
  !layoutCenter.includes("__mflToastPosition"),
  "Shared toast centering must not depend on an optional/lazy runtime bridge.",
);
assert.ok(
  toastCore.includes('toast.classList.add("visible");\n  syncLayoutCenter();'),
  "Every canonical showToast call must synchronize the shared content-centered anchor before presentation settles.",
);
assert.ok(
  stylesBase.includes("left: var(--toast-center-x, 50%);")
    && stylesBase.includes("transform: translateX(-50%)"),
  "The toast surface must consume the single shared horizontal-center variable.",
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
  session.includes('showToast("Dapper opt-in removed.");'),
  "Dapper opt-out feedback must continue through the canonical shared showToast path.",
);

console.log("Toast positioning foundation validation passed: every toast shares the main-content horizontal center while selection-stack owns only intentional vertical collision spacing.");
